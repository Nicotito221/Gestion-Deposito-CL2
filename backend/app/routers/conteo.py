from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status

from app.schemas.conteo import (
    ConteoCreateRequest,
    ConteoHistoricoResponse,
    ConteoMaterialSearchItem,
    ConteoResponse,
)
from app.services.conteo_service import ConteoService

router = APIRouter(prefix="/api/conteo", tags=["Conteo de Planta"])


def get_conteo_service() -> ConteoService:
    return ConteoService()


@router.get(
    "/materiales",
    response_model=List[ConteoMaterialSearchItem],
    summary="Buscar materiales con stock teórico para planilla de conteo",
)
def search_materiales_para_conteo(
    search: Optional[str] = Query(None, description="Término de búsqueda por código o nombre"),
    id_proveedor: Optional[int] = Query(None, description="Filtro opcional por ID de proveedor"),
    target_date: Optional[date] = Query(None, description="Fecha de impacto del conteo (por defecto ayer UTC-3)"),
    limit: int = Query(50, ge=1, le=200, description="Límite de resultados"),
    service: ConteoService = Depends(get_conteo_service),
) -> List[ConteoMaterialSearchItem]:
    return service.search_materiales(
        search=search,
        id_proveedor=id_proveedor,
        target_date=target_date,
        limit=limit,
    )


@router.post(
    "",
    response_model=ConteoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar sesión de conteo físico y sincronizar Rundown de Planta",
)
def crear_conteo(
    data: ConteoCreateRequest,
    service: ConteoService = Depends(get_conteo_service),
) -> ConteoResponse:
    return service.crear_conteo(data=data)


@router.get(
    "/historico",
    response_model=ConteoHistoricoResponse,
    summary="Listado histórico paginado de sesiones de conteo físico",
)
def get_historico_conteos(
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(20, ge=1, le=100, description="Tamaño de página"),
    service: ConteoService = Depends(get_conteo_service),
) -> ConteoHistoricoResponse:
    offset = (page - 1) * page_size
    return service.get_historico(limit=page_size, offset=offset)


@router.get(
    "/{id_conteo}",
    response_model=ConteoResponse,
    summary="Detalle completo de una sesión de conteo por ID",
)
def get_detalle_conteo(
    id_conteo: int,
    service: ConteoService = Depends(get_conteo_service),
) -> ConteoResponse:
    return service.get_detalle(id_conteo)
