from datetime import date
from typing import Any, Dict, List, Optional, Tuple, Union
import pyodbc

from app.core.config import get_db_connection
from app.schemas.rundown import (
    PlanSemanalItemConfirm,
    RundownTransitoCreate,
    RundownTransitoOut,
)


class RundownRepository:
    def __init__(self, connection_factory=get_db_connection) -> None:
        self._get_connection = connection_factory
        self._ensure_alert_columns()

    def _ensure_alert_columns(self) -> None:
        try:
            conn = self._get_connection()
        except Exception:
            return

        cursor = conn.cursor()
        try:
            cursor.execute("""
                IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='proveedor' AND COLUMN_NAME='dias_alerta_rojo')
                BEGIN
                    ALTER TABLE dbo.proveedor ADD dias_alerta_rojo FLOAT NULL;
                END
            """)
            cursor.execute("""
                IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='proveedor' AND COLUMN_NAME='dias_alerta_amarillo')
                BEGIN
                    ALTER TABLE dbo.proveedor ADD dias_alerta_amarillo FLOAT NULL;
                END
            """)
            cursor.execute("""
                IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='proveedor' AND COLUMN_NAME='deposito_en_planta')
                BEGIN
                    ALTER TABLE dbo.proveedor ADD deposito_en_planta BIT NOT NULL DEFAULT 0;
                END
            """)
            cursor.execute("""
                IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='proveedor' AND COLUMN_NAME='doh_sugerido_planta')
                BEGIN
                    ALTER TABLE dbo.proveedor ADD doh_sugerido_planta FLOAT NOT NULL DEFAULT 1.0;
                END
            """)
            conn.commit()
        except Exception:
            conn.rollback()
        finally:
            cursor.close()
            conn.close()

    def get_proveedor(self, identifier: str) -> Optional[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            if identifier.isdigit():
                cursor.execute(
                    """
                    SELECT id_proveedor, codigo_proveedor, nombre, pais, activo,
                           ISNULL(dias_alerta_rojo, 5.0), ISNULL(dias_alerta_amarillo, 15.0),
                           ISNULL(deposito_en_planta, 0), ISNULL(doh_sugerido_planta, 1.0)
                    FROM dbo.proveedor WHERE id_proveedor = ?
                    """,
                    (int(identifier),),
                )
            else:
                cursor.execute(
                    """
                    SELECT id_proveedor, codigo_proveedor, nombre, pais, activo,
                           ISNULL(dias_alerta_rojo, 5.0), ISNULL(dias_alerta_amarillo, 15.0),
                           ISNULL(deposito_en_planta, 0), ISNULL(doh_sugerido_planta, 1.0)
                    FROM dbo.proveedor WHERE UPPER(codigo_proveedor) = UPPER(?)
                    """,
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
                "dias_alerta_rojo": float(row[5]) if row[5] is not None else 5.0,
                "dias_alerta_amarillo": float(row[6]) if row[6] is not None else 15.0,
                "deposito_en_planta": bool(row[7]),
                "doh_sugerido_planta": float(row[8]) if len(row) > 8 and row[8] is not None else 1.0,
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
                       p.id_producto, p.factor_uso,
                       CAST(ISNULL(sd.stock_actual, 0.0) AS FLOAT) AS stock_cl2,
                       ISNULL(m.tipo_empaque, 'pallet') AS tipo_empaque
                FROM dbo.rundown_parametro_material m
                LEFT JOIN dbo.rundown_parametro_producto p ON m.id_parametro = p.id_parametro
                LEFT JOIN dbo.stock_deposito sd ON m.id_material = sd.id_material
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
                        "stock_cl2": float(r[15]) if len(r) > 15 and r[15] is not None else 0.0,
                        "tipo_empaque": str(r[16]) if len(r) > 16 and r[16] else "pallet",
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
        self, id_proveedor: Union[int, List[int]], fecha_desde: date, fecha_hasta: date
    ) -> List[RundownTransitoOut]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            if isinstance(id_proveedor, (list, tuple)):
                if not id_proveedor:
                    return []
                placeholders = ",".join("?" for _ in id_proveedor)
                where_clause = f"id_proveedor IN ({placeholders})"
                query_params = (*id_proveedor, fecha_desde, fecha_hasta)
            else:
                where_clause = "id_proveedor = ?"
                query_params = (id_proveedor, fecha_desde, fecha_hasta)

            cursor.execute(
                f"""
                SELECT id_transito, id_proveedor, id_material, fecha_eta, tipo_via,
                       po_numero, factura_numero, CAST(cantidad AS FLOAT), observacion
                FROM dbo.rundown_transito_arribo
                WHERE {where_clause} AND fecha_eta >= ? AND fecha_eta <= ?
                ORDER BY fecha_eta
                """,
                query_params,
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

    def get_entregas_pedidos_planta(
        self, id_proveedor: Union[int, List[int]], fecha_desde: date, fecha_hasta: date
    ) -> Dict[Tuple[str, date], float]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            if isinstance(id_proveedor, (list, tuple)):
                if not id_proveedor:
                    return {}
                placeholders = ",".join("?" for _ in id_proveedor)
                where_clause = f"rpm.id_proveedor IN ({placeholders})"
                query_params = (*id_proveedor, fecha_desde, fecha_hasta)
            else:
                where_clause = "rpm.id_proveedor = ?"
                query_params = (id_proveedor, fecha_desde, fecha_hasta)

            cursor.execute(
                f"""
                SELECT mr.id_material, CAST(r.fecha_entrega AS DATE), CAST(SUM(mr.cantidad) AS FLOAT)
                FROM dbo.material_remito mr
                INNER JOIN dbo.remito r ON mr.id_remito = r.id_remito
                INNER JOIN dbo.rundown_parametro_material rpm ON mr.id_material = rpm.id_material AND rpm.activo = 1
                WHERE {where_clause}
                  AND r.estado = 'emitido'
                  AND CAST(r.fecha_entrega AS DATE) >= ?
                  AND CAST(r.fecha_entrega AS DATE) <= ?
                GROUP BY mr.id_material, CAST(r.fecha_entrega AS DATE)
                """,
                query_params,
            )
            rows = cursor.fetchall()
            return {(str(r[0]), r[1]): float(r[2]) for r in rows if r[0] and r[1]}
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
            cursor.execute(
                """
                SELECT ISNULL(p.deposito_en_planta, 0)
                FROM dbo.rundown_parametro_material m
                JOIN dbo.proveedor p ON m.id_proveedor = p.id_proveedor
                WHERE m.id_parametro = ?
                """,
                (id_parametro,),
            )
            row = cursor.fetchone()
            dep_en_planta = bool(row[0]) if row else False

            if dep_en_planta:
                cursor.execute(
                    "UPDATE dbo.rundown_parametro_material SET stock_inicial_planta = ?, stock_inicial_total = ?, stock_inicial_referencia = ? WHERE id_parametro = ?",
                    (stock_inicial, stock_inicial, stock_inicial, id_parametro),
                )
            elif tipo_stock == "planta":
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
        self, id_proveedor: Union[int, List[int]], fecha_desde: date, fecha_hasta: date
    ) -> Dict[Tuple[int, date, str], float]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            if isinstance(id_proveedor, (list, tuple)):
                if not id_proveedor:
                    return {}
                placeholders = ",".join("?" for _ in id_proveedor)
                where_clause = f"id_proveedor IN ({placeholders})"
                query_params = (*id_proveedor, fecha_desde, fecha_hasta)
            else:
                where_clause = "id_proveedor = ?"
                query_params = (id_proveedor, fecha_desde, fecha_hasta)

            cursor.execute(
                f"""
                SELECT id_parametro, fecha, tipo_stock, CAST(stock_ajustado AS FLOAT)
                FROM dbo.rundown_stock_ajuste
                WHERE {where_clause} AND fecha >= ? AND fecha <= ?
                """,
                query_params,
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
                SELECT m.fecha_stock_inicial, ISNULL(p.deposito_en_planta, 0)
                FROM dbo.rundown_parametro_material m
                JOIN dbo.proveedor p ON m.id_proveedor = p.id_proveedor
                WHERE m.id_parametro = ?
                """,
                (id_parametro,),
            )
            row = cursor.fetchone()
            fecha_init = row[0] if row else None
            dep_en_planta = bool(row[1]) if row else False

            tipos_a_guardar = ["planta", "total"] if dep_en_planta else [tipo_stock]

            if fecha_init and fecha <= fecha_init:
                if dep_en_planta:
                    cursor.execute(
                        "UPDATE dbo.rundown_parametro_material SET stock_inicial_planta = ?, stock_inicial_total = ?, stock_inicial_referencia = ? WHERE id_parametro = ?",
                        (stock_ajustado, stock_ajustado, stock_ajustado, id_parametro),
                    )
                elif tipo_stock == "planta":
                    cursor.execute(
                        "UPDATE dbo.rundown_parametro_material SET stock_inicial_planta = ? WHERE id_parametro = ?",
                        (stock_ajustado, id_parametro),
                    )
                else:
                    cursor.execute(
                        "UPDATE dbo.rundown_parametro_material SET stock_inicial_total = ?, stock_inicial_referencia = ? WHERE id_parametro = ?",
                        (stock_ajustado, stock_ajustado, id_parametro),
                    )

            for t_stock in tipos_a_guardar:
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
                        id_parametro, fecha, t_stock,
                        stock_ajustado, observacion,
                        id_parametro, id_proveedor, id_material, fecha, t_stock, stock_ajustado, observacion,
                    ),
                )

            conn.commit()
            return True
        finally:
            cursor.close()
            conn.close()

    def delete_stock_ajuste(
        self, id_parametro: int, fecha: date, tipo_stock: str = "total"
    ) -> bool:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT ISNULL(p.deposito_en_planta, 0)
                FROM dbo.rundown_parametro_material m
                JOIN dbo.proveedor p ON m.id_proveedor = p.id_proveedor
                WHERE m.id_parametro = ?
                """,
                (id_parametro,),
            )
            row = cursor.fetchone()
            dep_en_planta = bool(row[0]) if row else False

            if dep_en_planta:
                cursor.execute(
                    """
                    DELETE FROM dbo.rundown_stock_ajuste
                    WHERE id_parametro = ? AND fecha = ?
                    """,
                    (id_parametro, fecha),
                )
            else:
                cursor.execute(
                    """
                    DELETE FROM dbo.rundown_stock_ajuste
                    WHERE id_parametro = ? AND fecha = ? AND tipo_stock = ?
                    """,
                    (id_parametro, fecha, tipo_stock),
                )
            affected = cursor.rowcount

            conn.commit()
            return affected > 0
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
        fecha_origen: Optional[date] = None,
    ) -> bool:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            if fecha_origen and fecha_origen != fecha_eta:
                cursor.execute(
                    """
                    DELETE FROM dbo.rundown_transito_arribo
                    WHERE id_proveedor = ? AND id_material = ? AND fecha_eta = ? AND tipo_via = ?
                    """,
                    (id_proveedor, id_material, fecha_origen, tipo_via),
                )
                if cursor.rowcount == 0:
                    cursor.execute(
                        """
                        DELETE FROM dbo.rundown_transito_arribo
                        WHERE id_proveedor = ? AND id_material = ? AND fecha_eta = ?
                        """,
                        (id_proveedor, id_material, fecha_origen),
                    )

            if cantidad == 0:
                cursor.execute(
                    """
                    DELETE FROM dbo.rundown_transito_arribo
                    WHERE id_proveedor = ? AND id_material = ? AND fecha_eta = ? AND tipo_via = ?
                    """,
                    (id_proveedor, id_material, fecha_eta, tipo_via),
                )
                if cursor.rowcount == 0:
                    cursor.execute(
                        """
                        DELETE FROM dbo.rundown_transito_arribo
                        WHERE id_proveedor = ? AND id_material = ? AND fecha_eta = ?
                        """,
                        (id_proveedor, id_material, fecha_eta),
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
                            po_numero = ?,
                            factura_numero = ?,
                            observacion = ?
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
                       CASE WHEN m.cant_params > 0 THEN 1 ELSE 0 END AS tiene_parametros,
                       ISNULL(p.dias_alerta_rojo, 5.0) AS dias_alerta_rojo,
                       ISNULL(p.dias_alerta_amarillo, 15.0) AS dias_alerta_amarillo,
                       ISNULL(p.deposito_en_planta, 0) AS deposito_en_planta,
                       ISNULL(p.doh_sugerido_planta, 1.0) AS doh_sugerido_planta
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
                        "dias_alerta_rojo": float(r[11]) if r[11] is not None else 5.0,
                        "dias_alerta_amarillo": float(r[12]) if r[12] is not None else 15.0,
                        "deposito_en_planta": bool(r[13]),
                        "doh_sugerido_planta": float(r[14]) if len(r) > 14 and r[14] is not None else 1.0,
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

    def create_proveedor(
        self,
        codigo_proveedor: str,
        nombre: str,
        id_seccion: Optional[int],
        pais: Optional[str],
        deposito_en_planta: bool = False,
        doh_sugerido_planta: float = 1.0,
    ) -> int:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO dbo.proveedor (codigo_proveedor, nombre, pais, activo, id_seccion, deposito_en_planta, doh_sugerido_planta)
                OUTPUT INSERTED.id_proveedor
                VALUES (?, ?, ?, 1, ?, ?, ?)
                """,
                (codigo_proveedor.strip().upper(), nombre.strip(), pais, id_seccion, 1 if deposito_en_planta else 0, doh_sugerido_planta),
            )
            new_id = int(cursor.fetchone()[0])
            conn.commit()
            return new_id
        finally:
            cursor.close()
            conn.close()

    def update_proveedor(
        self,
        id_proveedor: int,
        nombre: Optional[str],
        id_seccion: Optional[int],
        activo: Optional[bool],
        dias_alerta_rojo: Optional[float] = None,
        dias_alerta_amarillo: Optional[float] = None,
        deposito_en_planta: Optional[bool] = None,
        doh_sugerido_planta: Optional[float] = None,
    ) -> bool:
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
            if dias_alerta_rojo is not None:
                updates.append("dias_alerta_rojo = ?")
                params.append(float(dias_alerta_rojo))
            if dias_alerta_amarillo is not None:
                updates.append("dias_alerta_amarillo = ?")
                params.append(float(dias_alerta_amarillo))
            if deposito_en_planta is not None:
                updates.append("deposito_en_planta = ?")
                params.append(1 if deposito_en_planta else 0)
            if doh_sugerido_planta is not None:
                updates.append("doh_sugerido_planta = ?")
                params.append(float(doh_sugerido_planta))

            if not updates:
                return False

            params.append(id_proveedor)
            sql = f"UPDATE dbo.proveedor SET {', '.join(updates)} WHERE id_proveedor = ?"
            cursor.execute(sql, params)
            affected = cursor.rowcount

            if deposito_en_planta:
                cursor.execute(
                    """
                    UPDATE dbo.rundown_parametro_material
                    SET stock_inicial_total = stock_inicial_planta, stock_inicial_referencia = stock_inicial_planta
                    WHERE id_proveedor = ?
                    """,
                    (id_proveedor,),
                )
                cursor.execute(
                    """
                    MERGE dbo.stock_deposito AS target
                    USING (
                        SELECT DISTINCT id_material
                        FROM dbo.rundown_parametro_material
                        WHERE id_proveedor = ?
                        UNION
                        SELECT DISTINCT id_material
                        FROM dbo.proveedor_material
                        WHERE id_proveedor = ?
                        UNION
                        SELECT DISTINCT id_material
                        FROM dbo.material
                        WHERE id_proveedor_principal = ?
                    ) AS source
                    ON (target.id_material = source.id_material)
                    WHEN MATCHED THEN
                        UPDATE SET stock_actual = 0.0, fecha_actualizacion = SYSUTCDATETIME()
                    WHEN NOT MATCHED THEN
                        INSERT (id_material, stock_actual, fecha_actualizacion)
                        VALUES (source.id_material, 0.0, SYSUTCDATETIME());
                    """,
                    (id_proveedor, id_proveedor, id_proveedor),
                )

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
            result_map: Dict[Tuple[int, int], Dict[str, Any]] = {}
            for r in cursor.fetchall():
                anio = int(r[0])
                mes = int(r[1])
                cant_dias = int(r[2])
                volumen = float(r[3] or 0.0)
                es_firme = cant_dias > 5
                periodo = f"{anio:04d}-{mes:02d}"
                nombre = meses_nombres[mes] if 1 <= mes <= 12 else str(mes)
                label = f"{nombre} {anio}" + (" (En Firme)" if es_firme else "")
                result_map[(anio, mes)] = {
                    "periodo": periodo,
                    "anio": anio,
                    "mes": mes,
                    "cant_dias_datos": cant_dias,
                    "total_volumen": volumen,
                    "es_firme": es_firme,
                    "es_proyectado_manual": False,
                    "periodo_copia": None,
                    "label": label,
                }

            cursor.execute(
                """
                SELECT id_proyeccion, anio, mes, periodo_copia, observacion
                FROM dbo.rundown_periodo_proyeccion
                WHERE activo = 1
                ORDER BY anio, mes
                """
            )
            for r in cursor.fetchall():
                p_anio = int(r[1])
                p_mes = int(r[2])
                p_copia = str(r[3])
                periodo = f"{p_anio:04d}-{p_mes:02d}"

                if (p_anio, p_mes) in result_map:
                    continue

                try:
                    c_anio, c_mes = [int(x) for x in p_copia.split("-")]
                    c_nom = meses_nombres[c_mes] if 1 <= c_mes <= 12 else str(c_mes)
                    c_volumen = result_map.get((c_anio, c_mes), {}).get("total_volumen", 0.0)
                except Exception:
                    c_nom = p_copia
                    c_volumen = 0.0

                nombre = meses_nombres[p_mes] if 1 <= p_mes <= 12 else str(p_mes)
                label = f"{nombre} {p_anio} (Proy. de {c_nom})"

                result_map[(p_anio, p_mes)] = {
                    "periodo": periodo,
                    "anio": p_anio,
                    "mes": p_mes,
                    "cant_dias_datos": 0,
                    "total_volumen": c_volumen,
                    "es_firme": False,
                    "es_proyectado_manual": True,
                    "periodo_copia": p_copia,
                    "label": label,
                }

            sorted_keys = sorted(result_map.keys())
            return [result_map[k] for k in sorted_keys]
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
            res = {str(r[0]): float(r[1] or 0.0) for r in cursor.fetchall()}
            if res:
                return res

            root_anio, root_mes = self._resolve_root_production_period(cursor, anio, mes)
            sql_copia = f"""
                SELECT id_producto, SUM(cantidad_planificada)
                FROM dbo.produccion_planificada
                WHERE id_producto IN ({placeholders}) AND YEAR(fecha) = ? AND MONTH(fecha) = ?
                GROUP BY id_producto
            """
            cursor.execute(sql_copia, list(product_ids) + [root_anio, root_mes])
            return {str(r[0]): float(r[1] or 0.0) for r in cursor.fetchall()}
        finally:
            cursor.close()
            conn.close()

    def _resolve_root_production_period(
        self, cursor: pyodbc.Cursor, anio: int, mes: int, max_depth: int = 10
    ) -> Tuple[int, int]:
        visited: set = set()
        curr_anio, curr_mes = anio, mes
        for _ in range(max_depth):
            cursor.execute(
                "SELECT COUNT(1) FROM dbo.produccion_planificada WHERE YEAR(fecha) = ? AND MONTH(fecha) = ?",
                (curr_anio, curr_mes),
            )
            row = cursor.fetchone()
            if row and row[0] > 0:
                return curr_anio, curr_mes

            cursor.execute(
                "SELECT periodo_copia FROM dbo.rundown_periodo_proyeccion WHERE anio = ? AND mes = ? AND activo = 1",
                (curr_anio, curr_mes),
            )
            p_row = cursor.fetchone()
            if not p_row or not p_row[0]:
                break

            copia_str = str(p_row[0]).strip()
            if copia_str in visited:
                break
            visited.add(copia_str)
            try:
                curr_anio, curr_mes = [int(x) for x in copia_str.split("-")]
            except Exception:
                break

        cursor.execute(
            "SELECT TOP 1 YEAR(fecha), MONTH(fecha) FROM dbo.produccion_planificada ORDER BY fecha DESC"
        )
        latest = cursor.fetchone()
        if latest:
            return int(latest[0]), int(latest[1])
        return 2026, 9

    def search_materiales_catalogo(
        self, query: str, limit: int = 50
    ) -> List[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            term = f"%{query.strip()}%" if query.strip() else "%"
            cursor.execute(
                """
                SELECT TOP (?)
                    m.id_material,
                    m.nombre,
                    ISNULL(m.unidad, 'UN') AS unidad,
                    m.categoria,
                    COALESCE(rpm.tipo_empaque, m.tipo_empaque, 'unidad') AS tipo_empaque,
                    COALESCE(NULLIF(rpm.lote_mts, 0), (ISNULL(m.unidad_por_bulto, 1) * ISNULL(m.bultos_por_pallet, 1)), 1.0) AS tamanio_lote
                FROM dbo.material m
                OUTER APPLY (
                    SELECT TOP 1 tipo_empaque, lote_mts
                    FROM dbo.rundown_parametro_material
                    WHERE id_material = m.id_material AND activo = 1
                    ORDER BY id_parametro DESC
                ) rpm
                WHERE m.activo = 1 AND (m.id_material LIKE ? OR m.nombre LIKE ?)
                ORDER BY m.id_material
                """,
                (limit, term, term),
            )
            return [
                {
                    "id_material": str(r[0]),
                    "nombre": str(r[1] or ""),
                    "unidad": str(r[2] or "UN"),
                    "categoria": str(r[3]) if r[3] else None,
                    "tipo_empaque": str(r[4] or "unidad"),
                    "tamanio_lote": float(r[5] or 1.0),
                }
                for r in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()

    def get_parametros_material_proveedor(
        self, id_proveedor: int
    ) -> List[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT m.id_parametro, m.id_proveedor, m.id_material, m.descripcion, m.unidad,
                       m.lote_mts, m.scrap_porcentaje, m.factor_conversion, m.categoria_cabina,
                       m.stock_inicial_planta, m.stock_inicial_total, m.activo,
                       COUNT(p.id_producto) AS cant_productos,
                       m.doh_sugerido_planta,
                       ISNULL(m.tipo_empaque, 'pallet') AS tipo_empaque
                FROM dbo.rundown_parametro_material m
                LEFT JOIN dbo.rundown_parametro_producto p ON m.id_parametro = p.id_parametro
                WHERE m.id_proveedor = ? AND m.activo = 1
                GROUP BY m.id_parametro, m.id_proveedor, m.id_material, m.descripcion, m.unidad,
                         m.lote_mts, m.scrap_porcentaje, m.factor_conversion, m.categoria_cabina,
                         m.stock_inicial_planta, m.stock_inicial_total, m.activo, m.doh_sugerido_planta,
                         m.tipo_empaque
                ORDER BY m.id_parametro
                """,
                (id_proveedor,),
            )
            return [
                {
                    "id_parametro": int(r[0]),
                    "id_proveedor": int(r[1]),
                    "id_material": str(r[2]),
                    "descripcion": str(r[3] or ""),
                    "unidad": str(r[4] or "UN"),
                    "lote_mts": float(r[5]) if r[5] is not None else None,
                    "scrap_porcentaje": float(r[6]),
                    "factor_conversion": float(r[7]),
                    "categoria_cabina": str(r[8]) if r[8] else None,
                    "stock_inicial_planta": float(r[9] or 0.0),
                    "stock_inicial_total": float(r[10] or 0.0),
                    "activo": bool(r[11]),
                    "cant_productos": int(r[12]),
                    "doh_sugerido_planta": float(r[13]) if len(r) > 13 and r[13] is not None else None,
                    "tipo_empaque": str(r[14]) if len(r) > 14 and r[14] else "pallet",
                }
                for r in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()

    def create_or_update_parametro_material(
        self, id_proveedor: int, data: Dict[str, Any]
    ) -> int:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT id_parametro FROM dbo.rundown_parametro_material WHERE id_proveedor = ? AND id_material = ?",
                (id_proveedor, data["id_material"]),
            )
            existing = cursor.fetchone()
            tipo_empaque = data.get("tipo_empaque") or ("pallet" if data.get("lote_mts", 0) and float(data.get("lote_mts", 0)) > 1 else "unidad")
            if existing:
                param_id = int(existing[0])
                cursor.execute(
                    """
                    UPDATE dbo.rundown_parametro_material
                    SET descripcion = ?, unidad = ?, lote_mts = ?, scrap_porcentaje = ?,
                        factor_conversion = ?, categoria_cabina = ?,
                        stock_inicial_planta = ?, stock_inicial_total = ?, stock_inicial_referencia = ?,
                        doh_sugerido_planta = ?, tipo_empaque = ?,
                        activo = 1
                    WHERE id_parametro = ?
                    """,
                    (
                        data.get("descripcion") or data["id_material"],
                        data.get("unidad", "MTS"),
                        data.get("lote_mts"),
                        data.get("scrap_porcentaje", 0.0),
                        data.get("factor_conversion", 1.0),
                        data.get("categoria_cabina"),
                        data.get("stock_inicial_planta", 0.0),
                        data.get("stock_inicial_total", 0.0),
                        data.get("stock_inicial_total", 0.0),
                        data.get("doh_sugerido_planta"),
                        tipo_empaque,
                        param_id,
                    ),
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO dbo.rundown_parametro_material (
                        id_proveedor, id_material, descripcion, unidad, lote_mts,
                        scrap_porcentaje, factor_conversion, categoria_cabina,
                        stock_inicial_planta, stock_inicial_total, stock_inicial_referencia,
                        fecha_stock_inicial, doh_sugerido_planta, tipo_empaque, activo
                    )
                    OUTPUT INSERTED.id_parametro
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-09-01', ?, ?, 1)
                    """,
                    (
                        id_proveedor,
                        data["id_material"],
                        data.get("descripcion") or data["id_material"],
                        data.get("unidad", "MTS"),
                        data.get("lote_mts"),
                        data.get("scrap_porcentaje", 0.0),
                        data.get("factor_conversion", 1.0),
                        data.get("categoria_cabina"),
                        data.get("stock_inicial_planta", 0.0),
                        data.get("stock_inicial_total", 0.0),
                        data.get("stock_inicial_total", 0.0),
                        data.get("doh_sugerido_planta"),
                        tipo_empaque,
                    ),
                )
                param_id = int(cursor.fetchone()[0])
            conn.commit()
            return param_id
        finally:
            cursor.close()
            conn.close()

    def update_lote_material(
        self,
        id_parametro: Optional[int],
        lote_mts: Optional[float],
        tipo_empaque: str,
        id_material: Optional[str] = None,
    ) -> None:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            if id_parametro is not None and id_parametro > 0:
                cursor.execute(
                    """
                    UPDATE dbo.rundown_parametro_material
                    SET lote_mts = ?, tipo_empaque = ?
                    WHERE id_parametro = ?
                    """,
                    (lote_mts, tipo_empaque, id_parametro),
                )
                cursor.execute(
                    """
                    UPDATE m
                    SET m.lote_minimo = ?, m.tipo_empaque = ?
                    FROM dbo.material m
                    INNER JOIN dbo.rundown_parametro_material rpm ON m.id_material = rpm.id_material
                    WHERE rpm.id_parametro = ?
                    """,
                    (lote_mts, tipo_empaque, id_parametro),
                )
            elif id_material:
                cursor.execute(
                    """
                    UPDATE dbo.material
                    SET lote_minimo = ?, tipo_empaque = ?
                    WHERE id_material = ?
                    """,
                    (lote_mts, tipo_empaque, id_material),
                )
                cursor.execute(
                    """
                    UPDATE dbo.rundown_parametro_material
                    SET lote_mts = ?, tipo_empaque = ?
                    WHERE id_material = ?
                    """,
                    (lote_mts, tipo_empaque, id_material),
                )
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    def auto_link_bom_productos(
        self, id_parametro: int, id_material: str
    ) -> int:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT DISTINCT b.id_producto_raiz, b.factor_consumo_total
                FROM dbo.bom_explosion_plana b
                WHERE b.id_material_insumo = ?
                  AND b.id_version = (SELECT TOP 1 id_version FROM dbo.bom_version ORDER BY es_vigente DESC, fecha_importacion DESC)
                """,
                (id_material,),
            )
            bom_rows = cursor.fetchall()

            if not bom_rows:
                cursor.execute("SELECT DISTINCT TOP 20 id_producto FROM dbo.produccion_planificada")
                bom_rows = [(r[0], 1.0) for r in cursor.fetchall()]

            count = 0
            for prod_id, factor in bom_rows:
                cursor.execute(
                    """
                    IF NOT EXISTS (SELECT 1 FROM dbo.rundown_parametro_producto WHERE id_parametro = ? AND id_producto = ?)
                    BEGIN
                        INSERT INTO dbo.rundown_parametro_producto (id_parametro, id_producto, factor_uso)
                        VALUES (?, ?, ?)
                    END
                    """,
                    (id_parametro, str(prod_id), id_parametro, str(prod_id), float(factor)),
                )
                count += 1
            conn.commit()
            return count
        finally:
            cursor.close()
            conn.close()

    def delete_parametro_material(self, id_parametro: int) -> bool:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "UPDATE dbo.rundown_parametro_material SET activo = 0 WHERE id_parametro = ?",
                (id_parametro,),
            )
            conn.commit()
            return cursor.rowcount > 0
        finally:
            cursor.close()
            conn.close()

    def get_periodos_proyeccion(self) -> List[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT id_proyeccion, anio, mes, periodo_copia, observacion, activo
                FROM dbo.rundown_periodo_proyeccion
                WHERE activo = 1
                ORDER BY anio, mes
                """
            )
            return [
                {
                    "id_proyeccion": int(r[0]),
                    "anio": int(r[1]),
                    "mes": int(r[2]),
                    "periodo": f"{int(r[1]):04d}-{int(r[2]):02d}",
                    "periodo_copia": str(r[3]),
                    "observacion": str(r[4]) if r[4] else None,
                    "activo": bool(r[5]),
                }
                for r in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()

    def create_or_update_periodo_proyeccion(
        self, anio: int, mes: int, periodo_copia: str, observacion: Optional[str] = None
    ) -> int:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                IF EXISTS (SELECT 1 FROM dbo.rundown_periodo_proyeccion WHERE anio = ? AND mes = ?)
                BEGIN
                    UPDATE dbo.rundown_periodo_proyeccion
                    SET periodo_copia = ?, observacion = ?, activo = 1
                    OUTPUT INSERTED.id_proyeccion
                    WHERE anio = ? AND mes = ?
                END
                ELSE
                BEGIN
                    INSERT INTO dbo.rundown_periodo_proyeccion (anio, mes, periodo_copia, observacion, activo)
                    OUTPUT INSERTED.id_proyeccion
                    VALUES (?, ?, ?, ?, 1)
                END
                """,
                (
                    anio, mes,
                    periodo_copia, observacion, anio, mes,
                    anio, mes, periodo_copia, observacion,
                ),
            )
            row = cursor.fetchone()
            conn.commit()
            return int(row[0]) if row else 0
        finally:
            cursor.close()
            conn.close()

    def delete_periodo_proyeccion(self, id_proyeccion: int) -> bool:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "UPDATE dbo.rundown_periodo_proyeccion SET activo = 0 WHERE id_proyeccion = ?",
                (id_proyeccion,),
            )
            conn.commit()
            return cursor.rowcount > 0
        finally:
            cursor.close()
            conn.close()

    def get_seccion_info(self, id_seccion: int) -> Optional[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT id_seccion, codigo, nombre FROM dbo.rundown_seccion WHERE id_seccion = ?",
                (id_seccion,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return {
                "id_seccion": int(row[0]),
                "codigo": str(row[1]),
                "nombre": str(row[2]),
            }
        finally:
            cursor.close()
            conn.close()

    def get_sd_mappings_by_seccion(self, id_seccion: int) -> Dict[str, Dict[str, str]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT sc.sd, sc.id_material_hijo, ISNULL(p.nombre, sc.id_material_hijo) as descrip
                FROM dbo.set_componente sc
                INNER JOIN dbo.rundown_seccion rs ON (
                    UPPER(sc.sector) = UPPER(rs.nombre) OR
                    (rs.id_seccion = 1 AND (UPPER(sc.sector) = 'HEADLINER' OR sc.sd LIKE 'H%'))
                )
                LEFT JOIN dbo.producto p ON sc.id_material_hijo = p.id_producto
                WHERE rs.id_seccion = ? AND sc.sd IS NOT NULL AND sc.sd != ''
                """,
                (id_seccion,),
            )
            rows = cursor.fetchall()
            mapping: Dict[str, Dict[str, str]] = {}
            for r in rows:
                sd_code = str(r[0]).strip().upper()
                if sd_code not in mapping:
                    mapping[sd_code] = {
                        "id_producto": str(r[1]).strip(),
                        "descripcion": str(r[2]).strip() if r[2] else str(r[1]).strip(),
                    }
            return mapping
        finally:
            cursor.close()
            conn.close()

    def save_plan_semanal_linea(
        self, id_seccion: int, items: List[PlanSemanalItemConfirm], id_usuario: Optional[int] = None
    ) -> Tuple[int, int]:
        if not items:
            return 0, 0
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            conn.autocommit = False
            user_id = id_usuario if id_usuario else 2

            cursor.execute(
                "SELECT nombre FROM dbo.rundown_seccion WHERE id_seccion = ?",
                (id_seccion,),
            )
            sec_row = cursor.fetchone()
            sec_nombre = str(sec_row[0]) if sec_row else f"Seccion_{id_seccion}"

            cursor.execute(
                """
                INSERT INTO dbo.importacion_archivo (tipo, nombre_archivo, id_usuario, estado, observacion)
                OUTPUT INSERTED.id_importacion
                VALUES (?, ?, ?, 'procesada', ?)
                """,
                (
                    "produccion_planificada",
                    f"Plan Semanal {sec_nombre}",
                    user_id,
                    f"Carga de plan semanal por línea para {sec_nombre} ({len(items)} registros)",
                ),
            )
            imp_row = cursor.fetchone()
            id_importacion = int(imp_row[0]) if imp_row else 1

            registros_linea = 0
            registros_plan = 0

            for item in items:
                cursor.execute(
                    """
                    INSERT INTO dbo.rundown_plan_semanal_linea
                        (id_seccion, sd, id_producto, fecha, cantidad_diaria)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (id_seccion, item.sd, item.id_producto, item.fecha, float(item.cantidad)),
                )
                registros_linea += 1

                cursor.execute(
                    """
                    MERGE dbo.produccion_planificada AS target
                    USING (SELECT ? AS id_producto, ? AS fecha, ? AS cantidad_planificada, ? AS id_importacion, ? AS id_usuario) AS src
                    ON target.id_producto = src.id_producto AND target.fecha = src.fecha
                    WHEN MATCHED THEN
                        UPDATE SET target.cantidad_planificada = src.cantidad_planificada,
                                   target.id_importacion = src.id_importacion,
                                   target.id_usuario = src.id_usuario,
                                   target.fecha_carga = SYSDATETIME()
                    WHEN NOT MATCHED THEN
                        INSERT (id_producto, fecha, cantidad_planificada, id_importacion, id_usuario, fecha_carga)
                        VALUES (src.id_producto, src.fecha, src.cantidad_planificada, src.id_importacion, src.id_usuario, SYSDATETIME());
                    """,
                    (item.id_producto, item.fecha, float(item.cantidad), id_importacion, user_id),
                )
                registros_plan += 1

            conn.commit()
            return registros_linea, registros_plan
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()



