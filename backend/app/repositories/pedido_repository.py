from datetime import date, datetime
import math
from typing import Any, Dict, List, Optional, Tuple
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
            where_clause = "WHERE rpm.activo = 1 AND COALESCE(rpm.en_cl2, m.en_cl2, 0) = 1"
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
                       COALESCE(rpm.bultos_por_pallet, m.bultos_por_pallet) AS bultos_por_pallet,
                       ISNULL(rpm.stock_inicial_planta, 0.0) AS stock_inicial_planta,
                       ISNULL(sd.stock_actual, 0.0) AS stock_cl2,
                       COALESCE(rpm.en_cl2, m.en_cl2, 0) AS en_cl2
                FROM dbo.rundown_parametro_material rpm
                INNER JOIN dbo.material m ON rpm.id_material = m.id_material
                INNER JOIN dbo.proveedor p ON rpm.id_proveedor = p.id_proveedor
                LEFT JOIN dbo.rundown_parametro_producto rpp ON rpm.id_parametro = rpp.id_parametro
                LEFT JOIN dbo.stock_deposito sd ON rpm.id_material = sd.id_material
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
                        "stock_inicial_planta": float(r[15]) if len(r) > 15 and r[15] is not None else 0.0,
                        "stock_cl2": float(r[16]) if len(r) > 16 and r[16] is not None else 0.0,
                        "en_cl2": bool(r[17]) if len(r) > 17 else True,
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

    def get_ultimo_id_conteo_finalizado(self) -> Optional[int]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT TOP 1 id_conteo FROM dbo.conteo WHERE estado = 'finalizado' ORDER BY id_conteo DESC")
            row = cursor.fetchone()
            return int(row[0]) if row else None
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

            cursor.execute(
                """
                INSERT INTO dbo.auditoria (entidad, id_entidad, tipo_evento, id_usuario, fecha, detalle)
                VALUES ('pedido', ?, 'solicitud', ?, ?, ?)
                """,
                (
                    str(id_pedido),
                    id_usuario_solicitante,
                    now,
                    f"Pedido de {len(items)} material(es) creado — prioridad {prioridad} ({origen})",
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
        sector: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            today = get_argentina_today()
            cursor.execute(
                """
                UPDATE dbo.pedido
                SET estado = 'pendiente'
                WHERE estado = 'en_preparacion'
                  AND COALESCE(fecha_requerida, CAST(fecha_creacion AS DATE)) < ?
                """,
                (today,),
            )
            conn.commit()

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
            if sector and sector not in ("TODOS", "all"):
                where_clauses.append("p.sector = ?")
                params.append(sector)

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

            estado_pedido = str(row[4] or "").lower()

            cursor.execute(
                """
                SELECT mp.id_material, m.nombre, mp.cantidad_pedida,
                       mp.cantidad_preparada, mp.cantidad_entregada, mp.estado, mp.comentario,
                       ISNULL(m.unidad, 'UN') AS unidad,
                       COALESCE(rpm.tipo_empaque, m.tipo_empaque, 'unidad') AS tipo_empaque,
                       COALESCE(NULLIF(rpm.lote_mts, 0), (ISNULL(m.unidad_por_bulto, 1) * ISNULL(m.bultos_por_pallet, 1)), 1.0) AS tamanio_lote
                FROM dbo.material_pedido mp
                LEFT JOIN dbo.material m ON mp.id_material = m.id_material
                LEFT JOIN dbo.rundown_parametro_material rpm ON mp.id_material = rpm.id_material AND rpm.activo = 1
                WHERE mp.id_pedido = ?
                ORDER BY mp.id_material
                """,
                (id_pedido,),
            )
            items = []
            for ir in cursor.fetchall():
                tipo_emp = str(ir[8] or "unidad").lower()
                tam_lote = float(ir[9] or 1.0)
                cant_ped = float(ir[2] or 0.0)
                cant_prep = float(ir[3] or 0.0)
                cant_entregada = float(ir[4] or 0.0)
                is_cancelled = (estado_pedido == "cancelado" or str(ir[5] or "").lower() == "cancelado")
                cant_pendiente = 0.0 if is_cancelled else max(0.0, round(cant_ped - cant_entregada, 2))
                cant_prep_final = 0.0 if is_cancelled else cant_prep

                if tipo_emp == "pallet" and tam_lote > 1 and cant_ped >= tam_lote:
                    cant_pallets = int(math.ceil(cant_ped / tam_lote)) if cant_ped > 0 else 0
                    if is_cancelled:
                        cant_pallets_entregada = int(cant_entregada // tam_lote) if cant_entregada > 0 else 0
                        cant_pallets_pendiente = 0
                        cant_pallets_prep = 0
                    elif cant_pendiente <= 0:
                        cant_pallets_entregada = cant_pallets
                        cant_pallets_pendiente = 0
                        cant_pallets_prep = cant_pallets
                    else:
                        cant_pallets_entregada = int(cant_entregada // tam_lote) if cant_entregada > 0 else 0
                        cant_pallets_pendiente = max(0, cant_pallets - cant_pallets_entregada)
                        cant_pallets_prep = int(cant_prep // tam_lote) if cant_prep > 0 else 0
                else:
                    cant_pallets = None
                    cant_pallets_entregada = None
                    cant_pallets_pendiente = None
                    cant_pallets_prep = None

                items.append({
                    "id_material": str(ir[0]),
                    "nombre_material": str(ir[1] or ir[0]),
                    "unidad": str(ir[7] or "UN"),
                    "cantidad_pedida": cant_ped,
                    "cantidad_preparada": cant_prep_final,
                    "cantidad_entregada": cant_entregada,
                    "cantidad_pendiente": cant_pendiente,
                    "estado": str(ir[5]),
                    "comentario": str(ir[6]) if ir[6] else None,
                    "tipo_empaque": tipo_emp,
                    "tamanio_lote": tam_lote,
                    "cantidad_pallets": cant_pallets,
                    "cantidad_pallets_preparada": cant_pallets_prep,
                    "cantidad_pallets_entregada": cant_pallets_entregada,
                    "cantidad_pallets_pendiente": cant_pallets_pendiente,
                })

            remitos = self.get_remitos_by_pedido(id_pedido, cursor=cursor)
            id_remito = remitos[-1]["id_remito"] if remitos else None

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
                "id_remito": id_remito,
                "remitos": remitos,
                "total_items": len(items),
                "items": items,
            }
        finally:
            cursor.close()
            conn.close()

    def get_remitos_by_pedido(self, id_pedido: int, cursor: Optional[Any] = None) -> List[Dict[str, Any]]:
        own_conn = False
        conn = None
        if cursor is None:
            conn = self._get_connection()
            cursor = conn.cursor()
            own_conn = True
        try:
            cursor.execute(
                """
                SELECT r.id_remito, r.id_pedido, r.fecha_emision, r.fecha_entrega, r.estado,
                       r.id_usuario_emisor, u.nombre AS usuario_emisor, r.observacion,
                       p.sector AS sector_destino, usol.nombre AS usuario_solicitante,
                       p.fecha_requerida, p.turno
                FROM dbo.remito r
                INNER JOIN dbo.pedido p ON r.id_pedido = p.id_pedido
                LEFT JOIN dbo.usuario u ON r.id_usuario_emisor = u.id_usuario
                LEFT JOIN dbo.usuario usol ON p.id_usuario_solicitante = usol.id_usuario
                WHERE r.id_pedido = ?
                ORDER BY r.fecha_emision ASC, r.id_remito ASC
                """,
                (id_pedido,),
            )
            r_rows = cursor.fetchall()
            remitos: List[Dict[str, Any]] = []
            for r in r_rows:
                id_rem = str(r[0])
                cursor.execute(
                    """
                    SELECT mr.id_material, m.nombre, mr.cantidad,
                           ISNULL(m.unidad, 'UN') AS unidad,
                           COALESCE(rpm.tipo_empaque, m.tipo_empaque, 'unidad') AS tipo_empaque,
                           COALESCE(NULLIF(rpm.lote_mts, 0), (ISNULL(m.unidad_por_bulto, 1) * ISNULL(m.bultos_por_pallet, 1)), 1.0) AS tamanio_lote,
                           COALESCE(rpm.bultos_por_pallet, m.bultos_por_pallet) AS bultos_por_pallet
                    FROM dbo.material_remito mr
                    LEFT JOIN dbo.material m ON mr.id_material = m.id_material
                    LEFT JOIN dbo.rundown_parametro_material rpm ON mr.id_material = rpm.id_material AND rpm.activo = 1
                    WHERE mr.id_remito = ?
                    ORDER BY mr.id_material ASC
                    """,
                    (id_rem,),
                )
                m_rows = cursor.fetchall()
                rem_items = []
                tot_pallets = 0
                tot_unidades = 0.0
                for mr in m_rows:
                    cant = float(mr[2] or 0.0)
                    tipo_emp = str(mr[4] or "unidad").lower()
                    tam_lote = float(mr[5] or 1.0)
                    bultos_pp = int(mr[6]) if mr[6] is not None and int(mr[6]) > 0 else None
                    if tipo_emp in ("pallet", "rollo") and tam_lote > 1 and cant >= tam_lote:
                        cp = int(round(cant / tam_lote)) if cant > 0 else 0
                    else:
                        cp = None
                    cb = (cp * bultos_pp) if (tipo_emp == "rollo" and cp and bultos_pp) else None
                    if cp:
                        tot_pallets += cp
                    tot_unidades += cant
                    rem_items.append({
                        "id_material": str(mr[0]),
                        "nombre_material": str(mr[1] or mr[0]),
                        "unidad": str(mr[3] or "UN"),
                        "cantidad": cant,
                        "tipo_empaque": tipo_emp,
                        "tamanio_lote": tam_lote,
                        "cantidad_pallets": cp,
                        "bultos_por_pallet": bultos_pp,
                        "cantidad_bultos": cb,
                    })

                remitos.append({
                    "id_remito": id_rem,
                    "id_pedido": int(r[1]),
                    "fecha_emision": r[2],
                    "fecha_entrega": r[3],
                    "estado": str(r[4]),
                    "id_usuario_emisor": int(r[5]) if r[5] is not None else None,
                    "usuario_emisor": str(r[6]).strip() if r[6] else None,
                    "observacion": str(r[7]) if r[7] else None,
                    "sector_destino": str(r[8]) if r[8] else None,
                    "usuario_solicitante": str(r[9]).strip() if r[9] else None,
                    "fecha_requerida": r[10],
                    "turno": str(r[11]) if r[11] else None,
                    "total_items": len(rem_items),
                    "total_pallets": tot_pallets,
                    "total_unidades": round(tot_unidades, 2),
                    "items": rem_items,
                })
            return remitos
        finally:
            if own_conn and conn:
                cursor.close()
                conn.close()

    def get_remito_by_id(self, id_remito: str) -> Optional[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            target_id = id_remito.strip()
            if target_id.isdigit():
                cursor.execute(
                    "SELECT TOP 1 id_remito FROM dbo.remito WHERE id_pedido = ? ORDER BY fecha_emision DESC",
                    (int(target_id),),
                )
                r_first = cursor.fetchone()
                if not r_first:
                    return None
                target_id = str(r_first[0])

            cursor.execute(
                """
                SELECT r.id_remito, r.id_pedido, r.fecha_emision, r.fecha_entrega, r.estado,
                       r.id_usuario_emisor, u.nombre AS usuario_emisor, r.observacion,
                       p.sector AS sector_destino, usol.nombre AS usuario_solicitante,
                       p.fecha_requerida, p.turno
                FROM dbo.remito r
                INNER JOIN dbo.pedido p ON r.id_pedido = p.id_pedido
                LEFT JOIN dbo.usuario u ON r.id_usuario_emisor = u.id_usuario
                LEFT JOIN dbo.usuario usol ON p.id_usuario_solicitante = usol.id_usuario
                WHERE r.id_remito = ?
                """,
                (target_id,),
            )
            r = cursor.fetchone()
            if not r:
                return None

            cursor.execute(
                """
                SELECT mr.id_material, m.nombre, mr.cantidad,
                       ISNULL(m.unidad, 'UN') AS unidad,
                       COALESCE(rpm.tipo_empaque, m.tipo_empaque, 'unidad') AS tipo_empaque,
                       COALESCE(NULLIF(rpm.lote_mts, 0), (ISNULL(m.unidad_por_bulto, 1) * ISNULL(m.bultos_por_pallet, 1)), 1.0) AS tamanio_lote,
                       COALESCE(rpm.bultos_por_pallet, m.bultos_por_pallet) AS bultos_por_pallet
                FROM dbo.material_remito mr
                LEFT JOIN dbo.material m ON mr.id_material = m.id_material
                LEFT JOIN dbo.rundown_parametro_material rpm ON mr.id_material = rpm.id_material AND rpm.activo = 1
                WHERE mr.id_remito = ?
                ORDER BY mr.id_material ASC
                """,
                (target_id,),
            )
            m_rows = cursor.fetchall()
            rem_items = []
            tot_pallets = 0
            tot_unidades = 0.0
            for mr in m_rows:
                cant = float(mr[2] or 0.0)
                tipo_emp = str(mr[4] or "unidad").lower()
                tam_lote = float(mr[5] or 1.0)
                bultos_pp = int(mr[6]) if mr[6] is not None and int(mr[6]) > 0 else None
                if tipo_emp in ("pallet", "rollo") and tam_lote > 1 and cant >= tam_lote:
                    cp = int(round(cant / tam_lote)) if cant > 0 else 0
                else:
                    cp = None
                cb = (cp * bultos_pp) if (tipo_emp == "rollo" and cp and bultos_pp) else None
                if cp:
                    tot_pallets += cp
                tot_unidades += cant
                rem_items.append({
                    "id_material": str(mr[0]),
                    "nombre_material": str(mr[1] or mr[0]),
                    "unidad": str(mr[3] or "UN"),
                    "cantidad": cant,
                    "tipo_empaque": tipo_emp,
                    "tamanio_lote": tam_lote,
                    "cantidad_pallets": cp,
                    "bultos_por_pallet": bultos_pp,
                    "cantidad_bultos": cb,
                })

            return {
                "id_remito": str(r[0]),
                "id_pedido": int(r[1]),
                "fecha_emision": r[2],
                "fecha_entrega": r[3],
                "estado": str(r[4]),
                "id_usuario_emisor": int(r[5]) if r[5] is not None else None,
                "usuario_emisor": str(r[6]).strip() if r[6] else None,
                "observacion": str(r[7]) if r[7] else None,
                "sector_destino": str(r[8]) if r[8] else None,
                "usuario_solicitante": str(r[9]).strip() if r[9] else None,
                "fecha_requerida": r[10],
                "turno": str(r[11]) if r[11] else None,
                "total_items": len(rem_items),
                "total_pallets": tot_pallets,
                "total_unidades": round(tot_unidades, 2),
                "items": rem_items,
            }
        finally:
            cursor.close()
            conn.close()

    def actualizar_preparacion_pedido(
        self,
        id_pedido: int,
        accion: str,
        comentario: Optional[str],
        items: List[Dict[str, Any]],
        id_usuario: Optional[int] = None,
    ) -> Tuple[Dict[str, Any], Optional[str]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT estado, sector, fecha_requerida FROM dbo.pedido WHERE id_pedido = ?", (id_pedido,))
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"Pedido #{id_pedido} no existe")
            estado_actual = str(row[0])
            sector_pedido = str(row[1])
            fecha_requerida_pedido = row[2]

            if estado_actual == "cancelado":
                raise ValueError(f"El pedido #{id_pedido} está cancelado y no puede ser modificado")
            if estado_actual == "completo" and accion != "guardar_avance":
                raise ValueError(f"El pedido #{id_pedido} ya se encuentra completo")

            user_id_final = id_usuario
            if user_id_final:
                cursor.execute("SELECT 1 FROM dbo.usuario WHERE id_usuario = ?", (user_id_final,))
                if not cursor.fetchone():
                    user_id_final = None
            if not user_id_final:
                cursor.execute("SELECT TOP 1 id_usuario FROM dbo.usuario WHERE activo = 1 AND eliminado = 0 ORDER BY id_usuario ASC")
                u_row = cursor.fetchone()
                user_id_final = int(u_row[0]) if u_row else 3

            id_remito_generado: Optional[str] = None

            if accion == "guardar_avance":
                for it in items:
                    c_prep = float(it.get("cantidad_preparada", 0.0))
                    cursor.execute(
                        "SELECT cantidad_pedida, ISNULL(cantidad_entregada, 0.0) FROM dbo.material_pedido WHERE id_pedido = ? AND id_material = ?",
                        (id_pedido, it["id_material"]),
                    )
                    ped_row = cursor.fetchone()
                    if ped_row:
                        c_ped = float(ped_row[0] or 0.0)
                        c_entregada = float(ped_row[1] or 0.0)
                        est_item = "completo" if c_entregada >= c_ped and c_ped > 0 else ("parcial" if c_entregada > 0 else "pendiente")
                        cursor.execute(
                            "UPDATE dbo.material_pedido SET cantidad_preparada = ?, estado = ?, comentario = ? WHERE id_pedido = ? AND id_material = ?",
                            (c_prep, est_item, it.get("comentario"), id_pedido, it["id_material"]),
                        )
                if estado_actual == "pendiente":
                    cursor.execute(
                        "UPDATE dbo.pedido SET estado = 'en_preparacion', comentario = COALESCE(?, comentario) WHERE id_pedido = ?",
                        (comentario, id_pedido),
                    )
                cursor.execute(
                    """
                    INSERT INTO dbo.auditoria (entidad, id_entidad, tipo_evento, id_usuario, fecha, detalle)
                    VALUES ('pedido', ?, 'preparacion', ?, GETDATE(), 'Avance de preparación registrado en depósito')
                    """,
                    (str(id_pedido), user_id_final),
                )

            elif accion in ("confirmar_completo", "confirmar_parcial"):
                cursor.execute(
                    """
                    SELECT id_material, cantidad_pedida, ISNULL(cantidad_entregada, 0.0)
                    FROM dbo.material_pedido
                    WHERE id_pedido = ?
                    """,
                    (id_pedido,),
                )
                order_materials = cursor.fetchall()
                mat_map = {
                    str(r[0]): {
                        "pedida": float(r[1] or 0.0),
                        "entregada": float(r[2] or 0.0),
                        "pendiente": max(0.0, round(float(r[1] or 0.0) - float(r[2] or 0.0), 2)),
                    }
                    for r in order_materials
                }

                input_map = {str(it["id_material"]): float(it.get("cantidad_preparada", 0.0)) for it in items}
                coment_map = {str(it["id_material"]): it.get("comentario") for it in items}

                delta_map: Dict[str, float] = {}
                for id_mat, info in mat_map.items():
                    c_ped = info["pedida"]
                    c_prev = info["entregada"]
                    c_pend = info["pendiente"]

                    if c_pend <= 0:
                        delta_map[id_mat] = 0.0
                        continue

                    if id_mat in input_map:
                        c_input = input_map[id_mat]
                        if c_input > c_pend:
                            delta = max(0.0, min(c_input - c_prev, c_pend))
                        else:
                            delta = max(0.0, min(c_input, c_pend))
                    else:
                        delta = c_pend if accion == "confirmar_completo" else 0.0

                    if accion == "confirmar_completo" and delta == 0.0 and c_pend > 0 and (id_mat not in input_map or input_map[id_mat] == 0):
                        delta = c_pend

                    delta_map[id_mat] = round(delta, 2)

                total_delta = sum(delta_map.values())
                if total_delta <= 0:
                    raise ValueError("No se especificaron cantidades pendientes a despachar mayores a 0")

                cursor.execute("SELECT COUNT(*) FROM dbo.remito WHERE id_pedido = ?", (id_pedido,))
                n_rem = cursor.fetchone()[0]
                seq = n_rem + 1
                id_remito_generado = f"RI-{id_pedido:06d}-{seq:02d}"

                obs_remito = f"Remito de entrega #{seq} por pedido #{id_pedido} para sector {sector_pedido}"
                cursor.execute(
                    """
                    INSERT INTO dbo.remito (id_remito, id_pedido, fecha_emision, fecha_entrega, estado, id_usuario_emisor, observacion)
                    VALUES (?, ?, GETDATE(), GETDATE(), 'emitido', ?, ?)
                    """,
                    (id_remito_generado, id_pedido, user_id_final, obs_remito),
                )
                cursor.execute(
                    """
                    INSERT INTO dbo.auditoria (entidad, id_entidad, tipo_evento, id_usuario, fecha, detalle)
                    VALUES ('pedido', ?, 'despacho', ?, GETDATE(), ?)
                    """,
                    (str(id_pedido), user_id_final, f"Remito {id_remito_generado} emitido — {obs_remito}"),
                )

                for id_mat, info in mat_map.items():
                    delta = delta_map.get(id_mat, 0.0)
                    nueva_entregada = round(info["entregada"] + delta, 2)
                    c_ped = info["pedida"]
                    est_item = "completo" if nueva_entregada >= c_ped and c_ped > 0 else ("parcial" if nueva_entregada > 0 else "pendiente")

                    cursor.execute(
                        """
                        UPDATE dbo.material_pedido
                        SET cantidad_preparada = ?, cantidad_entregada = ?, estado = ?, comentario = COALESCE(?, comentario)
                        WHERE id_pedido = ? AND id_material = ?
                        """,
                        (nueva_entregada, nueva_entregada, est_item, coment_map.get(id_mat), id_pedido, id_mat),
                    )

                    if delta > 0:
                        cursor.execute(
                            "INSERT INTO dbo.material_remito (id_remito, id_material, cantidad) VALUES (?, ?, ?)",
                            (id_remito_generado, id_mat, delta),
                        )

                        cursor.execute(
                            """
                            SELECT TOP 1 ISNULL(p.deposito_en_planta, 0)
                            FROM dbo.material m
                            OUTER APPLY (
                                SELECT id_proveedor_principal AS id_prov, 1 AS prio FROM dbo.material WHERE id_material = m.id_material AND id_proveedor_principal IS NOT NULL
                                UNION ALL
                                SELECT id_proveedor AS id_prov, 2 AS prio FROM dbo.rundown_parametro_material WHERE id_material = m.id_material AND activo = 1
                            ) src
                            JOIN dbo.proveedor p ON src.id_prov = p.id_proveedor
                            WHERE m.id_material = ?
                            ORDER BY src.prio ASC
                            """,
                            (id_mat,),
                        )
                        p_row = cursor.fetchone()
                        dep_en_planta = bool(p_row[0]) if p_row and p_row[0] is not None else False

                        if not dep_en_planta:
                            cursor.execute("SELECT stock_actual FROM dbo.stock_deposito WHERE id_material = ?", (id_mat,))
                            stk_row = cursor.fetchone()
                            if stk_row is not None:
                                stk_ant = float(stk_row[0] or 0.0)
                                stk_post = round(max(0.0, stk_ant - delta), 2)
                                cursor.execute(
                                    "UPDATE dbo.stock_deposito SET stock_actual = ?, fecha_actualizacion = GETDATE() WHERE id_material = ?",
                                    (stk_post, id_mat),
                                )
                            else:
                                stk_ant = 0.0
                                stk_post = 0.0
                                cursor.execute(
                                    "INSERT INTO dbo.stock_deposito (id_material, stock_actual, fecha_actualizacion) VALUES (?, 0.0, GETDATE())",
                                    (id_mat,),
                                )

                            cursor.execute(
                                """
                                INSERT INTO dbo.movimiento_stock (id_material, tipo, cantidad, stock_anterior, stock_posterior, id_pedido, id_remito, id_usuario, fecha, observacion)
                                VALUES (?, 'egreso_pedido', ?, ?, ?, ?, ?, ?, GETDATE(), ?)
                                """,
                                (id_mat, delta, stk_ant, stk_post, id_pedido, id_remito_generado, user_id_final, f"Entrega #{seq} pedido #{id_pedido} a {sector_pedido} (Transferencia CL2 -> Planta)"),
                            )

                        cursor.execute(
                            """
                            SELECT TOP 1 CAST(COALESCE(rsa.stock_ajustado, sd.stock_planta, rpm.stock_inicial_planta, 0.0) AS FLOAT)
                            FROM dbo.material m
                            LEFT JOIN dbo.stock_deposito sd ON m.id_material = sd.id_material
                            LEFT JOIN dbo.rundown_parametro_material rpm ON m.id_material = rpm.id_material AND rpm.activo = 1
                            OUTER APPLY (
                                SELECT TOP 1 stock_ajustado
                                FROM dbo.rundown_stock_ajuste rsa
                                WHERE rsa.id_material = m.id_material AND rsa.tipo_stock = 'planta'
                                ORDER BY rsa.fecha DESC, rsa.fecha_creacion DESC
                            ) rsa
                            WHERE m.id_material = ?
                            """,
                            (id_mat,),
                        )
                        pl_row = cursor.fetchone()
                        pl_ant = float(pl_row[0] or 0.0) if pl_row and pl_row[0] is not None else 0.0
                        pl_post = round(pl_ant + delta, 2)

                        cursor.execute(
                            """
                            MERGE dbo.stock_deposito AS target
                            USING (SELECT ? AS id_material, ? AS delta) AS source
                            ON (target.id_material = source.id_material)
                            WHEN MATCHED THEN
                                UPDATE SET stock_planta = target.stock_planta + source.delta, fecha_actualizacion = GETDATE()
                            WHEN NOT MATCHED THEN
                                INSERT (id_material, stock_actual, stock_planta, stock_warehouse, fecha_actualizacion)
                                VALUES (source.id_material, 0.0, source.delta, 0.0, GETDATE());
                            """,
                            (id_mat, delta),
                        )

                        cursor.execute(
                            """
                            INSERT INTO dbo.movimiento_stock (id_material, tipo, cantidad, stock_anterior, stock_posterior, id_pedido, id_remito, id_usuario, fecha, observacion)
                            VALUES (?, 'ingreso_pedido', ?, ?, ?, ?, ?, ?, GETDATE(), ?)
                            """,
                            (id_mat, delta, pl_ant, pl_post, id_pedido, id_remito_generado, user_id_final, f"Recepción en Planta #{seq} pedido #{id_pedido} (Remito {id_remito_generado})"),
                        )

                cursor.execute(
                    "SELECT COUNT(*) FROM dbo.material_pedido WHERE id_pedido = ? AND ISNULL(cantidad_entregada, 0.0) < cantidad_pedida",
                    (id_pedido,),
                )
                incompletos = cursor.fetchone()[0]
                nuevo_estado = "completo" if incompletos == 0 else "parcial"

                cursor.execute(
                    """
                    UPDATE dbo.pedido
                    SET estado = ?, fecha_despacho = GETDATE(),
                        fecha_entrega = (CASE WHEN ? = 'completo' THEN GETDATE() ELSE fecha_entrega END),
                        comentario = COALESCE(?, comentario)
                    WHERE id_pedido = ?
                    """,
                    (nuevo_estado, nuevo_estado, comentario, id_pedido),
                )

            conn.commit()
            pedido_actualizado = self.get_pedido_by_id(id_pedido)
            return pedido_actualizado, id_remito_generado
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def cancelar_pedido(
        self, id_pedido: int, motivo: str, id_usuario: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT estado, comentario FROM dbo.pedido WHERE id_pedido = ?",
                (id_pedido,),
            )
            row = cursor.fetchone()
            if not row:
                return None

            estado_actual = str(row[0]).lower()
            comentario_actual = str(row[1] or "")

            if estado_actual == "cancelado":
                raise ValueError("El pedido ya se encuentra cancelado")
            if estado_actual == "completo":
                raise ValueError("No se puede cancelar un pedido que ya fue completado y entregado")

            user_str = ""
            if id_usuario:
                cursor.execute(
                    "SELECT LTRIM(RTRIM(CONCAT(ISNULL(nombre, ''), ' ', ISNULL(apellido, '')))) FROM dbo.usuario WHERE id_usuario = ?",
                    (id_usuario,),
                )
                urow = cursor.fetchone()
                if urow and urow[0]:
                    user_str = f" por {urow[0]}"

            now_str = get_argentina_now().strftime("%d/%m/%Y %H:%M")
            nota = f"[CANCELADO{user_str} el {now_str}]: {motivo.strip()}"
            nuevo_comentario = f"{comentario_actual}\n{nota}".strip() if comentario_actual else nota

            cursor.execute(
                """
                UPDATE dbo.pedido
                SET estado = 'cancelado',
                    comentario = ?
                WHERE id_pedido = ?
                """,
                (nuevo_comentario, id_pedido),
            )

            cursor.execute(
                """
                UPDATE dbo.material_pedido
                SET estado = 'cancelado',
                    cantidad_preparada = ISNULL(cantidad_entregada, 0.0)
                WHERE id_pedido = ? AND estado != 'completo'
                """,
                (id_pedido,),
            )

            cursor.execute(
                """
                INSERT INTO dbo.auditoria (entidad, id_entidad, tipo_evento, id_usuario, fecha, detalle)
                VALUES ('pedido', ?, 'ajuste', ?, GETDATE(), ?)
                """,
                (str(id_pedido), id_usuario, f"Pedido cancelado — Motivo: {motivo.strip()}"),
            )

            conn.commit()
            return self.get_pedido_by_id(id_pedido)
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def get_config_valor(self, clave: str, default: str = "") -> str:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT valor FROM dbo.configuracion_sistema WHERE clave = ?",
                (clave,),
            )
            row = cursor.fetchone()
            return str(row[0]) if row and row[0] is not None else default
        except Exception:
            return default
        finally:
            cursor.close()
            conn.close()

    def set_config_valor(self, clave: str, valor: str, descripcion: Optional[str] = None) -> None:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                MERGE dbo.configuracion_sistema AS target
                USING (SELECT ? AS clave, ? AS valor, ? AS descripcion) AS source
                ON (target.clave = source.clave)
                WHEN MATCHED THEN
                    UPDATE SET valor = source.valor, 
                               descripcion = COALESCE(source.descripcion, target.descripcion),
                               fecha_actualizacion = SYSDATETIME()
                WHEN NOT MATCHED THEN
                    INSERT (clave, valor, descripcion, fecha_actualizacion)
                    VALUES (source.clave, source.valor, source.descripcion, SYSDATETIME());
                """,
                (clave, valor, descripcion),
            )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

