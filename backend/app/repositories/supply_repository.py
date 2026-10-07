import datetime
import re
from typing import Dict, List, Optional, Tuple
import pyodbc

from app.core.config import get_db_connection
from app.core.time import get_argentina_today
from app.schemas.supply import DemandRowOut, SupplySummaryOut

SPANISH_MONTHS = {
    1: "ene", 2: "feb", 3: "mar", 4: "abr", 5: "may", 6: "jun",
    7: "jul", 8: "ago", 9: "sept", 10: "oct", 11: "nov", 12: "dic"
}

SPANISH_FULL_MONTHS = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
    7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
}

MONTHS_LOOKUP = {
    "ene": 1, "enero": 1, "jan": 1,
    "feb": 2, "febrero": 2,
    "mar": 3, "marzo": 3,
    "abr": 4, "abril": 4, "apr": 4,
    "may": 5, "mayo": 5,
    "jun": 6, "junio": 6,
    "jul": 7, "julio": 7,
    "ago": 8, "agosto": 8, "aug": 8,
    "sep": 9, "sept": 9, "septiembre": 9,
    "oct": 10, "octubre": 10,
    "nov": 11, "noviembre": 11,
    "dic": 12, "diciembre": 12, "dec": 12
}


class SupplyRepository:
    def __init__(self, connection_factory=get_db_connection) -> None:
        self._get_connection = connection_factory

    def get_consolidated_summary(self) -> SupplySummaryOut:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            today_ar = get_argentina_today()

            cursor.execute(
                """
                SELECT COUNT(*) FROM dbo.produccion_planificada
                WHERE YEAR(fecha) = ? AND MONTH(fecha) = ?
                """,
                (today_ar.year, today_ar.month),
            )
            r = cursor.fetchone()
            if r and int(r[0]) > 0:
                firm_year = today_ar.year
                firm_month = today_ar.month
            else:
                cursor.execute(
                    """
                    SELECT TOP 1 YEAR(fecha) AS anio, MONTH(fecha) AS mes
                    FROM dbo.produccion_planificada
                    GROUP BY YEAR(fecha), MONTH(fecha)
                    ORDER BY YEAR(fecha) DESC, MONTH(fecha) DESC
                    """
                )
                f_row = cursor.fetchone()
                if f_row:
                    firm_year, firm_month = int(f_row[0]), int(f_row[1])
                else:
                    firm_year, firm_month = today_ar.year, today_ar.month

            firm_start_date = datetime.date(firm_year, firm_month, 1)

            cursor.execute(
                """
                SELECT 
                    p.id_producto,
                    p.fecha,
                    p.cantidad_planificada,
                    COALESCE(pr.nombre, m.nombre, p.id_producto) AS descripcion,
                    COALESCE(sc.codigo_tasa, p.id_producto) AS tasa_code,
                    COALESCE(m.unidad, 'UN') AS unidad
                FROM dbo.produccion_planificada p
                LEFT JOIN dbo.producto pr ON p.id_producto = pr.id_producto
                LEFT JOIN dbo.material m ON p.id_producto = m.id_material
                LEFT JOIN (
                    SELECT codigo_sap_padre, MIN(codigo_tasa) AS codigo_tasa 
                    FROM dbo.set_componente 
                    GROUP BY codigo_sap_padre
                ) sc ON p.id_producto = sc.codigo_sap_padre
                WHERE p.fecha >= ?
                ORDER BY p.id_producto, p.fecha
                """,
                (firm_start_date,),
            )
            rows = cursor.fetchall()

            if rows:
                cursor.execute(
                    """
                    SELECT YEAR(fecha) AS anio, MONTH(fecha) AS mes, COUNT(DISTINCT fecha) AS cant_fechas
                    FROM dbo.produccion_planificada
                    WHERE fecha >= ?
                    GROUP BY YEAR(fecha), MONTH(fecha)
                    """,
                    (firm_start_date,),
                )
                meses_info = cursor.fetchall()
                daily_months_set = {
                    (int(r[0]), int(r[1]))
                    for r in meses_info
                    if int(r[2]) > 1 or (int(r[0]), int(r[1])) == (firm_year, firm_month)
                }

                daily_dates: Dict[datetime.date, str] = {}
                tent_months: Dict[Tuple[int, int], str] = {}
                grouped: Dict[str, Dict[str, object]] = {}

                for r in rows:
                    prod_id = str(r[0])
                    fecha_dt: datetime.date = r[1]
                    cant = float(r[2] or 0.0)
                    desc = str(r[3] or "")
                    tasa = str(r[4] or "")

                    if prod_id not in grouped:
                        grouped[prod_id] = {
                            "part_number": prod_id,
                            "tasa_code": tasa,
                            "description": desc,
                            "daily_values": {},
                            "tentative_values": {},
                            "tentative_total": 0.0,
                            "total": 0.0,
                        }

                    if (fecha_dt.year, fecha_dt.month) in daily_months_set:
                        col_label = f"{fecha_dt.day}-{SPANISH_MONTHS.get(fecha_dt.month, 'mes')}"
                        daily_dates[fecha_dt] = col_label
                        d_values = grouped[prod_id]["daily_values"]  # type: ignore
                        d_values[col_label] = d_values.get(col_label, 0.0) + cant
                    elif cant > 0:
                        m_key = (fecha_dt.year, fecha_dt.month)
                        m_label = f"{SPANISH_MONTHS.get(fecha_dt.month, 'mes').capitalize()} {fecha_dt.year}"
                        tent_months[m_key] = m_label
                        t_values = grouped[prod_id]["tentative_values"]  # type: ignore
                        t_values[m_label] = t_values.get(m_label, 0.0) + cant
                        grouped[prod_id]["tentative_total"] = float(grouped[prod_id]["tentative_total"]) + cant

                    grouped[prod_id]["total"] = float(grouped[prod_id]["total"]) + cant

                for ym in daily_months_set:
                    cursor.execute(
                        """
                        SELECT fecha, es_laboral
                        FROM dbo.rundown_calendario_laboral
                        WHERE YEAR(fecha) = ? AND MONTH(fecha) = ?
                        """,
                        (ym[0], ym[1]),
                    )
                    cal_rows = cursor.fetchall()
                    if cal_rows:
                        cal_laborales = {r[0] for r in cal_rows if bool(r[1])}
                        cal_no_laborales = {r[0] for r in cal_rows if not bool(r[1])}
                        for nld in cal_no_laborales:
                            daily_dates.pop(nld, None)
                        for ld in cal_laborales:
                            if ld not in daily_dates:
                                daily_dates[ld] = f"{ld.day}-{SPANISH_MONTHS.get(ld.month, 'mes')}"

                sorted_daily = [daily_dates[d] for d in sorted(daily_dates.keys())]
                sorted_tent = [tent_months[k] for k in sorted(tent_months.keys())]
                columnas_fechas_map = {daily_dates[d]: d.strftime("%Y-%m-%d") for d in sorted(daily_dates.keys())}

                items: List[DemandRowOut] = []
                for idx, (prod_id, data) in enumerate(grouped.items()):
                    d_values_raw = data.get("daily_values", {})
                    t_values_raw = data.get("tentative_values", {})
                    d_vals = {
                        c: int(round(float(d_values_raw.get(c, 0.0))))  # type: ignore
                        for c in sorted_daily
                    }
                    t_vals = {
                        c: int(round(float(t_values_raw.get(c, 0.0))))  # type: ignore
                        for c in sorted_tent
                    }
                    items.append(
                        DemandRowOut(
                            id=str(idx + 1),
                            part_number=str(data["part_number"]),
                            tasa_code=str(data["tasa_code"]),
                            description=str(data["description"]),
                            dock="DK-01",
                            box_type="RACK-A",
                            qty_per_box=1,
                            daily_values=d_vals,
                            tentative_values=t_vals,
                            tentative_total=int(round(float(data["tentative_total"]))),
                            total=int(round(float(data["total"]))),
                            status="validado",
                        )
                    )

                total_demanda = sum(it.total for it in items)
                piezas_validadas = sum(1 for it in items if it.status == "validado")
                sorted_dm = sorted(list(daily_months_set))
                if len(sorted_dm) > 1:
                    periodo_str = f"{SPANISH_FULL_MONTHS.get(sorted_dm[0][1], '')} - {SPANISH_FULL_MONTHS.get(sorted_dm[-1][1], '')} {sorted_dm[-1][0]}"
                else:
                    periodo_str = f"{SPANISH_FULL_MONTHS.get(firm_month, '')} {firm_year}"

                return SupplySummaryOut(
                    periodo=periodo_str,
                    total_demanda=total_demanda,
                    piezas_validadas=piezas_validadas,
                    total_piezas=len(items),
                    columnas_diarias=sorted_daily,
                    columnas_tentativas=sorted_tent,
                    columnas_fechas_map=columnas_fechas_map,
                    items=items,
                )

            cursor.execute(
                """
                SELECT 
                    s.codigo_tasa,
                    s.codigo_sap_padre,
                    COALESCE(m.nombre, s.codigo_sap_padre) AS descripcion
                FROM dbo.set_componente s
                LEFT JOIN dbo.material m ON s.codigo_sap_padre = m.id_material
                WHERE s.activo = 1
                GROUP BY s.codigo_tasa, s.codigo_sap_padre, m.nombre
                ORDER BY s.codigo_tasa ASC
                """
            )
            rows = cursor.fetchall()

            items = []
            for idx, r in enumerate(rows):
                items.append(
                    DemandRowOut(
                        id=str(idx + 1),
                        part_number=str(r[1]),
                        tasa_code=str(r[0]),
                        description=str(r[2]),
                        dock="DK-01",
                        box_type="RACK-A",
                        qty_per_box=1,
                        daily_values={},
                        tentative_total=0.0,
                        total=0.0,
                        status="validado",
                    )
                )

            return SupplySummaryOut(
                periodo="Sin importación previa",
                total_demanda=0.0,
                piezas_validadas=len(items),
                total_piezas=len(items),
                items=items,
            )
        finally:
            cursor.close()
            conn.close()

    def get_latest_demand_for_export(self) -> Tuple[str, List[Tuple[str, datetime.date, float, str, str, str]]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            today_ar = get_argentina_today()
            cursor.execute(
                """
                SELECT COUNT(*) FROM dbo.produccion_planificada
                WHERE YEAR(fecha) = ? AND MONTH(fecha) = ?
                """,
                (today_ar.year, today_ar.month),
            )
            r = cursor.fetchone()
            if r and int(r[0]) > 0:
                firm_year = today_ar.year
                firm_month = today_ar.month
            else:
                cursor.execute(
                    """
                    SELECT TOP 1 YEAR(fecha) AS anio, MONTH(fecha) AS mes
                    FROM dbo.produccion_planificada
                    GROUP BY YEAR(fecha), MONTH(fecha)
                    ORDER BY YEAR(fecha) DESC, MONTH(fecha) DESC
                    """
                )
                f_row = cursor.fetchone()
                firm_year = int(f_row[0]) if f_row else today_ar.year
                firm_month = int(f_row[1]) if f_row else today_ar.month

            firm_start_date = datetime.date(firm_year, firm_month, 1)

            cursor.execute(
                """
                SELECT TOP 1 nombre_archivo
                FROM dbo.importacion_archivo
                WHERE tipo = 'produccion_planificada' AND nombre_archivo NOT LIKE 'Plan Semanal%' AND estado = 'procesada'
                ORDER BY id_importacion DESC
                """
            )
            imp_row = cursor.fetchone()
            nombre_archivo = str(imp_row[0]) if imp_row and imp_row[0] else "demanda_consolidada.xlsx"

            cursor.execute(
                """
                SELECT 
                    p.id_producto,
                    p.fecha,
                    p.cantidad_planificada,
                    COALESCE(pr.nombre, m.nombre, p.id_producto) AS descripcion,
                    COALESCE(sc.codigo_tasa, p.id_producto) AS tasa_code,
                    COALESCE(m.centro, '1000') AS centro
                FROM dbo.produccion_planificada p
                LEFT JOIN dbo.producto pr ON p.id_producto = pr.id_producto
                LEFT JOIN dbo.material m ON p.id_producto = m.id_material
                LEFT JOIN (
                    SELECT codigo_sap_padre, MIN(codigo_tasa) AS codigo_tasa 
                    FROM dbo.set_componente 
                    GROUP BY codigo_sap_padre
                ) sc ON p.id_producto = sc.codigo_sap_padre
                WHERE p.fecha >= ?
                ORDER BY p.id_producto, p.fecha
                """,
                (firm_start_date,),
            )
            rows = cursor.fetchall()
            return nombre_archivo, rows
        finally:
            cursor.close()
            conn.close()

    def update_produccion_diaria(
        self, id_producto: str, fecha: datetime.date, cantidad: float, id_usuario: Optional[int] = None
    ) -> None:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            user_id = id_usuario
            if not user_id:
                cursor.execute("SELECT TOP 1 id_usuario FROM dbo.usuario WHERE activo = 1 ORDER BY id_usuario ASC")
                u_row = cursor.fetchone()
                user_id = int(u_row[0]) if u_row else 1

            cursor.execute("SELECT 1 FROM dbo.producto WHERE id_producto = ?", (id_producto,))
            if not cursor.fetchone():
                cursor.execute(
                    """
                    INSERT INTO dbo.producto (id_producto, nombre, descripcion, sector, activo)
                    VALUES (?, ?, ?, 'Seat', 1)
                    """,
                    (id_producto, id_producto, id_producto),
                )

            cursor.execute(
                """
                MERGE dbo.produccion_planificada WITH (HOLDLOCK) AS target
                USING (SELECT ? AS id_producto, ? AS fecha, ? AS cantidad_planificada, ? AS id_usuario) AS src
                ON target.id_producto = src.id_producto AND target.fecha = src.fecha
                WHEN MATCHED THEN
                    UPDATE SET 
                        target.cantidad_planificada = src.cantidad_planificada,
                        target.id_usuario = src.id_usuario,
                        target.fecha_carga = SYSDATETIME()
                WHEN NOT MATCHED BY TARGET THEN
                    INSERT (id_producto, fecha, cantidad_planificada, id_importacion, id_usuario, fecha_carga)
                    VALUES (src.id_producto, src.fecha, src.cantidad_planificada, 1, src.id_usuario, SYSDATETIME());
                """,
                (id_producto, fecha, int(round(float(cantidad))), user_id),
            )
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    def save_planned_production(
        self,
        file_names: List[str],
        items: List[DemandRowOut],
        plan_year: int = 2026,
    ) -> int:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT TOP 1 id_usuario FROM dbo.usuario WHERE activo = 1 ORDER BY id_usuario")
            user_row = cursor.fetchone()
            if user_row:
                id_usuario = int(user_row[0])
            else:
                cursor.execute(
                    """
                    INSERT INTO dbo.usuario (username, password_hash, nombre, apellido, rol, activo, fecha_creacion)
                    OUTPUT INSERTED.id_usuario
                    VALUES ('operario', 'hash_init', 'Operario', 'Sistema', 'operario_deposito', 1, SYSDATETIME())
                    """
                )
                id_usuario = int(cursor.fetchone()[0])

            archivos_str = ", ".join(file_names)[:150] if file_names else "demanda_upload.xlsx"
            cursor.execute(
                """
                INSERT INTO dbo.importacion_archivo (tipo, nombre_archivo, id_usuario, estado, observacion)
                OUTPUT INSERTED.id_importacion
                VALUES ('produccion_planificada', ?, ?, 'procesada', ?)
                """,
                (archivos_str, id_usuario, f"Consolidación de {len(items)} ítems de demanda"),
            )
            id_importacion: int = cursor.fetchone()[0]

            cursor.execute("SELECT id_producto FROM dbo.producto")
            existing_prods = {str(r[0]).strip().upper() for r in cursor.fetchall()}

            prods_to_insert = []
            for it in items:
                canon = it.part_number.strip().upper()
                if canon and canon not in existing_prods:
                    existing_prods.add(canon)
                    prods_to_insert.append((it.part_number, it.description[:50], it.description[:100], "Seat", 1))

            if prods_to_insert:
                cursor.fast_executemany = True
                cursor.executemany(
                    """
                    INSERT INTO dbo.producto (id_producto, nombre, descripcion, sector, activo)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    prods_to_insert,
                )

            planned_dict: Dict[Tuple[str, datetime.date], float] = {}
            tentative_day_map = {10: 19, 11: 19, 12: 14, 1: 18, 2: 15}

            firm_month_detected = 9
            for it in items:
                for col_name in it.daily_values.keys():
                    m_daily = re.match(r"^(\d{1,2})-([a-z]+)", col_name.strip().lower())
                    if m_daily:
                        m_val = MONTHS_LOOKUP.get(m_daily.group(2))
                        if m_val:
                            firm_month_detected = m_val
                            break
                if firm_month_detected != 9:
                    break

            for it in items:
                has_any_qty = False
                for col_name, qty in it.daily_values.items():
                    if qty > 0:
                        has_any_qty = True
                        m_daily = re.match(r"^(\d{1,2})-([a-z]+)", col_name.strip().lower())
                        if m_daily:
                            day = int(m_daily.group(1))
                            m_str = m_daily.group(2)
                            month = MONTHS_LOOKUP.get(m_str, firm_month_detected)
                            fecha_date = datetime.date(plan_year, month, day)
                            key = (it.part_number, fecha_date)
                            planned_dict[key] = planned_dict.get(key, 0.0) + float(qty)
                        else:
                            m_num = re.match(r"^(\d{1,2})$", col_name.strip())
                            if m_num:
                                day = int(m_num.group(1))
                                fecha_date = datetime.date(plan_year, firm_month_detected, day)
                                key = (it.part_number, fecha_date)
                                planned_dict[key] = planned_dict.get(key, 0.0) + float(qty)

                for col_name, qty in it.tentative_values.items():
                    if qty > 0:
                        c_clean = col_name.strip().lower()
                        for m_key, m_val in MONTHS_LOOKUP.items():
                            if m_key in c_clean:
                                if m_val == firm_month_detected:
                                    break
                                has_any_qty = True
                                year = plan_year + (1 if m_val < firm_month_detected else 0)
                                day = tentative_day_map.get(m_val, 1)
                                fecha_date = datetime.date(year, m_val, day)
                                key = (it.part_number, fecha_date)
                                planned_dict[key] = planned_dict.get(key, 0.0) + float(qty)
                                break

                if not has_any_qty:
                    key = (it.part_number, datetime.date(plan_year, firm_month_detected, 1))
                    if key not in planned_dict:
                        planned_dict[key] = 0.0

            if planned_dict:
                cursor.execute(
                    """
                    CREATE TABLE #staging_plan (
                        id_producto varchar(50) NOT NULL,
                        fecha date NOT NULL,
                        cantidad_planificada decimal(18, 4) NOT NULL,
                        id_importacion int NOT NULL,
                        id_usuario int NOT NULL
                    )
                    """
                )
                staging_rows = [
                    (part_number, fecha_date, qty, id_importacion, id_usuario)
                    for (part_number, fecha_date), qty in planned_dict.items()
                ]
                cursor.fast_executemany = True
                cursor.executemany(
                    """
                    INSERT INTO #staging_plan (id_producto, fecha, cantidad_planificada, id_importacion, id_usuario)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    staging_rows,
                )

                cursor.execute(
                    """
                    MERGE dbo.produccion_planificada WITH (HOLDLOCK) AS target
                    USING #staging_plan AS source
                    ON target.id_producto = source.id_producto AND target.fecha = source.fecha
                    WHEN MATCHED THEN
                        UPDATE SET 
                            target.cantidad_planificada = source.cantidad_planificada,
                            target.id_importacion = source.id_importacion,
                            target.id_usuario = source.id_usuario,
                            target.fecha_carga = SYSDATETIME()
                    WHEN NOT MATCHED BY TARGET THEN
                        INSERT (id_producto, fecha, cantidad_planificada, id_importacion, id_usuario, fecha_carga)
                        VALUES (source.id_producto, source.fecha, source.cantidad_planificada, source.id_importacion, source.id_usuario, SYSDATETIME());
                    """
                )
                cursor.execute("DROP TABLE #staging_plan")

            conn.commit()
            return id_importacion
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()
