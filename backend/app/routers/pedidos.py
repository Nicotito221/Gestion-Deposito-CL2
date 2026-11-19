from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth_deps import (
    ROLES_CONTEO,
    ROLES_DEPOSITO,
    ROLES_EDICION_PLANIFICACION,
    id_usuario_de,
    require_editor_planificacion,
    require_roles,
    require_user,
)
from app.schemas.pedido import (
    CalcularSugerenciaRequest,
    CalcularSugerenciaResponse,
    PedidoCancelarRequest,
    PedidoCreate,
    PedidoOut,
    PedidosListResponse,
    PreparacionPedidoResponse,
    PreparacionPedidoUpdate,
    ReglaSugerenciaConfigOut,
    ReglaSugerenciaConfigUpdate,
    RemitoDetalleOut,
)
from app.services.pedido_service import PedidoService

router = APIRouter(prefix="/api/pedidos", tags=["Pedidos"], dependencies=[Depends(require_user)])
require_solicitante = require_roles(ROLES_CONTEO, {"solicitante"})
require_deposito = require_roles(ROLES_DEPOSITO)
ROLES_CANCELACION = ROLES_EDICION_PLANIFICACION | ROLES_DEPOSITO
_service = PedidoService()


def get_pedido_service() -> PedidoService:
    return _service


@router.post("/calcular-sugerencia", response_model=CalcularSugerenciaResponse)
def calcular_sugerencia(
    request: CalcularSugerenciaRequest,
    service: PedidoService = Depends(get_pedido_service),
) -> CalcularSugerenciaResponse:
    return service.calcular_sugerencia(request)


@router.get("/regla-sugerencia", response_model=ReglaSugerenciaConfigOut)
def obtener_regla_sugerencia(
    service: PedidoService = Depends(get_pedido_service),
) -> ReglaSugerenciaConfigOut:
    return service.get_regla_sugerencia_config()


@router.put("/regla-sugerencia", response_model=ReglaSugerenciaConfigOut)
def actualizar_regla_sugerencia(
    data: ReglaSugerenciaConfigUpdate,
    _: dict = Depends(require_editor_planificacion),
    service: PedidoService = Depends(get_pedido_service),
) -> ReglaSugerenciaConfigOut:
    return service.update_regla_sugerencia_config(data)


@router.post("", response_model=PedidoOut, status_code=status.HTTP_201_CREATED)
def crear_pedido(
    data: PedidoCreate,
    token_data: dict = Depends(require_solicitante),
    service: PedidoService = Depends(get_pedido_service),
) -> PedidoOut:
    user_sector = token_data.get("sector")
    if user_sector and user_sector != "TODOS":
        data.sector = user_sector
    data.id_usuario_solicitante = id_usuario_de(token_data)
    return service.crear_pedido(data)


@router.post("/multiples", response_model=List[PedidoOut], status_code=status.HTTP_201_CREATED)
def crear_pedidos_multiples(
    pedidos: List[PedidoCreate],
    token_data: dict = Depends(require_solicitante),
    service: PedidoService = Depends(get_pedido_service),
) -> List[PedidoOut]:
    user_sector = token_data.get("sector")
    user_id = id_usuario_de(token_data)
    for p in pedidos:
        if user_sector and user_sector != "TODOS":
            p.sector = user_sector
        p.id_usuario_solicitante = user_id
    return service.crear_pedidos_multiples(pedidos)


@router.get("", response_model=PedidosListResponse)
def listar_pedidos(
    fecha_requerida: Optional[date] = Query(default=None, description="Filtrar por fecha requerida"),
    estado: Optional[str] = Query(default=None, description="Filtrar por estado"),
    turno: Optional[str] = Query(default=None, description="Filtrar por turno"),
    sector: Optional[str] = Query(default=None, description="Filtrar por sector solicitante"),
    limit: int = Query(default=50, ge=1, le=200),
    service: PedidoService = Depends(get_pedido_service),
) -> PedidosListResponse:
    return service.get_pedidos(
        fecha_requerida=fecha_requerida,
        estado=estado,
        turno=turno,
        sector=sector,
        limit=limit,
    )


@router.get("/remitos/{id_remito}", response_model=RemitoDetalleOut)
def obtener_remito(
    id_remito: str,
    service: PedidoService = Depends(get_pedido_service),
) -> RemitoDetalleOut:
    return service.get_remito_by_id(id_remito)


@router.get("/{id_pedido}/remitos", response_model=List[RemitoDetalleOut])
def listar_remitos_pedido(
    id_pedido: int,
    service: PedidoService = Depends(get_pedido_service),
) -> List[RemitoDetalleOut]:
    return service.get_remitos_by_pedido(id_pedido)


@router.get("/{id_pedido}", response_model=PedidoOut)
def obtener_pedido(
    id_pedido: int,
    service: PedidoService = Depends(get_pedido_service),
) -> PedidoOut:
    return service.get_pedido_by_id(id_pedido)


@router.put("/{id_pedido}/preparacion", response_model=PreparacionPedidoResponse)
def actualizar_preparacion_pedido(
    id_pedido: int,
    data: PreparacionPedidoUpdate,
    token_data: dict = Depends(require_deposito),
    service: PedidoService = Depends(get_pedido_service),
) -> PreparacionPedidoResponse:
    return service.actualizar_preparacion(id_pedido, data, id_usuario_de(token_data))


@router.post("/{id_pedido}/cancelar", response_model=PedidoOut)
def cancelar_pedido(
    id_pedido: int,
    data: PedidoCancelarRequest,
    token_data: dict = Depends(require_user),
    service: PedidoService = Depends(get_pedido_service),
) -> PedidoOut:
    id_usuario = id_usuario_de(token_data)
    rol = str(token_data.get("rol", "")).lower()
    if rol not in ROLES_CANCELACION:
        pedido = service.get_pedido_by_id(id_pedido)
        if pedido.id_usuario_solicitante != id_usuario:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo quien solicitó el pedido, planificación o depósito pueden cancelarlo.",
            )
    return service.cancelar_pedido(id_pedido, data.motivo, id_usuario)

