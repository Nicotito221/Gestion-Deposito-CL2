from typing import Any, Dict, List, Optional

from app.repositories.auditoria_repository import AuditoriaRepository
from app.schemas.auditoria import AuditListResponse, TraceEventOut, TraceOrderOut


class AuditoriaService:
    def __init__(self, repository: Optional[AuditoriaRepository] = None) -> None:
        self.repository = repository or AuditoriaRepository()

    def get_pedidos_trazabilidad(
        self,
        search: Optional[str] = None,
        sector: Optional[str] = None,
        estado: Optional[str] = None,
        limit: int = 100,
    ) -> AuditListResponse:
        raw_orders = self.repository.get_pedidos_trazabilidad(
            search=search,
            sector=sector,
            estado=estado,
            limit=limit,
        )

        orders_out: List[TraceOrderOut] = []
        for o in raw_orders:
            events_out: List[TraceEventOut] = [
                TraceEventOut(
                    timestamp=e["timestamp"],
                    action=e["action"],
                    user=e["user"],
                    role=e["role"],
                    detail=e["detail"],
                    type=e["type"],
                )
                for e in o.get("events", [])
            ]
            orders_out.append(
                TraceOrderOut(
                    id=o["id"],
                    number=o["number"],
                    sector=o["sector"],
                    status=o["status"],
                    events=events_out,
                )
            )

        return AuditListResponse(
            orders=orders_out,
            total_orders=len(orders_out),
        )
