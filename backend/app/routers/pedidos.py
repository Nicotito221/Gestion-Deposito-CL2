from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Header, Query, status

from app.core.security import verify_access_token
from app.schemas.pedido import (
    CalcularSugerenciaRequest,
    CalcularSugerenciaResponse,
    PedidoCreate,
    PedidoOut,
    PedidosListResponse,
)
from app.services.pedido_service import PedidoService

router = APIRouter(prefix="/api/pedidos", tags=["Pedidos"])
_service = PedidoService()


def get_pedido_service() -> PedidoService:
    return _service


def get_optional_token_payload(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split("Bearer ", 1)[1].strip()
    return verify_access_token(token)


@router.post("/calcular-sugerencia", response_model=CalcularSugerenciaResponse)
def calcular_sugerencia(
    request: CalcularSugerenciaRequest,
    service: PedidoService = Depends(get_pedido_service),
) -> CalcularSugerenciaResponse:
    return service.calcular_sugerencia(request)


@router.post("", response_model=PedidoOut, status_code=status.HTTP_201_CREATED)
def crear_pedido(
    data: PedidoCreate,
    token_data: Optional[dict] = Depends(get_optional_token_payload),
    service: PedidoService = Depends(get_pedido_service),
) -> PedidoOut:
    if token_data:
        user_sector = token_data.get("sector")
        if user_sector and user_sector != "TODOS":
            data.sector = user_sector
        if not data.id_usuario_solicitante:
            data.id_usuario_solicitante = token_data.get("id_usuario")

    return service.crear_pedido(data)


@router.post("/multiples", response_model=List[PedidoOut], status_code=status.HTTP_201_CREATED)
def crear_pedidos_multiples(
    pedidos: List[PedidoCreate],
    token_data: Optional[dict] = Depends(get_optional_token_payload),
    service: PedidoService = Depends(get_pedido_service),
) -> List[PedidoOut]:
    if token_data:
        user_sector = token_data.get("sector")
        user_id = token_data.get("id_usuario")
        for p in pedidos:
            if user_sector and user_sector != "TODOS":
                p.sector = user_sector
            if not p.id_usuario_solicitante:
                p.id_usuario_solicitante = user_id

    return service.crear_pedidos_multiples(pedidos)


@router.get("", response_model=PedidosListResponse)
def listar_pedidos(
    fecha_requerida: Optional[date] = Query(default=None, description="Filtrar por fecha requerida"),
    estado: Optional[str] = Query(default=None, description="Filtrar por estado"),
    turno: Optional[str] = Query(default=None, description="Filtrar por turno"),
    limit: int = Query(default=50, ge=1, le=200),
    service: PedidoService = Depends(get_pedido_service),
) -> PedidosListResponse:
    return service.get_pedidos(
        fecha_requerida=fecha_requerida,
        estado=estado,
        turno=turno,
        limit=limit,
    )


@router.get("/{id_pedido}", response_model=PedidoOut)
def obtener_pedido(
    id_pedido: int,
    service: PedidoService = Depends(get_pedido_service),
) -> PedidoOut:
    return service.get_pedido_by_id(id_pedido)
