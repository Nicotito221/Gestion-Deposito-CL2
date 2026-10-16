import json
import logging
from typing import Any, Dict, List, Optional
import urllib.request
import urllib.error

from app.core.config import CL2_SYNC_ENABLED, CL2_API_URL, CL2_API_KEY
from app.core.config import get_db_connection

logger = logging.getLogger(__name__)


class Cl2SyncService:
    def __init__(self) -> None:
        self.enabled: bool = CL2_SYNC_ENABLED
        self.base_url: str = CL2_API_URL.rstrip("/") if CL2_API_URL else ""
        self.api_key: str = CL2_API_KEY

    def _headers(self) -> Dict[str, str]:
        return {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
        }

    def _post(self, table: str, payload: Any) -> bool:
        if not self.enabled or not self.base_url or not self.api_key:
            return False

        url = f"{self.base_url}/rest/v1/{table}"
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=self._headers(), method="POST")

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                return response.status in (200, 201, 204)
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8", errors="ignore")
            logger.error("Error sincronizando a nodo CL2 [%s]: %s - %s", table, e.code, err_msg)
            return False
        except Exception as ex:
            logger.error("Fallo de red en sincronizacion CL2 [%s]: %s", table, str(ex))
            return False

    def enqueue_outbox(
        self,
        aggregate_type: str,
        aggregate_id: str,
        event_type: str,
        payload: Dict[str, Any],
    ) -> None:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            payload_json = json.dumps(payload, default=str)
            cursor.execute(
                """
                INSERT INTO dbo.SyncOutbox (
                    AggregateType, AggregateId, EventType, PayloadJson, Status
                )
                VALUES (?, ?, ?, ?, 'PENDING')
                """,
                aggregate_type,
                str(aggregate_id),
                event_type,
                payload_json,
            )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def sync_pedido_creado(self, pedido_data: Dict[str, Any]) -> None:
        if not self.enabled:
            return

        p_row = {
            "id_pedido": pedido_data["id_pedido"],
            "sector": pedido_data["sector"],
            "prioridad": pedido_data["prioridad"],
            "origen": pedido_data["origen"],
            "estado": pedido_data["estado"],
            "fecha_creacion": str(pedido_data["fecha_creacion"]),
            "fecha_requerida": str(pedido_data["fecha_requerida"]) if pedido_data.get("fecha_requerida") else None,
            "turno": pedido_data.get("turno"),
            "comentario": pedido_data.get("comentario"),
        }
        items_rows = [
            {
                "id_pedido": pedido_data["id_pedido"],
                "id_material": it["id_material"],
                "nombre_material": it.get("nombre_material") or it["id_material"],
                "unidad": it.get("unidad") or "UN",
                "cantidad_pedida": float(it["cantidad_pedida"]),
                "cantidad_preparada": float(it.get("cantidad_preparada") or 0.0),
                "cantidad_entregada": float(it.get("cantidad_entregada") or 0.0),
                "tipo_empaque": it.get("tipo_empaque") or "unidad",
                "tamanio_lote": float(it.get("tamanio_lote") or 1.0),
                "bultos_por_pallet": it.get("bultos_por_pallet"),
                "unidad_por_bulto": it.get("unidad_por_bulto"),
                "cantidad_pallets": it.get("cantidad_pallets"),
                "cantidad_pallets_preparada": it.get("cantidad_pallets_preparada") or 0.0,
                "cantidad_pallets_entregada": it.get("cantidad_pallets_entregada") or 0.0,
                "cantidad_pallets_pendiente": it.get("cantidad_pallets_pendiente") if it.get("cantidad_pallets_pendiente") is not None else it.get("cantidad_pallets"),
                "estado": it.get("estado", "pendiente"),
                "comentario": it.get("comentario"),
            }
            for it in pedido_data.get("items", [])
        ]

        mat_rows = [
            {
                "id_material": it["id_material"],
                "nombre": it.get("nombre_material") or it["id_material"],
                "unidad_medida": it.get("unidad") or "UN",
                "activo": True,
            }
            for it in pedido_data.get("items", [])
            if it.get("id_material")
        ]

        try:
            if mat_rows:
                self._post("materiales_cl2", mat_rows)
            self._post("pedidos_cl2", p_row)
            if items_rows:
                self._post("pedidos_cl2_detalle", items_rows)
        except Exception as e:
            logger.error("Error al sincronizar pedido #%s a CL2: %s", pedido_data.get("id_pedido"), str(e))
            self.enqueue_outbox("pedido", str(pedido_data["id_pedido"]), "PEDIDO_CREADO", pedido_data)

    def sync_ingreso_creado(self, ingreso_data: Dict[str, Any]) -> None:
        if not self.enabled:
            return

        id_remito = str(ingreso_data.get("id_ingreso") or ingreso_data.get("numero_factura"))
        fe_raw = ingreso_data.get("fecha_emision")
        fecha_emision = fe_raw.isoformat() if hasattr(fe_raw, "isoformat") else (str(fe_raw) if fe_raw else None)
        fr_raw = ingreso_data.get("fecha_recepcion")
        fecha_recepcion = fr_raw.isoformat() if hasattr(fr_raw, "isoformat") else (str(fr_raw) if fr_raw else None)

        r_row: Dict[str, Any] = {
            "id_remito": id_remito,
            "numero_factura": ingreso_data.get("numero_factura"),
            "proveedor_nombre": ingreso_data.get("nombre_proveedor") or str(ingreso_data.get("id_proveedor")),
            "orden_compra": ingreso_data.get("orden_compra"),
            "estado": ingreso_data.get("estado", "pendiente"),
            "observacion": ingreso_data.get("observacion"),
            "operador_nombre": ingreso_data.get("usuario_creacion") or "Planta",
        }
        if fecha_emision:
            r_row["fecha_emision"] = fecha_emision
        if fecha_recepcion:
            r_row["fecha_recepcion"] = fecha_recepcion
        items_rows = [
            {
                "id_remito": id_remito,
                "id_material": it["id_material"],
                "nombre_material": it.get("nombre_material") or it["id_material"],
                "unidad": it.get("unidad", "UN"),
                "cantidad": float(it.get("cantidad_facturada") or it.get("cantidad") or 0.0),
                "cantidad_facturada": float(it.get("cantidad_facturada") or it.get("cantidad") or 0.0),
                "cantidad_recibida": float(it.get("cantidad_recibida")) if it.get("cantidad_recibida") is not None else None,
                "conforme": it.get("conforme", True),
                "observacion": it.get("observacion"),
            }
            for it in ingreso_data.get("items", [])
            if it.get("id_material")
        ]

        mat_rows = [
            {
                "id_material": it["id_material"],
                "nombre": it.get("nombre_material") or it["id_material"],
                "unidad_medida": it.get("unidad") or "UN",
                "activo": True,
            }
            for it in ingreso_data.get("items", [])
            if it.get("id_material")
        ]

        try:
            if mat_rows:
                self._post("materiales_cl2", mat_rows)
            self._post("remitos_cl2", r_row)
            if items_rows:
                self._post("remitos_cl2_detalle", items_rows)
        except Exception as e:
            logger.error("Error al sincronizar ingreso/remito #%s a CL2: %s", id_remito, str(e))

    def sync_ingresos_historicos_pendientes(self) -> None:
        if not self.enabled:
            return
        try:
            from app.repositories.ingreso_repository import IngresoRepository
            ingresos = IngresoRepository().get_ingresos(limit=50)
            for ing in ingresos:
                self.sync_ingreso_creado(ing)
        except Exception as ex:
            logger.error("Error al sincronizar ingresos historicos a CL2: %s", str(ex))

    def _get(self, table: str, params: str = "") -> Optional[List[Dict[str, Any]]]:
        if not self.enabled or not self.base_url or not self.api_key:
            return None

        url = f"{self.base_url}/rest/v1/{table}?{params}"
        req = urllib.request.Request(url, headers=self._headers(), method="GET")
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    raw = response.read().decode("utf-8")
                    return json.loads(raw)
        except Exception as ex:
            logger.error("Error consultando nodo CL2 [%s]: %s", table, str(ex))
        return None

    def sync_remito_pedido(self, pedido_data: Dict[str, Any]) -> None:
        if not self.enabled:
            return
        try:
            self.sync_pedido_creado(pedido_data)
            for rem in pedido_data.get("remitos", []):
                id_rem = str(rem["id_remito"])
                fe_raw = rem.get("fecha_emision")
                fe_str = fe_raw.isoformat() if hasattr(fe_raw, "isoformat") else (str(fe_raw) if fe_raw else None)
                fent_raw = rem.get("fecha_entrega")
                fent_str = fent_raw.isoformat() if hasattr(fent_raw, "isoformat") else (str(fent_raw) if fent_raw else None)

                r_row: Dict[str, Any] = {
                    "id_remito": id_rem,
                    "id_pedido": int(pedido_data["id_pedido"]),
                    "estado": rem.get("estado", "emitido"),
                    "operador_nombre": rem.get("usuario_emisor") or "Depósito",
                    "observacion": rem.get("observacion"),
                }
                if fe_str:
                    r_row["fecha_emision"] = fe_str
                if fent_str:
                    r_row["fecha_entrega"] = fent_str

                self._post("remitos_cl2", r_row)

                r_items = [
                    {
                        "id_remito": id_rem,
                        "id_material": m["id_material"],
                        "nombre_material": m.get("nombre_material") or m["id_material"],
                        "unidad": m.get("unidad", "UN"),
                        "cantidad": float(m.get("cantidad") or 0.0),
                        "cantidad_facturada": float(m.get("cantidad") or 0.0),
                        "cantidad_recibida": float(m.get("cantidad") or 0.0),
                        "conforme": True,
                    }
                    for m in rem.get("items", [])
                    if m.get("id_material")
                ]
                if r_items:
                    self._post("remitos_cl2_detalle", r_items)
        except Exception as ex:
            logger.error("Error sincronizando remito de pedido a CL2: %s", str(ex))

    def pull_updates_from_cl2(self) -> None:
        if not self.enabled:
            return

        ingresos_remotos = self._get(
            "remitos_cl2",
            "select=*,remitos_cl2_detalle(*)&id_pedido=is.null&estado=in.(parcial,completo)"
        )
        if ingresos_remotos:
            from app.repositories.ingreso_repository import IngresoRepository
            from app.schemas.ingreso import IngresoConfirmarRecepcion, IngresoRecepcionItem
            ing_repo = IngresoRepository()
            for rem_ing in ingresos_remotos:
                raw_id = str(rem_ing.get("id_remito") or "").strip()
                nro_fac = str(rem_ing.get("numero_factura") or raw_id).strip()
                try:
                    conn_i = get_db_connection()
                    try:
                        cur_i = conn_i.cursor()
                        if raw_id.isdigit():
                            cur_i.execute(
                                "SELECT id_ingreso, estado FROM dbo.ingreso_material WHERE id_ingreso = ?",
                                (int(raw_id),),
                            )
                        else:
                            cur_i.execute(
                                "SELECT id_ingreso, estado FROM dbo.ingreso_material WHERE numero_factura = ?",
                                (nro_fac,),
                            )
                        i_row = cur_i.fetchone()
                    finally:
                        conn_i.close()

                    if i_row and str(i_row[1]).lower() == "pendiente":
                        id_ing_local = int(i_row[0])
                        det_list = rem_ing.get("remitos_cl2_detalle") or []
                        rec_items = [
                            IngresoRecepcionItem(
                                id_material=str(it["id_material"]),
                                cantidad_recibida=float(
                                    it.get("cantidad_recibida")
                                    if it.get("cantidad_recibida") is not None
                                    else (it.get("cantidad_facturada") or it.get("cantidad") or 0.0)
                                ),
                                conforme=bool(it.get("conforme", True)),
                                observacion=it.get("observacion"),
                            )
                            for it in det_list
                            if it.get("id_material")
                        ]
                        if rec_items:
                            ing_repo.confirmar_recepcion(
                                id_ingreso=id_ing_local,
                                data=IngresoConfirmarRecepcion(
                                    observacion=rem_ing.get("observacion"),
                                    items=rec_items,
                                ),
                            )
                except Exception as ex_i:
                    logger.error("Error sincronizando recepcion de ingreso desde CL2 [%s]: %s", raw_id, str(ex_i))

        pedidos_remotos = self._get(
            "pedidos_cl2",
            "select=id_pedido,estado,preparado_por_nombre,fecha_despacho,fecha_entrega,pedidos_cl2_detalle(id_material,cantidad_preparada,cantidad_entregada,cantidad_pallets_preparada,estado)&estado=in.(en_preparacion,completo,parcial)"
        )
        remitos_pedidos = (
            self._get(
                "remitos_cl2",
                "select=*,remitos_cl2_detalle(*)&id_pedido=not.is.null"
            )
            or []
        )

        if pedidos_remotos:
            conn = get_db_connection()
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT TOP 1 id_usuario FROM dbo.usuario WHERE activo = 1 ORDER BY id_usuario ASC")
                u_row = cursor.fetchone()
                default_user_id = int(u_row[0]) if u_row else 1

                for p in pedidos_remotos:
                    id_pedido = int(p["id_pedido"])
                    estado_remoto = str(p["estado"])

                    cursor.execute("SELECT estado FROM dbo.pedido WHERE id_pedido = ?", (id_pedido,))
                    row = cursor.fetchone()
                    if row:
                        cursor.execute(
                            """
                            UPDATE dbo.pedido
                            SET estado = ?,
                                fecha_despacho = CASE WHEN ? IN ('completo', 'parcial') THEN COALESCE(fecha_despacho, GETDATE()) ELSE fecha_despacho END,
                                fecha_entrega = CASE WHEN ? = 'completo' THEN COALESCE(fecha_entrega, GETDATE()) ELSE fecha_entrega END
                            WHERE id_pedido = ?
                            """,
                            (estado_remoto, estado_remoto, estado_remoto, id_pedido),
                        )
                        detalles = p.get("pedidos_cl2_detalle") or []
                        for d in detalles:
                            c_prep = float(d.get("cantidad_preparada") or 0.0)
                            c_ent = float(d.get("cantidad_entregada") or (c_prep if estado_remoto in ("completo", "parcial") else 0.0))
                            cursor.execute(
                                """
                                UPDATE dbo.material_pedido
                                SET cantidad_preparada = ?,
                                    cantidad_entregada = CASE WHEN ? > ISNULL(cantidad_entregada, 0) THEN ? ELSE ISNULL(cantidad_entregada, 0) END,
                                    estado = ?
                                WHERE id_pedido = ? AND id_material = ?
                                """,
                                (
                                    c_prep,
                                    c_ent,
                                    c_ent,
                                    d.get("estado") or estado_remoto,
                                    id_pedido,
                                    d["id_material"],
                                ),
                            )

                        for rem in [r for r in remitos_pedidos if r.get("id_pedido") == id_pedido]:
                            id_rem = str(rem["id_remito"])
                            cursor.execute("SELECT 1 FROM dbo.remito WHERE id_remito = ?", (id_rem,))
                            if not cursor.fetchone():
                                cursor.execute(
                                    """
                                    INSERT INTO dbo.remito (id_remito, id_pedido, fecha_emision, fecha_entrega, estado, id_usuario_emisor, observacion)
                                    VALUES (?, ?, GETDATE(), GETDATE(), ?, ?, ?)
                                    """,
                                    (
                                        id_rem,
                                        id_pedido,
                                        rem.get("estado") or "emitido",
                                        default_user_id,
                                        rem.get("observacion"),
                                    ),
                                )
                                for mr in rem.get("remitos_cl2_detalle") or []:
                                    cant_mr = float(mr.get("cantidad") or 0.0)
                                    if cant_mr > 0 and mr.get("id_material"):
                                        cursor.execute(
                                            "INSERT INTO dbo.material_remito (id_remito, id_material, cantidad) VALUES (?, ?, ?)",
                                            (id_rem, str(mr["id_material"]), cant_mr),
                                        )
                conn.commit()
            except Exception as e:
                conn.rollback()
                logger.error("Error actualizando estados desde nodo CL2: %s", str(e))
            finally:
                conn.close()

        self.sync_ingresos_historicos_pendientes()


