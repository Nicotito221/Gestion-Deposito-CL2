from datetime import date, datetime
from typing import Any, Dict, List, Optional
import pyodbc

from app.core.config import get_db_connection
from app.core.time import get_argentina_today, get_argentina_now


class PedidoRepository:
    def __init__(self) -> None:
        self._get_connection = get_db_connection

    def get_materiales_para_sugerencia(
        self, ids_material: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            where_clause = "WHERE rpm.activo = 1"
            params: List[Any] = []
            if ids_material:
                placeholders = ",".join("?" for _ in ids_material)
                where_clause += f" AND rpm.id_material IN ({placeholders})"
                params.extend(ids_material)

            sql = f"""
                SELECT rpm.id_parametro, rpm.id_material, rpm.descripcion, rpm.unidad,
                       COALESCE(rpm.lote_mts, m.lote_minimo) AS lote_mts,
                       rpm.scrap_porcentaje, rpm.factor_conversion,
                       rpm.id_proveedor, p.nombre AS nombre_proveedor,
                       ISNULL(rpm.doh_sugerido_planta, ISNULL(p.doh_sugerido_planta, 1.0)) AS doh_sugerido_planta,
                       rpp.id_producto, rpp.factor_uso,
                       COALESCE(rpm.tipo_empaque, m.tipo_empaque, 'pallet') AS tipo_empaque,
                       COALESCE(rpm.unidad_por_bulto, m.unidad_por_bulto) AS unidad_por_bulto,
                       COALESCE(rpm.bultos_por_pallet, m.bultos_por_pallet) AS bultos_por_pallet
                FROM dbo.rundown_parametro_material rpm
                INNER JOIN dbo.material m ON rpm.id_material = m.id_material
                INNER JOIN dbo.proveedor p ON rpm.id_proveedor = p.id_proveedor
                LEFT JOIN dbo.rundown_parametro_producto rpp ON rpm.id_parametro = rpp.id_parametro
                {where_clause}
                ORDER BY rpm.id_material
            """
            cursor.execute(sql, params)
            rows = cursor.fetchall()

            materiales_map: Dict[str, Dict[str, Any]] = {}
            for r in rows:
                mat_id = str(r[1])
                if mat_id not in materiales_map:
                    materiales_map[mat_id] = {
                        "id_parametro": int(r[0]),
                        "id_material": mat_id,
                        "descripcion": str(r[2] or mat_id),
                        "unidad": str(r[3] or "MTS"),
                        "lote_mts": float(r[4]) if r[4] is not None else None,
                        "scrap_porcentaje": float(r[5] or 0.0),
                        "factor_conversion": float(r[6] or 1.0),
                        "id_proveedor": int(r[7]),
                        "nombre_proveedor": str(r[8] or ""),
                        "doh_sugerido_planta": float(r[9] if r[9] is not None else 1.0),
                        "tipo_empaque": str(r[12]) if len(r) > 12 and r[12] else "pallet",
                        "unidad_por_bulto": float(r[13]) if len(r) > 13 and r[13] is not None else None,
                        "bultos_por_pallet": int(r[14]) if len(r) > 14 and r[14] is not None else None,
                        "productos": [],
                    }
                if r[10]:
                    materiales_map[mat_id]["productos"].append({
                        "id_producto": str(r[10]),
                        "factor_uso": float(r[11] or 1.0),
                    })

            return list(materiales_map.values())
        finally:
            cursor.close()
            conn.close()

    def get_produccion_planificada_dia(self, fecha: date, product_ids: List[str]) -> Dict[str, float]:
        if not product_ids:
            return {}
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            placeholders = ",".join("?" for _ in product_ids)
            sql = f"""
                SELECT id_producto, CAST(cantidad_planificada AS FLOAT)
                FROM dbo.produccion_planificada
                WHERE fecha = ? AND id_producto IN ({placeholders})
            """
            cursor.execute(sql, [fecha] + list(product_ids))
            return {str(r[0]): float(r[1]) for r in cursor.fetchall()}
        finally:
            cursor.close()
            conn.close()

    def get_promedio_diario_produccion(self, anio: int, mes: int, product_ids: List[str]) -> Dict[str, float]:
        if not product_ids:
            return {}
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            placeholders = ",".join("?" for _ in product_ids)
            sql = f"""
                SELECT id_producto, CAST(SUM(cantidad_planificada) AS FLOAT), COUNT(DISTINCT fecha)
                FROM dbo.produccion_planificada
                WHERE YEAR(fecha) = ? AND MONTH(fecha) = ? AND id_producto IN ({placeholders})
                GROUP BY id_producto
            """
            cursor.execute(sql, [anio, mes] + list(product_ids))
            result: Dict[str, float] = {}
            for r in cursor.fetchall():
                tot = float(r[1] or 0.0)
                dias = int(r[2] or 1)
                result[str(r[0])] = round(tot / dias, 2) if dias > 0 else 0.0
            return result
        finally:
            cursor.close()
            conn.close()

    def get_pedidos_existentes_fecha(
        self, fecha_requerida: date, ids_material: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            where_clauses = ["p.fecha_requerida = ?", "p.estado != 'cancelado'"]
            params: List[Any] = [fecha_requerida]

            if ids_material:
                placeholders = ",".join("?" for _ in ids_material)
                where_clauses.append(f"mp.id_material IN ({placeholders})")
                params.extend(ids_material)

            sql = f"""
                SELECT p.id_pedido, p.turno, p.estado, mp.id_material, CAST(mp.cantidad_pedida AS FLOAT)
                FROM dbo.pedido p
                INNER JOIN dbo.material_pedido mp ON p.id_pedido = mp.id_pedido
                WHERE {' AND '.join(where_clauses)}
                ORDER BY p.id_pedido
            """
            cursor.execute(sql, params)
            return [
                {
                    "id_pedido": int(r[0]),
                    "turno": str(r[1]) if r[1] else "Completo",
                    "estado": str(r[2]),
                    "id_material": str(r[3]),
                    "cantidad_pedida": float(r[4] or 0.0),
                }
                for r in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()

    def create_pedido(
        self,
        sector: str,
        prioridad: str,
        origen: str,
        fecha_requerida: Optional[date],
        turno: Optional[str],
        id_conteo: Optional[int],
        comentario: Optional[str],
        items: List[Dict[str, Any]],
        id_usuario_solicitante: Optional[int] = None,
    ) -> int:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            now = get_argentina_now()
            cursor.execute(
                """
                INSERT INTO dbo.pedido (
                    sector, prioridad, origen, estado, fecha_creacion,
                    fecha_requerida, turno, id_conteo, comentario, id_usuario_solicitante
                )
                OUTPUT INSERTED.id_pedido
                VALUES (?, ?, ?, 'pendiente', ?, ?, ?, ?, ?, ?)
                """,
                (
                    sector,
                    prioridad,
                    origen,
                    now,
                    fecha_requerida,
                    turno,
                    id_conteo,
                    comentario,
                    id_usuario_solicitante,
                ),
            )
            id_pedido = int(cursor.fetchone()[0])

            for it in items:
                cursor.execute(
                    """
                    INSERT INTO dbo.material_pedido (
                        id_pedido, id_material, cantidad_pedida, cantidad_preparada,
                        cantidad_entregada, estado, comentario
                    )
                    VALUES (?, ?, ?, 0.0, 0.0, 'pendiente', ?)
                    """,
                    (
                        id_pedido,
                        it["id_material"],
                        float(it["cantidad"]),
                        it.get("comentario"),
                    ),
                )

            conn.commit()
            return id_pedido
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def get_pedidos(
        self,
        fecha_requerida: Optional[date] = None,
        estado: Optional[str] = None,
        turno: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            where_clauses: List[str] = []
            params: List[Any] = []

            if fecha_requerida:
                where_clauses.append("p.fecha_requerida = ?")
                params.append(fecha_requerida)
            if estado and estado != "all":
                where_clauses.append("p.estado = ?")
                params.append(estado)
            if turno and turno != "all":
                where_clauses.append("p.turno = ?")
                params.append(turno)

            where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

            sql = f"""
                SELECT p.id_pedido, p.sector, p.prioridad, p.origen, p.estado,
                       p.fecha_creacion, p.fecha_despacho, p.fecha_entrega,
                       p.fecha_requerida, p.turno, p.id_conteo, p.comentario,
                       p.id_usuario_solicitante,
                       LTRIM(RTRIM(CONCAT(ISNULL(u.nombre, ''), ' ', ISNULL(u.apellido, '')))) AS usuario_solicitante,
                       COUNT(mp.id_material) AS total_items
                FROM dbo.pedido p
                LEFT JOIN dbo.usuario u ON p.id_usuario_solicitante = u.id_usuario
                LEFT JOIN dbo.material_pedido mp ON p.id_pedido = mp.id_pedido
                {where_str}
                GROUP BY p.id_pedido, p.sector, p.prioridad, p.origen, p.estado,
                         p.fecha_creacion, p.fecha_despacho, p.fecha_entrega,
                         p.fecha_requerida, p.turno, p.id_conteo, p.comentario,
                         p.id_usuario_solicitante, u.nombre, u.apellido
                ORDER BY p.id_pedido DESC
                OFFSET 0 ROWS FETCH NEXT ? ROWS ONLY
            """
            params.append(limit)
            cursor.execute(sql, params)
            rows = cursor.fetchall()

            return [
                {
                    "id_pedido": int(r[0]),
                    "sector": str(r[1]),
                    "prioridad": str(r[2]),
                    "origen": str(r[3]),
                    "estado": str(r[4]),
                    "fecha_creacion": r[5],
                    "fecha_despacho": r[6],
                    "fecha_entrega": r[7],
                    "fecha_requerida": r[8],
                    "turno": str(r[9]) if r[9] else None,
                    "id_conteo": int(r[10]) if r[10] is not None else None,
                    "comentario": str(r[11]) if r[11] else None,
                    "id_usuario_solicitante": int(r[12]) if r[12] is not None else None,
                    "usuario_solicitante": str(r[13]).strip() if r[13] and str(r[13]).strip() else None,
                    "total_items": int(r[14] or 0),
                    "items": [],
                }
                for r in rows
            ]
        finally:
            cursor.close()
            conn.close()

    def get_pedido_by_id(self, id_pedido: int) -> Optional[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT p.id_pedido, p.sector, p.prioridad, p.origen, p.estado,
                       p.fecha_creacion, p.fecha_despacho, p.fecha_entrega,
                       p.fecha_requerida, p.turno, p.id_conteo, p.comentario,
                       p.id_usuario_solicitante,
                       LTRIM(RTRIM(CONCAT(ISNULL(u.nombre, ''), ' ', ISNULL(u.apellido, '')))) AS usuario_solicitante
                FROM dbo.pedido p
                LEFT JOIN dbo.usuario u ON p.id_usuario_solicitante = u.id_usuario
                WHERE p.id_pedido = ?
                """,
                (id_pedido,),
            )
            row = cursor.fetchone()
            if not row:
                return None

            cursor.execute(
                """
                SELECT mp.id_material, m.nombre, mp.cantidad_pedida,
                       mp.cantidad_preparada, mp.cantidad_entregada, mp.estado, mp.comentario
                FROM dbo.material_pedido mp
                LEFT JOIN dbo.material m ON mp.id_material = m.id_material
                WHERE mp.id_pedido = ?
                ORDER BY mp.id_material
                """,
                (id_pedido,),
            )
            items = [
                {
                    "id_material": str(ir[0]),
                    "nombre_material": str(ir[1] or ir[0]),
                    "unidad": "MTS",
                    "cantidad_pedida": float(ir[2] or 0.0),
                    "cantidad_preparada": float(ir[3] or 0.0),
                    "cantidad_entregada": float(ir[4] or 0.0),
                    "estado": str(ir[5]),
                    "comentario": str(ir[6]) if ir[6] else None,
                }
                for ir in cursor.fetchall()
            ]

            return {
                "id_pedido": int(row[0]),
                "sector": str(row[1]),
                "prioridad": str(row[2]),
                "origen": str(row[3]),
                "estado": str(row[4]),
                "fecha_creacion": row[5],
                "fecha_despacho": row[6],
                "fecha_entrega": row[7],
                "fecha_requerida": row[8],
                "turno": str(row[9]) if row[9] else None,
                "id_conteo": int(row[10]) if row[10] is not None else None,
                "comentario": str(row[11]) if row[11] else None,
                "id_usuario_solicitante": int(row[12]) if row[12] is not None else None,
                "usuario_solicitante": str(row[13]).strip() if row[13] and str(row[13]).strip() else None,
                "total_items": len(items),
                "items": items,
            }
        finally:
            cursor.close()
            conn.close()
