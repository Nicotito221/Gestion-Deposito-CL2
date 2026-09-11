import datetime
import re
from typing import Dict, List, Optional
import pyodbc

from app.core.config import get_db_connection
from app.schemas.supply import DemandRowOut, SupplySummaryOut

SPANISH_MONTHS = {
    1: "ene", 2: "feb", 3: "mar", 4: "abr", 5: "may", 6: "jun",
    7: "jul", 8: "ago", 9: "sept", 10: "oct", 11: "nov", 12: "dic"
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
            cursor.execute(
                """
                SELECT TOP 1 id_importacion, fecha_importacion, nombre_archivo
                FROM dbo.importacion_archivo
                WHERE tipo = 'produccion_planificada' AND estado = 'procesada'
                ORDER BY id_importacion DESC
                """
            )
            last_import = cursor.fetchone()

            if last_import:
                id_importacion = int(last_import[0])
                fecha_imp: Optional[datetime.datetime] = last_import[1]
                nombre_archivo = str(last_import[2] or "")

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
                    WHERE p.id_importacion = ?
                    ORDER BY p.id_producto, p.fecha
                    """,
                    id_importacion,
                )
                rows = cursor.fetchall()

                grouped: Dict[str, Dict[str, object]] = {}
                for r in rows:
                    prod_id = str(r[0])
                    fecha_dt: datetime.date = r[1]
                    cant = float(r[2])
                    desc = str(r[3])
                    tasa = str(r[4])

                    if prod_id not in grouped:
                        grouped[prod_id] = {
                            "part_number": prod_id,
                            "tasa_code": tasa,
                            "description": desc,
                            "daily_values": {},
                            "total": 0.0,
                        }

                    col_label = f"{fecha_dt.day}-{SPANISH_MONTHS.get(fecha_dt.month, 'mes')}"
                    d_values = grouped[prod_id]["daily_values"]  # type: ignore
                    d_values[col_label] = d_values.get(col_label, 0.0) + cant
                    grouped[prod_id]["total"] = float(grouped[prod_id]["total"]) + cant

                items: List[DemandRowOut] = []
                for idx, (prod_id, data) in enumerate(grouped.items()):
                    items.append(
                        DemandRowOut(
                            id=str(idx + 1),
                            part_number=str(data["part_number"]),
                            tasa_code=str(data["tasa_code"]),
                            description=str(data["description"]),
                            dock="DK-01",
                            box_type="RACK-A",
                            qty_per_box=1,
                            daily_values=data["daily_values"],  # type: ignore
                            tentative_total=0.0,
                            total=float(data["total"]),
                            status="validado",
                        )
                    )

                total_demanda = sum(it.total for it in items)
                piezas_validadas = sum(1 for it in items if it.status == "validado")
                periodo_str = f"Importación #{id_importacion} ({nombre_archivo[:28]})"

                return SupplySummaryOut(
                    periodo=periodo_str,
                    total_demanda=total_demanda,
                    piezas_validadas=piezas_validadas,
                    total_piezas=len(items),
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

            rows_to_insert = []
            for it in items:
                for col_name, qty in it.daily_values.items():
                    if qty > 0:
                        m = re.match(r"^(\d{1,2})-([a-z]+)", col_name.strip().lower())
                        if m:
                            day = int(m.group(1))
                            m_str = m.group(2)
                            month = MONTHS_LOOKUP.get(m_str, 9)
                            fecha_date = datetime.date(plan_year, month, day)
                            rows_to_insert.append(
                                (it.part_number, fecha_date, float(qty), id_importacion, id_usuario)
                            )

            if rows_to_insert:
                cursor.fast_executemany = True
                cursor.executemany(
                    """
                    INSERT INTO dbo.produccion_planificada (
                        id_producto, fecha, cantidad_planificada, id_importacion, id_usuario, fecha_carga
                    )
                    VALUES (?, ?, ?, ?, ?, SYSDATETIME())
                    """,
                    rows_to_insert,
                )

            conn.commit()
            return id_importacion
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()
