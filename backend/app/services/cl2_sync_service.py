import json
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from typing import Any, Callable, Dict, List, Optional
import urllib.request
import urllib.error

from app.core.config import CL2_SYNC_ENABLED, CL2_API_URL, CL2_API_KEY
from app.core.config import get_db_connection
from app.core.time import get_argentina_now_naive

logger = logging.getLogger(__name__)

_EJECUTOR_ENVIOS = ThreadPoolExecutor(max_workers=1, thread_name_prefix="cl2-sync")
MAX_LARGO_ID_REMITO = 50
REINTENTO_BASE_MINUTOS = 5
REINTENTO_MAX_MINUTOS = 240
LOTE_OUTBOX = 50

ESTADOS_REMITO_LOCAL = {
    "anulado": "anulado",
    "cancelado": "anulado",
    "entregado": "entregado",
    "completo": "entregado",
}


def _iso(valor: Any) -> Optional[str]:
    if not valor:
        return None
    return valor.isoformat() if hasattr(valor, "isoformat") else str(valor)


def _estado_remito_local(estado_remoto: Optional[str]) -> str:
    return ESTADOS_REMITO_LOCAL.get(str(estado_remoto or "").strip().lower(), "emitido")


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

    def _configurado(self) -> bool:
        return bool(self.enabled and self.base_url and self.api_key)

    def _post(self, table: str, payload: Any) -> bool:
        if not self._configurado():
            return False

        url = f"{self.base_url}/rest/v1/{table}"
        data = json.dumps(payload, default=str).encode("utf-8")
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

    def _get(self, table: str, params: str = "") -> Optional[List[Dict[str, Any]]]:
        if not self._configurado():
            return None

        url = f"{self.base_url}/rest/v1/{table}?{params}"
        req = urllib.request.Request(url, headers=self._headers(), method="GET")
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    return json.loads(response.read().decode("utf-8"))
        except Exception as ex:
            logger.error("Error consultando nodo CL2 [%s]: %s", table, str(ex))
        return None

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
            cursor.execute(
                """
                INSERT INTO dbo.SyncOutbox (AggregateType, AggregateId, EventType, PayloadJson, Status, NextRetryAt)
                VALUES (?, ?, ?, ?, 'PENDING', ?)
                """,
                aggregate_type,
                str(aggregate_id),
                event_type,
                json.dumps(payload, default=str),
                get_argentina_now_naive() + timedelta(minutes=REINTENTO_BASE_MINUTOS),
            )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _enviar_o_encolar(
        self, aggregate_type: str, aggregate_id: str, event_type: str, payload: Dict[str, Any], envio: Callable[[Dict[str, Any]], bool]
    ) -> None:
        try:
            ok = envio(payload)
        except Exception as ex:
            logger.error("Error enviando %s #%s a CL2: %s", event_type, aggregate_id, ex)
            ok = False
        if not ok:
            try:
                self.enqueue_outbox(aggregate_type, aggregate_id, event_type, payload)
            except Exception as ex:
                logger.error("No se pudo encolar %s #%s en SyncOutbox: %s", event_type, aggregate_id, ex)

    def _programar(self, aggregate_type: str, aggregate_id: str, event_type: str, payload: Dict[str, Any], envio: Callable[[Dict[str, Any]], bool]) -> None:
        if not self.enabled:
            return
        _EJECUTOR_ENVIOS.submit(self._enviar_o_encolar, aggregate_type, aggregate_id, event_type, payload, envio)

    def _filas_materiales(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [
            {
                "id_material": it["id_material"],
                "nombre": it.get("nombre_material") or it["id_material"],
                "unidad_medida": it.get("unidad") or "UN",
                "activo": True,
            }
            for it in items
            if it.get("id_material")
        ]

    def _enviar_pedido(self, pedido_data: Dict[str, Any]) -> bool:
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
        items = pedido_data.get("items", [])
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
            for it in items
        ]
        mat_rows = self._filas_materiales(items)
        ok = True
        if mat_rows:
            ok = self._post("materiales_cl2", mat_rows) and ok
        ok = self._post("pedidos_cl2", p_row) and ok
        if items_rows:
            ok = self._post("pedidos_cl2_detalle", items_rows) and ok
        return ok

    def _enviar_ingreso(self, ingreso_data: Dict[str, Any], incluir_recepcion: bool = True) -> bool:
        id_remito = str(ingreso_data.get("id_ingreso") or ingreso_data.get("numero_factura"))
        r_row: Dict[str, Any] = {
            "id_remito": id_remito,
            "numero_factura": ingreso_data.get("numero_factura"),
            "proveedor_nombre": ingreso_data.get("nombre_proveedor") or str(ingreso_data.get("id_proveedor")),
            "orden_compra": ingreso_data.get("orden_compra"),
            "observacion": ingreso_data.get("observacion"),
            "operador_nombre": ingreso_data.get("usuario_creacion") or "Planta",
        }
        if incluir_recepcion:
            r_row["estado"] = ingreso_data.get("estado", "pendiente")
        fecha_emision = _iso(ingreso_data.get("fecha_emision"))
        fecha_recepcion = _iso(ingreso_data.get("fecha_recepcion"))
        if fecha_emision:
            r_row["fecha_emision"] = fecha_emision
        if fecha_recepcion and incluir_recepcion:
            r_row["fecha_recepcion"] = fecha_recepcion

        items = ingreso_data.get("items", [])
        items_rows = []
        for it in items:
            if not it.get("id_material"):
                continue
            fila: Dict[str, Any] = {
                "id_remito": id_remito,
                "id_material": it["id_material"],
                "nombre_material": it.get("nombre_material") or it["id_material"],
                "unidad": it.get("unidad", "UN"),
                "cantidad": float(it.get("cantidad_facturada") or it.get("cantidad") or 0.0),
                "cantidad_facturada": float(it.get("cantidad_facturada") or it.get("cantidad") or 0.0),
            }
            if incluir_recepcion:
                fila["cantidad_recibida"] = float(it["cantidad_recibida"]) if it.get("cantidad_recibida") is not None else None
                fila["conforme"] = it.get("conforme", True)
                fila["observacion"] = it.get("observacion")
            items_rows.append(fila)

        mat_rows = self._filas_materiales(items)
        ok = True
        if mat_rows:
            ok = self._post("materiales_cl2", mat_rows) and ok
        ok = self._post("remitos_cl2", r_row) and ok
        if items_rows:
            ok = self._post("remitos_cl2_detalle", items_rows) and ok
        return ok

    def _enviar_remitos_pedido(self, pedido_data: Dict[str, Any]) -> bool:
        ok = self._enviar_pedido(pedido_data)
        for rem in pedido_data.get("remitos", []):
            id_rem = str(rem["id_remito"])
            r_row: Dict[str, Any] = {
                "id_remito": id_rem,
                "id_pedido": int(pedido_data["id_pedido"]),
                "estado": rem.get("estado", "emitido"),
                "operador_nombre": rem.get("usuario_emisor") or "Depósito",
                "observacion": rem.get("observacion"),
            }
            fe_str = _iso(rem.get("fecha_emision"))
            fent_str = _iso(rem.get("fecha_entrega"))
            if fe_str:
                r_row["fecha_emision"] = fe_str
            if fent_str:
                r_row["fecha_entrega"] = fent_str
            ok = self._post("remitos_cl2", r_row) and ok

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
                ok = self._post("remitos_cl2_detalle", r_items) and ok
        return ok

    def sync_pedido_creado(self, pedido_data: Dict[str, Any]) -> None:
        self._programar("pedido", str(pedido_data.get("id_pedido")), "PEDIDO_CREADO", pedido_data, self._enviar_pedido)

    def sync_ingreso_creado(self, ingreso_data: Dict[str, Any]) -> None:
        id_ingreso = str(ingreso_data.get("id_ingreso") or ingreso_data.get("numero_factura"))
        self._programar("ingreso", id_ingreso, "INGRESO", ingreso_data, self._enviar_ingreso)

    def sync_remito_pedido(self, pedido_data: Dict[str, Any]) -> None:
        self._programar("pedido", str(pedido_data.get("id_pedido")), "REMITO_PEDIDO", pedido_data, self._enviar_remitos_pedido)

    def procesar_outbox(self) -> None:
        if not self._configurado():
            return
        envios: Dict[str, Callable[[Dict[str, Any]], bool]] = {
            "PEDIDO_CREADO": self._enviar_pedido,
            "INGRESO": self._enviar_ingreso,
            "REMITO_PEDIDO": self._enviar_remitos_pedido,
        }
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            ahora = get_argentina_now_naive()
            cursor.execute(
                """
                SELECT TOP (?) Id, EventType, PayloadJson, RetryCount, MaxRetries
                FROM dbo.SyncOutbox
                WHERE Status = 'PENDING' AND (NextRetryAt IS NULL OR NextRetryAt <= ?)
                ORDER BY CreatedAt
                """,
                (LOTE_OUTBOX, ahora),
            )
            pendientes = cursor.fetchall()
            for id_evento, tipo, payload_json, reintentos, max_reintentos in pendientes:
                envio = envios.get(str(tipo))
                error: Optional[str] = None
                try:
                    ok = bool(envio and envio(json.loads(payload_json)))
                    if not envio:
                        error = f"Tipo de evento desconocido: {tipo}"
                    elif not ok:
                        error = "El nodo CL2 rechazó o no respondió el envío"
                except Exception as ex:
                    ok = False
                    error = str(ex)[:1000]

                if ok:
                    cursor.execute(
                        "UPDATE dbo.SyncOutbox SET Status = 'DONE', ProcessedAt = ?, ErrorMessage = NULL WHERE Id = ?",
                        (get_argentina_now_naive(), id_evento),
                    )
                else:
                    nuevos = int(reintentos or 0) + 1
                    agotado = nuevos >= int(max_reintentos or 5)
                    espera = min(REINTENTO_BASE_MINUTOS * (2 ** nuevos), REINTENTO_MAX_MINUTOS)
                    cursor.execute(
                        """
                        UPDATE dbo.SyncOutbox
                        SET RetryCount = ?, Status = ?, NextRetryAt = ?, ErrorMessage = ?
                        WHERE Id = ?
                        """,
                        (
                            nuevos,
                            "FAILED" if agotado else "PENDING",
                            get_argentina_now_naive() + timedelta(minutes=espera),
                            error,
                            id_evento,
                        ),
                    )
                    if agotado:
                        logger.error("Evento %s (%s) agotó los reintentos hacia CL2: %s", id_evento, tipo, error)
                conn.commit()
        except Exception as ex:
            conn.rollback()
            logger.error("Error procesando SyncOutbox: %s", ex)
        finally:
            conn.close()

    def sync_ingresos_historicos_pendientes(self) -> None:
        if not self._configurado():
            return
        try:
            from app.repositories.ingreso_repository import IngresoRepository
            ingresos = IngresoRepository().get_ingresos(estado="pendiente", limit=50)
            for ing in ingresos:
                self._enviar_ingreso(ing, incluir_recepcion=False)
        except Exception as ex:
            logger.error("Error al sincronizar ingresos pendientes a CL2: %s", str(ex))

    def _aplicar_recepciones_ingresos(self) -> None:
        ingresos_remotos = self._get(
            "remitos_cl2",
            "select=*,remitos_cl2_detalle(*)&id_pedido=is.null&estado=in.(parcial,completo)"
        )
        if not ingresos_remotos:
            return
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
                        cur_i.execute("SELECT id_ingreso, estado FROM dbo.ingreso_material WHERE id_ingreso = ?", (int(raw_id),))
                    else:
                        cur_i.execute("SELECT id_ingreso, estado FROM dbo.ingreso_material WHERE numero_factura = ?", (nro_fac,))
                    i_row = cur_i.fetchone()
                finally:
                    conn_i.close()

                if not i_row or str(i_row[1]).lower() != "pendiente":
                    continue
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
                    for it in (rem_ing.get("remitos_cl2_detalle") or [])
                    if it.get("id_material")
                ]
                if rec_items:
                    ing_repo.confirmar_recepcion(
                        id_ingreso=int(i_row[0]),
                        data=IngresoConfirmarRecepcion(observacion=rem_ing.get("observacion"), items=rec_items),
                    )
            except Exception as ex_i:
                logger.error("Error sincronizando recepcion de ingreso desde CL2 [%s]: %s", raw_id, str(ex_i))

    def _aplicar_pedido_remoto(
        self,
        cursor: Any,
        p: Dict[str, Any],
        remitos_pedido: List[Dict[str, Any]],
        default_user_id: int,
    ) -> None:
        from app.repositories.pedido_repository import PedidoRepository

        id_pedido = int(p["id_pedido"])
        estado_remoto = str(p["estado"])

        cursor.execute("SELECT estado, sector FROM dbo.pedido WITH (UPDLOCK, HOLDLOCK) WHERE id_pedido = ?", (id_pedido,))
        row = cursor.fetchone()
        if not row:
            return
        estado_local = str(row[0] or "")
        sector_ped = str(row[1]) if row[1] else "Planta"
        if estado_local == "cancelado":
            logger.warning("CL2 informó avance del pedido #%s, que está cancelado en planta. Se ignora.", id_pedido)
            return

        if estado_local != "completo":
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
            for d in p.get("pedidos_cl2_detalle") or []:
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
                    (c_prep, c_ent, c_ent, d.get("estado") or estado_remoto, id_pedido, d["id_material"]),
                )

        ped_repo = PedidoRepository()
        for idx_rem, rem in enumerate(remitos_pedido, start=1):
            id_rem = str(rem["id_remito"])
            if len(id_rem) > MAX_LARGO_ID_REMITO:
                logger.error("Remito %s del pedido #%s supera %s caracteres; no se importa.", id_rem, id_pedido, MAX_LARGO_ID_REMITO)
                continue
            cursor.execute("SELECT 1 FROM dbo.remito WHERE id_remito = ?", (id_rem,))
            if cursor.fetchone():
                continue
            cursor.execute(
                """
                INSERT INTO dbo.remito (id_remito, id_pedido, fecha_emision, fecha_entrega, estado, id_usuario_emisor, observacion)
                VALUES (?, ?, GETDATE(), GETDATE(), ?, ?, ?)
                """,
                (id_rem, id_pedido, _estado_remito_local(rem.get("estado")), default_user_id, rem.get("observacion")),
            )
            for mr in rem.get("remitos_cl2_detalle") or []:
                cant_mr = float(mr.get("cantidad") or 0.0)
                if cant_mr <= 0 or not mr.get("id_material"):
                    continue
                mat_mr = str(mr["id_material"])
                cursor.execute(
                    "INSERT INTO dbo.material_remito (id_remito, id_material, cantidad) VALUES (?, ?, ?)",
                    (id_rem, mat_mr, cant_mr),
                )
                ped_repo.aplicar_transferencia_stock_remito_item(
                    cursor=cursor,
                    id_mat=mat_mr,
                    delta=cant_mr,
                    id_pedido=id_pedido,
                    id_remito=id_rem,
                    seq=idx_rem,
                    sector_pedido=sector_ped,
                    user_id_final=default_user_id,
                )

    def pull_updates_from_cl2(self) -> None:
        if not self.enabled:
            return

        self.procesar_outbox()
        self._aplicar_recepciones_ingresos()

        pedidos_remotos = self._get(
            "pedidos_cl2",
            "select=id_pedido,estado,preparado_por_nombre,fecha_despacho,fecha_entrega,pedidos_cl2_detalle(id_material,cantidad_preparada,cantidad_entregada,cantidad_pallets_preparada,estado)&estado=in.(en_preparacion,completo,parcial)"
        )
        remitos_pedidos = self._get("remitos_cl2", "select=*,remitos_cl2_detalle(*)&id_pedido=not.is.null") or []

        if pedidos_remotos:
            conn = get_db_connection()
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT TOP 1 id_usuario FROM dbo.usuario WHERE activo = 1 ORDER BY id_usuario ASC")
                u_row = cursor.fetchone()
                default_user_id = int(u_row[0]) if u_row else 1

                for p in pedidos_remotos:
                    id_pedido = int(p["id_pedido"])
                    try:
                        self._aplicar_pedido_remoto(
                            cursor,
                            p,
                            [r for r in remitos_pedidos if r.get("id_pedido") == id_pedido],
                            default_user_id,
                        )
                        conn.commit()
                    except Exception as e:
                        conn.rollback()
                        logger.error("Error aplicando el pedido #%s desde CL2: %s", id_pedido, str(e))
            finally:
                conn.close()

        self.sync_ingresos_historicos_pendientes()
