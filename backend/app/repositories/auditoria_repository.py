from datetime import datetime
from typing import Any, Dict, List, Optional
import pyodbc

from app.core.config import get_db_connection
from app.core.time import get_argentina_now


class AuditoriaRepository:
    def __init__(self) -> None:
        self._get_connection = get_db_connection

    def registrar_evento(
        self,
        entidad: str,
        id_entidad: str,
        tipo_evento: str,
        id_usuario: Optional[int],
        detalle: str,
        cursor: Optional[pyodbc.Cursor] = None,
    ) -> None:
        own_conn = False
        conn = None
        if cursor is None:
            conn = self._get_connection()
            cursor = conn.cursor()
            own_conn = True

        try:
            now = get_argentina_now()
            cursor.execute(
                """
                INSERT INTO dbo.auditoria (entidad, id_entidad, tipo_evento, id_usuario, fecha, detalle)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (entidad, str(id_entidad), tipo_evento, id_usuario, now, detalle),
            )
            if own_conn and conn:
                conn.commit()
        except Exception:
            if own_conn and conn:
                conn.rollback()
            raise
        finally:
            if own_conn and conn:
                cursor.close()
                conn.close()

    def get_pedidos_trazabilidad(
        self,
        search: Optional[str] = None,
        sector: Optional[str] = None,
        estado: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            where_conditions = ["1=1"]
            params: List[Any] = []

            if sector and sector.upper() != "TODOS":
                where_conditions.append("p.sector = ?")
                params.append(sector)

            if estado and estado != "all":
                where_conditions.append("p.estado = ?")
                params.append(estado)

            if search:
                s_term = f"%{search.strip()}%"
                where_conditions.append(
                    "(CAST(p.id_pedido AS VARCHAR) LIKE ? OR RIGHT('000000' + CAST(p.id_pedido AS VARCHAR), 6) LIKE ? OR p.sector LIKE ?)"
                )
                params.extend([s_term, s_term, s_term])

            where_sql = " AND ".join(where_conditions)

            sql_pedidos = f"""
                SELECT p.id_pedido, p.sector, p.prioridad, p.origen, p.estado,
                       p.fecha_creacion, p.fecha_despacho, p.fecha_entrega, p.comentario,
                       p.id_usuario_solicitante,
                       u.nombre AS nombre_solicitante, u.apellido AS apellido_solicitante, u.rol AS rol_solicitante
                FROM dbo.pedido p
                LEFT JOIN dbo.usuario u ON p.id_usuario_solicitante = u.id_usuario
                WHERE {where_sql}
                ORDER BY p.id_pedido DESC
                OFFSET 0 ROWS FETCH NEXT ? ROWS ONLY
            """
            params.append(limit)
            cursor.execute(sql_pedidos, params)
            pedidos_rows = cursor.fetchall()

            if not pedidos_rows:
                return []

            order_ids = [int(r[0]) for r in pedidos_rows]
            placeholders = ",".join("?" for _ in order_ids)

            sql_items = f"""
                SELECT mp.id_pedido, mp.id_material, mp.cantidad_pedida,
                       mp.cantidad_preparada, mp.cantidad_entregada, mp.estado, mp.comentario,
                       ISNULL(m.unidad, 'UN') AS unidad
                FROM dbo.material_pedido mp
                LEFT JOIN dbo.material m ON mp.id_material = m.id_material
                WHERE mp.id_pedido IN ({placeholders})
                ORDER BY mp.id_pedido, mp.id_material
            """
            cursor.execute(sql_items, order_ids)
            items_by_order: Dict[int, List[Dict[str, Any]]] = {}
            for r in cursor.fetchall():
                pid = int(r[0])
                if pid not in items_by_order:
                    items_by_order[pid] = []
                items_by_order[pid].append({
                    "id_material": str(r[1]),
                    "cantidad_pedida": float(r[2] or 0.0),
                    "cantidad_preparada": float(r[3] or 0.0),
                    "cantidad_entregada": float(r[4] or 0.0),
                    "estado": str(r[5] or ""),
                    "comentario": str(r[6] or "") if r[6] else None,
                    "unidad": str(r[7] or "UN"),
                })

            sql_remitos = f"""
                SELECT r.id_remito, r.id_pedido, r.fecha_emision, r.fecha_entrega, r.estado,
                       r.id_usuario_emisor, u.nombre AS nombre_emisor, u.apellido AS apellido_emisor, u.rol AS rol_emisor,
                       r.observacion,
                       ISNULL((SELECT SUM(cantidad) FROM dbo.material_remito WHERE id_remito = r.id_remito), 0) AS total_unidades
                FROM dbo.remito r
                LEFT JOIN dbo.usuario u ON r.id_usuario_emisor = u.id_usuario
                WHERE r.id_pedido IN ({placeholders})
                ORDER BY r.id_pedido, r.fecha_emision ASC
            """
            cursor.execute(sql_remitos, order_ids)
            remitos_by_order: Dict[int, List[Dict[str, Any]]] = {}
            for r in cursor.fetchall():
                pid = int(r[1])
                if pid not in remitos_by_order:
                    remitos_by_order[pid] = []
                u_name = f"{r[6] or ''} {r[7] or ''}".strip() or "Operario depósito"
                remitos_by_order[pid].append({
                    "id_remito": str(r[0]),
                    "fecha_emision": r[2],
                    "fecha_entrega": r[3],
                    "estado": str(r[4] or "emitido"),
                    "id_usuario_emisor": int(r[5]) if r[5] is not None else None,
                    "usuario_emisor": u_name,
                    "rol_emisor": str(r[8] or "Operario depósito"),
                    "observacion": str(r[9] or "") if r[9] else None,
                    "total_unidades": float(r[10] or 0.0),
                })

            sql_audit = f"""
                SELECT a.id_evento, a.id_entidad, a.tipo_evento, a.fecha, a.detalle,
                       u.nombre AS nombre_user, u.apellido AS apellido_user, u.rol AS rol_user
                FROM dbo.auditoria a
                LEFT JOIN dbo.usuario u ON a.id_usuario = u.id_usuario
                WHERE a.entidad = 'pedido' AND a.id_entidad IN ({placeholders})
                ORDER BY a.fecha ASC
            """
            cursor.execute(sql_audit, [str(pid) for pid in order_ids])
            audit_by_order: Dict[int, List[Dict[str, Any]]] = {}
            for r in cursor.fetchall():
                try:
                    pid = int(r[1])
                except ValueError:
                    continue
                if pid not in audit_by_order:
                    audit_by_order[pid] = []
                u_name = f"{r[5] or ''} {r[6] or ''}".strip() or "Sistema"
                audit_by_order[pid].append({
                    "id_evento": int(r[0]),
                    "tipo_evento": str(r[2]),
                    "fecha": r[3],
                    "detalle": str(r[4] or ""),
                    "usuario": u_name,
                    "rol": str(r[7] or "Sistema"),
                })

            results: List[Dict[str, Any]] = []
            for row in pedidos_rows:
                p_id = int(row[0])
                p_sector = str(row[1] or "")
                p_prioridad = str(row[2] or "normal")
                p_origen = str(row[3] or "manual")
                p_estado = str(row[4] or "pendiente")
                p_f_creacion: Optional[datetime] = row[5]
                p_f_despacho: Optional[datetime] = row[6]
                p_comentario = str(row[8] or "") if row[8] else None

                u_sol_nombre = f"{row[10] or ''} {row[11] or ''}".strip()
                if not u_sol_nombre:
                    u_sol_nombre = "Solicitante"
                u_sol_rol = str(row[12] or "Solicitante")

                items = items_by_order.get(p_id, [])
                remitos = remitos_by_order.get(p_id, [])
                audit_logs = audit_by_order.get(p_id, [])

                events: List[Dict[str, Any]] = []

                if p_f_creacion:
                    ts_creacion = p_f_creacion.strftime("%d/%m/%Y %H:%M")
                    cant_mats = len(items)
                    mats_text = f"{cant_mats} material{'es' if cant_mats != 1 else ''}"
                    det_sol = f"Pedido de {mats_text} — prioridad {p_prioridad} ({p_origen})"
                    if p_comentario:
                        det_sol += f" — Observación: {p_comentario}"

                    events.append({
                        "timestamp": ts_creacion,
                        "action": "Pedido creado",
                        "user": u_sol_nombre,
                        "role": u_sol_rol,
                        "detail": det_sol,
                        "type": "solicitud",
                        "_raw_dt": p_f_creacion,
                    })

                has_custom_approval = any(a["tipo_evento"] == "aprobacion" for a in audit_logs)
                if not has_custom_approval and p_f_creacion:
                    events.append({
                        "timestamp": p_f_creacion.strftime("%d/%m/%Y %H:%M"),
                        "action": "Pedido validado",
                        "user": "Sistema",
                        "role": "Sistema / Validación",
                        "detail": "Ingreso y validación automática de pedido en cola",
                        "type": "aprobacion",
                        "_raw_dt": p_f_creacion,
                    })

                if p_estado in ("en_preparacion", "parcial", "completo") or p_f_despacho or remitos:
                    dt_prep = p_f_despacho or (remitos[0]["fecha_emision"] if remitos else p_f_creacion)
                    prep_user = remitos[0]["usuario_emisor"] if remitos else "Depósito CL2"
                    prep_role = remitos[0]["rol_emisor"] if remitos else "Operario depósito"

                    prep_det = f"Preparación de pedido #{p_id:06d} para sector {p_sector}"
                    if items:
                        prep_det += f" ({len(items)} líneas de materiales)"

                    events.append({
                        "timestamp": dt_prep.strftime("%d/%m/%Y %H:%M") if dt_prep else "",
                        "action": "Preparación en depósito",
                        "user": prep_user,
                        "role": prep_role,
                        "detail": prep_det,
                        "type": "preparacion",
                        "_raw_dt": dt_prep or p_f_creacion,
                    })

                for rem in remitos:
                    dt_rem: Optional[datetime] = rem["fecha_entrega"] or rem["fecha_emision"]
                    tot_u = rem["total_unidades"]
                    id_r = rem["id_remito"]
                    act_rem = "Entrega parcial confirmada" if p_estado == "parcial" else "Entrega confirmada"
                    det_rem = f"Recepción documentada. Remito {id_r} ({tot_u:g} unidades entregadas)."
                    if rem["observacion"]:
                        det_rem += f" {rem['observacion']}"

                    events.append({
                        "timestamp": dt_rem.strftime("%d/%m/%Y %H:%M") if dt_rem else "",
                        "action": act_rem,
                        "user": rem["usuario_emisor"],
                        "role": rem["rol_emisor"],
                        "detail": det_rem,
                        "type": "entrega",
                        "_raw_dt": dt_rem or p_f_creacion,
                    })

                for a_log in audit_logs:
                    dt_a: Optional[datetime] = a_log["fecha"]
                    t_ev = str(a_log["tipo_evento"]).lower()
                    if t_ev in ("despacho", "entrega"):
                        mapped_type = "entrega"
                    elif t_ev in ("solicitud", "aprobacion", "preparacion", "ajuste", "sistema"):
                        mapped_type = t_ev
                    else:
                        mapped_type = "sistema"
                    events.append({
                        "timestamp": dt_a.strftime("%d/%m/%Y %H:%M") if dt_a else "",
                        "action": a_log["detalle"].split("—")[0].strip() if "—" in a_log["detalle"] else f"Evento: {t_ev}",
                        "user": a_log["usuario"],
                        "role": a_log["role"] if "role" in a_log else a_log["rol"],
                        "detail": a_log["detalle"],
                        "type": mapped_type,
                        "_raw_dt": dt_a or p_f_creacion,
                    })

                events.sort(key=lambda x: x.get("_raw_dt") or datetime.min)
                for e in events:
                    e.pop("_raw_dt", None)

                results.append({
                    "id": str(p_id),
                    "number": f"{p_id:06d}",
                    "sector": p_sector,
                    "status": "en-preparacion" if p_estado == "en_preparacion" else p_estado,
                    "events": events,
                })

            return results
        finally:
            cursor.close()
            conn.close()
