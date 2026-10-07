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
                "cantidad_pedida": float(it["cantidad_pedida"]),
                "cantidad_preparada": float(it.get("cantidad_preparada") or 0.0),
                "cantidad_entregada": float(it.get("cantidad_entregada") or 0.0),
                "estado": it.get("estado", "pendiente"),
                "comentario": it.get("comentario"),
            }
            for it in pedido_data.get("items", [])
        ]

        try:
            self._post("pedidos_cl2", p_row)
            if items_rows:
                self._post("pedidos_cl2_detalle", items_rows)
        except Exception as e:
            logger.error("Error al sincronizar pedido #%s a CL2: %s", pedido_data.get("id_pedido"), str(e))
            self.enqueue_outbox("pedido", str(pedido_data["id_pedido"]), "PEDIDO_CREADO", pedido_data)
