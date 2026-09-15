from datetime import date
from typing import Any, Dict, List, Optional, Tuple
import pyodbc

from app.core.config import get_db_connection
from app.schemas.rundown import RundownTransitoCreate, RundownTransitoOut


class RundownRepository:
    def __init__(self, connection_factory=get_db_connection) -> None:
        self._get_connection = connection_factory

    def get_proveedor(self, identifier: str) -> Optional[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            if identifier.isdigit():
                cursor.execute(
                    "SELECT id_proveedor, codigo_proveedor, nombre, pais, activo FROM dbo.proveedor WHERE id_proveedor = ?",
                    (int(identifier),),
                )
            else:
                cursor.execute(
                    "SELECT id_proveedor, codigo_proveedor, nombre, pais, activo FROM dbo.proveedor WHERE UPPER(codigo_proveedor) = UPPER(?)",
                    (identifier.strip(),),
                )
            row = cursor.fetchone()
            if not row:
                return None
            return {
                "id_proveedor": int(row[0]),
                "codigo_proveedor": str(row[1]),
                "nombre": str(row[2]),
                "pais": str(row[3]) if row[3] else None,
                "activo": bool(row[4]),
            }
        finally:
            cursor.close()
            conn.close()

    def get_parametros_proveedor(self, id_proveedor: int) -> List[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT m.id_parametro, m.id_proveedor, m.id_material, m.descripcion, m.unidad,
                       m.lote_mts, m.scrap_porcentaje, m.factor_conversion, m.categoria_cabina,
                       m.stock_inicial_referencia, m.fecha_stock_inicial,
                       m.stock_inicial_planta, m.stock_inicial_total,
                       p.id_producto, p.factor_uso
                FROM dbo.rundown_parametro_material m
                LEFT JOIN dbo.rundown_parametro_producto p ON m.id_parametro = p.id_parametro
                WHERE m.id_proveedor = ? AND m.activo = 1
                ORDER BY m.id_parametro, p.id_producto
                """,
                (id_proveedor,),
            )
            rows = cursor.fetchall()
            params_dict: Dict[int, Dict[str, Any]] = {}
            for r in rows:
                p_id = int(r[0])
                if p_id not in params_dict:
                    params_dict[p_id] = {
                        "id_parametro": p_id,
                        "id_proveedor": int(r[1]),
                        "id_material": str(r[2]),
                        "descripcion": str(r[3] or ""),
                        "unidad": str(r[4] or "UN"),
                        "lote_mts": float(r[5]) if r[5] is not None else None,
                        "scrap_porcentaje": float(r[6]),
                        "factor_conversion": float(r[7]),
                        "categoria_cabina": str(r[8]) if r[8] else None,
                        "stock_inicial_referencia": float(r[9]),
                        "fecha_stock_inicial": r[10],
                        "stock_inicial_planta": float(r[11]) if r[11] is not None else 0.0,
                        "stock_inicial_total": float(r[12]) if r[12] is not None else float(r[9]),
                        "productos": [],
                    }
                if r[13]:
                    params_dict[p_id]["productos"].append({
                        "id_producto": str(r[13]),
                        "factor_uso": float(r[14]),
                    })
            return list(params_dict.values())
        finally:
            cursor.close()
            conn.close()

    def get_produccion_planificada(
        self, product_ids: List[str], fecha_desde: date, fecha_hasta: date
    ) -> Dict[str, Dict[date, float]]:
        if not product_ids:
            return {}
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            placeholders = ",".join("?" for _ in product_ids)
            sql = f"""
                SELECT id_producto, fecha, CAST(cantidad_planificada AS FLOAT)
                FROM dbo.produccion_planificada
                WHERE id_producto IN ({placeholders})
                  AND fecha >= ? AND fecha <= ?
                ORDER BY fecha
            """
            params: List[Any] = list(product_ids) + [fecha_desde, fecha_hasta]
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            result: Dict[str, Dict[date, float]] = {pid: {} for pid in product_ids}
            for pid, f_val, cant in rows:
                if pid in result:
                    result[pid][f_val] = float(cant)
            return result
        finally:
            cursor.close()
            conn.close()

    def get_available_production_dates(
        self, product_ids: List[str], fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None
    ) -> List[date]:
        if not product_ids:
            return []
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            placeholders = ",".join("?" for _ in product_ids)
            where_sql = f"WHERE id_producto IN ({placeholders})"
            params: List[Any] = list(product_ids)
            if fecha_desde:
                where_sql += " AND fecha >= ?"
                params.append(fecha_desde)
            if fecha_hasta:
                where_sql += " AND fecha <= ?"
                params.append(fecha_hasta)

            sql = f"SELECT DISTINCT fecha FROM dbo.produccion_planificada {where_sql} ORDER BY fecha"
            cursor.execute(sql, params)
            return [r[0] for r in cursor.fetchall()]
        finally:
            cursor.close()
            conn.close()

    def get_transitos(
        self, id_proveedor: int, fecha_desde: date, fecha_hasta: date
    ) -> List[RundownTransitoOut]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT id_transito, id_proveedor, id_material, fecha_eta, tipo_via,
                       po_numero, factura_numero, CAST(cantidad AS FLOAT), observacion
                FROM dbo.rundown_transito_arribo
                WHERE id_proveedor = ? AND fecha_eta >= ? AND fecha_eta <= ?
                ORDER BY fecha_eta
                """,
                (id_proveedor, fecha_desde, fecha_hasta),
            )
            rows = cursor.fetchall()
            return [
                RundownTransitoOut(
                    id_transito=int(r[0]),
                    id_proveedor=int(r[1]),
                    id_material=str(r[2]),
                    fecha_eta=r[3].strftime("%Y-%m-%d"),
                    tipo_via=str(r[4]),
                    po_numero=str(r[5]) if r[5] else None,
                    factura_numero=str(r[6]) if r[6] else None,
                    cantidad=float(r[7]),
                    observacion=str(r[8]) if r[8] else None,
                )
                for r in rows
            ]
        finally:
            cursor.close()
            conn.close()

    def create_transito(self, data: RundownTransitoCreate) -> int:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO dbo.rundown_transito_arribo
                (id_proveedor, id_material, fecha_eta, tipo_via, po_numero, factura_numero, cantidad, observacion)
                OUTPUT INSERTED.id_transito
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    data.id_proveedor,
                    data.id_material,
                    data.fecha_eta,
                    data.tipo_via,
                    data.po_numero,
                    data.factura_numero,
                    data.cantidad,
                    data.observacion,
                ),
            )
            new_id = int(cursor.fetchone()[0])
            conn.commit()
            return new_id
        finally:
            cursor.close()
            conn.close()

    def delete_transito(self, id_transito: int) -> bool:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "DELETE FROM dbo.rundown_transito_arribo WHERE id_transito = ?",
                (id_transito,),
            )
            affected = cursor.rowcount
            conn.commit()
            return affected > 0
        finally:
            cursor.close()
            conn.close()

    def update_stock_inicial(self, id_parametro: int, stock_inicial: float, tipo_stock: str = "total") -> bool:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            if tipo_stock == "planta":
                cursor.execute(
                    "UPDATE dbo.rundown_parametro_material SET stock_inicial_planta = ? WHERE id_parametro = ?",
                    (stock_inicial, id_parametro),
                )
            else:
                cursor.execute(
                    "UPDATE dbo.rundown_parametro_material SET stock_inicial_total = ?, stock_inicial_referencia = ? WHERE id_parametro = ?",
                    (stock_inicial, stock_inicial, id_parametro),
                )
            affected = cursor.rowcount
            conn.commit()
            return affected > 0
        finally:
            cursor.close()
            conn.close()

    def get_stock_ajustes(
        self, id_proveedor: int, fecha_desde: date, fecha_hasta: date
    ) -> Dict[Tuple[int, date, str], float]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT id_parametro, fecha, tipo_stock, CAST(stock_ajustado AS FLOAT)
                FROM dbo.rundown_stock_ajuste
                WHERE id_proveedor = ? AND fecha >= ? AND fecha <= ?
                """,
                (id_proveedor, fecha_desde, fecha_hasta),
            )
            return {
                (int(r[0]), r[1], str(r[2])): float(r[3])
                for r in cursor.fetchall()
            }
        finally:
            cursor.close()
            conn.close()

    def upsert_stock_ajuste(
        self,
        id_parametro: int,
        id_proveedor: int,
        id_material: str,
        fecha: date,
        tipo_stock: str,
        stock_ajustado: float,
        observacion: Optional[str] = None,
    ) -> bool:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT fecha_stock_inicial
                FROM dbo.rundown_parametro_material
                WHERE id_parametro = ?
                """,
                (id_parametro,),
            )
            row = cursor.fetchone()
            fecha_init = row[0] if row else None

            if fecha_init and fecha <= fecha_init:
                if tipo_stock == "planta":
                    cursor.execute(
                        "UPDATE dbo.rundown_parametro_material SET stock_inicial_planta = ? WHERE id_parametro = ?",
                        (stock_ajustado, id_parametro),
                    )
                else:
                    cursor.execute(
                        "UPDATE dbo.rundown_parametro_material SET stock_inicial_total = ?, stock_inicial_referencia = ? WHERE id_parametro = ?",
                        (stock_ajustado, stock_ajustado, id_parametro),
                    )

            cursor.execute(
                """
                MERGE dbo.rundown_stock_ajuste AS target
                USING (SELECT ? AS id_parametro, ? AS fecha, ? AS tipo_stock) AS source
                ON (target.id_parametro = source.id_parametro AND target.fecha = source.fecha AND target.tipo_stock = source.tipo_stock)
                WHEN MATCHED THEN
                    UPDATE SET stock_ajustado = ?, observacion = ?, fecha_creacion = SYSUTCDATETIME()
                WHEN NOT MATCHED THEN
                    INSERT (id_parametro, id_proveedor, id_material, fecha, tipo_stock, stock_ajustado, observacion)
                    VALUES (?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    id_parametro, fecha, tipo_stock,
                    stock_ajustado, observacion,
                    id_parametro, id_proveedor, id_material, fecha, tipo_stock, stock_ajustado, observacion,
                ),
            )
            conn.commit()
            return True
        finally:
            cursor.close()
            conn.close()

    def update_scrap_porcentaje(self, id_parametro: int, scrap_porcentaje: float) -> bool:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "UPDATE dbo.rundown_parametro_material SET scrap_porcentaje = ? WHERE id_parametro = ?",
                (scrap_porcentaje, id_parametro),
            )
            affected = cursor.rowcount
            conn.commit()
            return affected > 0
        finally:
            cursor.close()
            conn.close()

    def upsert_ingreso_dia(
        self,
        id_proveedor: int,
        id_material: str,
        fecha_eta: date,
        tipo_via: str,
        cantidad: float,
        po_numero: Optional[str] = None,
        factura_numero: Optional[str] = None,
        observacion: Optional[str] = None,
    ) -> bool:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            if cantidad == 0:
                cursor.execute(
                    """
                    DELETE FROM dbo.rundown_transito_arribo
                    WHERE id_proveedor = ? AND id_material = ? AND fecha_eta = ? AND tipo_via = ?
                    """,
                    (id_proveedor, id_material, fecha_eta, tipo_via),
                )
            else:
                cursor.execute(
                    """
                    SELECT id_transito FROM dbo.rundown_transito_arribo
                    WHERE id_proveedor = ? AND id_material = ? AND fecha_eta = ? AND tipo_via = ?
                    """,
                    (id_proveedor, id_material, fecha_eta, tipo_via),
                )
                row = cursor.fetchone()
                if row:
                    cursor.execute(
                        """
                        UPDATE dbo.rundown_transito_arribo
                        SET cantidad = ?,
                            po_numero = COALESCE(?, po_numero),
                            factura_numero = COALESCE(?, factura_numero),
                            observacion = COALESCE(?, observacion)
                        WHERE id_transito = ?
                        """,
                        (cantidad, po_numero, factura_numero, observacion, row[0]),
                    )
                else:
                    cursor.execute(
                        """
                        INSERT INTO dbo.rundown_transito_arribo
                        (id_proveedor, id_material, fecha_eta, tipo_via, po_numero, factura_numero, cantidad, observacion)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (id_proveedor, id_material, fecha_eta, tipo_via, po_numero, factura_numero, cantidad, observacion),
                    )
            conn.commit()
            return True
        finally:
            cursor.close()
            conn.close()

    def get_secciones_con_proveedores(self) -> List[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT s.id_seccion, s.codigo, s.nombre, s.descripcion, s.orden, s.activo,
                       p.id_proveedor, p.codigo_proveedor, p.nombre AS prov_nombre, p.activo AS prov_activo,
                       CASE WHEN m.cant_params > 0 THEN 1 ELSE 0 END AS tiene_parametros
                FROM dbo.rundown_seccion s
                LEFT JOIN dbo.proveedor p ON s.id_seccion = p.id_seccion
                LEFT JOIN (
                    SELECT id_proveedor, COUNT(*) AS cant_params
                    FROM dbo.rundown_parametro_material
                    WHERE activo = 1
                    GROUP BY id_proveedor
                ) m ON p.id_proveedor = m.id_proveedor
                WHERE s.activo = 1
                ORDER BY s.orden, s.nombre, p.nombre
                """
            )
            rows = cursor.fetchall()
            secciones_map: Dict[int, Dict[str, Any]] = {}
            for r in rows:
                s_id = int(r[0])
                if s_id not in secciones_map:
                    secciones_map[s_id] = {
                        "id_seccion": s_id,
                        "codigo": str(r[1]),
                        "nombre": str(r[2]),
                        "descripcion": str(r[3]) if r[3] else None,
                        "orden": int(r[4]),
                        "activo": bool(r[5]),
                        "proveedores": [],
                    }
                if r[6] is not None:
                    secciones_map[s_id]["proveedores"].append({
                        "id_proveedor": int(r[6]),
                        "codigo_proveedor": str(r[7]),
                        "nombre": str(r[8]),
                        "id_seccion": s_id,
                        "activo": bool(r[9]),
                        "tiene_parametros": bool(r[10]),
                    })
            return list(secciones_map.values())
        finally:
            cursor.close()
            conn.close()

    def create_seccion(self, codigo: str, nombre: str, descripcion: Optional[str], orden: int) -> int:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO dbo.rundown_seccion (codigo, nombre, descripcion, orden, activo)
                OUTPUT INSERTED.id_seccion
                VALUES (?, ?, ?, ?, 1)
                """,
                (codigo.strip().upper(), nombre.strip(), descripcion, orden),
            )
            new_id = int(cursor.fetchone()[0])
            conn.commit()
            return new_id
        finally:
            cursor.close()
            conn.close()

    def create_proveedor(self, codigo_proveedor: str, nombre: str, id_seccion: Optional[int], pais: Optional[str]) -> int:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO dbo.proveedor (codigo_proveedor, nombre, pais, activo, id_seccion)
                OUTPUT INSERTED.id_proveedor
                VALUES (?, ?, ?, 1, ?)
                """,
                (codigo_proveedor.strip().upper(), nombre.strip(), pais, id_seccion),
            )
            new_id = int(cursor.fetchone()[0])
            conn.commit()
            return new_id
        finally:
            cursor.close()
            conn.close()

    def update_proveedor(self, id_proveedor: int, nombre: Optional[str], id_seccion: Optional[int], activo: Optional[bool]) -> bool:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            updates: List[str] = []
            params: List[Any] = []
            if nombre is not None:
                updates.append("nombre = ?")
                params.append(nombre.strip())
            if id_seccion is not None:
                updates.append("id_seccion = ?")
                params.append(id_seccion if id_seccion > 0 else None)
            if activo is not None:
                updates.append("activo = ?")
                params.append(1 if activo else 0)

            if not updates:
                return False

            params.append(id_proveedor)
            sql = f"UPDATE dbo.proveedor SET {', '.join(updates)} WHERE id_proveedor = ?"
            cursor.execute(sql, params)
            affected = cursor.rowcount
            conn.commit()
            return affected > 0
        finally:
            cursor.close()
            conn.close()

    def get_meses_disponibles(self) -> List[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT YEAR(fecha) AS anio, MONTH(fecha) AS mes, COUNT(DISTINCT fecha) AS cant_dias, SUM(cantidad_planificada) AS total_volumen
                FROM dbo.produccion_planificada
                GROUP BY YEAR(fecha), MONTH(fecha)
                ORDER BY YEAR(fecha), MONTH(fecha)
                """
            )
            meses_nombres = (
                "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
            )
            result = []
            for r in cursor.fetchall():
                anio = int(r[0])
                mes = int(r[1])
                cant_dias = int(r[2])
                volumen = float(r[3] or 0.0)
                es_firme = cant_dias > 5
                periodo = f"{anio:04d}-{mes:02d}"
                nombre = meses_nombres[mes] if 1 <= mes <= 12 else str(mes)
                label = f"{nombre} {anio}" + (" (En Firme)" if es_firme else "")
                result.append({
                    "periodo": periodo,
                    "anio": anio,
                    "mes": mes,
                    "cant_dias_datos": cant_dias,
                    "total_volumen": volumen,
                    "es_firme": es_firme,
                    "label": label,
                })
            return result
        finally:
            cursor.close()
            conn.close()

    def get_calendario_overrides(
        self, fecha_desde: date, fecha_hasta: date
    ) -> Dict[date, Tuple[bool, Optional[str]]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT fecha, es_laboral, observacion
                FROM dbo.rundown_calendario_laboral
                WHERE fecha >= ? AND fecha <= ?
                """,
                (fecha_desde, fecha_hasta),
            )
            return {
                r[0]: (bool(r[1]), str(r[2]) if r[2] else None)
                for r in cursor.fetchall()
            }
        finally:
            cursor.close()
            conn.close()

    def save_calendario_dias(
        self, dias: List[Tuple[date, bool, Optional[str]]]
    ) -> bool:
        if not dias:
            return True
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            for f, es_lab, obs in dias:
                cursor.execute(
                    """
                    MERGE dbo.rundown_calendario_laboral AS target
                    USING (SELECT ? AS fecha) AS source
                    ON (target.fecha = source.fecha)
                    WHEN MATCHED THEN
                        UPDATE SET es_laboral = ?, observacion = ?, fecha_actualizacion = SYSUTCDATETIME()
                    WHEN NOT MATCHED THEN
                        INSERT (fecha, es_laboral, observacion) VALUES (?, ?, ?);
                    """,
                    (f, 1 if es_lab else 0, obs, f, 1 if es_lab else 0, obs),
                )
            conn.commit()
            return True
        finally:
            cursor.close()
            conn.close()

    def get_produccion_mensual_productos(
        self, product_ids: List[str], anio: int, mes: int
    ) -> Dict[str, float]:
        if not product_ids:
            return {}
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            placeholders = ",".join("?" for _ in product_ids)
            sql = f"""
                SELECT id_producto, SUM(cantidad_planificada)
                FROM dbo.produccion_planificada
                WHERE id_producto IN ({placeholders}) AND YEAR(fecha) = ? AND MONTH(fecha) = ?
                GROUP BY id_producto
            """
            params: List[Any] = list(product_ids) + [anio, mes]
            cursor.execute(sql, params)
            return {str(r[0]): float(r[1] or 0.0) for r in cursor.fetchall()}
        finally:
            cursor.close()
            conn.close()

