from typing import Optional
from fastapi import APIRouter, Depends, Query

from app.schemas.auditoria import AuditListResponse
from app.services.auditoria_service import AuditoriaService

router = APIRouter(prefix="/api/auditoria", tags=["Auditoría"])
_service = AuditoriaService()


def get_auditoria_service() -> AuditoriaService:
    return _service


@router.get("/pedidos", response_model=AuditListResponse)
def listar_trazabilidad_pedidos(
    search: Optional[str] = Query(default=None, description="Filtro de búsqueda por N.º de pedido o sector"),
    sector: Optional[str] = Query(default=None, description="Filtro por sector"),
    estado: Optional[str] = Query(default=None, description="Filtro por estado de pedido"),
    limit: int = Query(default=100, ge=1, le=500),
    service: AuditoriaService = Depends(get_auditoria_service),
) -> AuditListResponse:
    return service.get_pedidos_trazabilidad(
        search=search,
        sector=sector,
        estado=estado,
        limit=limit,
    )
