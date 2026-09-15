from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status

from app.schemas.rundown import (
    RundownProveedorCreate,
    RundownProveedorUpdate,
    RundownSeccionCreate,
    RundownSeccionItem,
    RundownStockInicialUpdate,
    RundownStockAjusteUpdate,
    RundownScrapUpdate,
    RundownSupplierReport,
    RundownTransitoCreate,
    RundownIngresoDiaUpdate,
    RundownCalendarioMesOut,
    RundownCalendarioMesSave,
)
from app.services.rundown_service import RundownService

router = APIRouter(prefix="/api/rundown", tags=["Rundown"])

_rundown_service = RundownService()


def get_rundown_service() -> RundownService:
    return _rundown_service


@router.get("/secciones", response_model=List[RundownSeccionItem])
def get_secciones(
    service: RundownService = Depends(get_rundown_service),
) -> List[RundownSeccionItem]:
    return service.get_secciones()


@router.post("/secciones", status_code=status.HTTP_201_CREATED)
def create_seccion(
    data: RundownSeccionCreate,
    service: RundownService = Depends(get_rundown_service),
):
    new_id = service.create_seccion(data)
    return {"id_seccion": new_id, "mensaje": "Sección creada exitosamente"}


@router.post("/proveedores", status_code=status.HTTP_201_CREATED)
def create_proveedor(
    data: RundownProveedorCreate,
    service: RundownService = Depends(get_rundown_service),
):
    new_id = service.create_proveedor(data)
    return {"id_proveedor": new_id, "mensaje": "Proveedor registrado exitosamente"}


@router.put("/proveedores/{id_proveedor}")
def update_proveedor(
    id_proveedor: int,
    data: RundownProveedorUpdate,
    service: RundownService = Depends(get_rundown_service),
):
    service.update_proveedor(id_proveedor, data)
    return {"mensaje": "Proveedor actualizado correctamente"}


@router.get("/proveedor/{identifier}", response_model=RundownSupplierReport)
def get_supplier_rundown(
    identifier: str,
    fecha_desde: Optional[date] = Query(default=None),
    fecha_hasta: Optional[date] = Query(default=None),
    alcance: str = Query(default="total", pattern=r"^(total|planta)$"),
    periodo: Optional[str] = Query(default=None),
    service: RundownService = Depends(get_rundown_service),
) -> RundownSupplierReport:
    return service.get_supplier_rundown(
        identifier=identifier,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        alcance=alcance,
        periodo=periodo,
    )


@router.get("/calendario", response_model=RundownCalendarioMesOut)
def get_calendario(
    anio: int = Query(...),
    mes: int = Query(..., ge=1, le=12),
    service: RundownService = Depends(get_rundown_service),
) -> RundownCalendarioMesOut:
    return service.get_calendario_mes(anio, mes)


@router.put("/calendario")
def save_calendario(
    data: RundownCalendarioMesSave,
    service: RundownService = Depends(get_rundown_service),
):
    service.save_calendario_mes(data)
    return {"mensaje": f"Calendario productivo para {data.anio}-{data.mes:02d} guardado exitosamente"}


@router.post("/transito", status_code=status.HTTP_201_CREATED)
def add_transito(
    data: RundownTransitoCreate,
    service: RundownService = Depends(get_rundown_service),
):
    new_id = service.add_transito(data)
    return {"id_transito": new_id, "mensaje": "Arribo en tránsito registrado exitosamente"}


@router.put("/ingreso-dia")
def upsert_ingreso_dia(
    data: RundownIngresoDiaUpdate,
    service: RundownService = Depends(get_rundown_service),
):
    service.upsert_ingreso_dia(data)
    return {"mensaje": "Ingreso actualizado exitosamente"}


@router.delete("/transito/{id_transito}")
def delete_transito(
    id_transito: int,
    service: RundownService = Depends(get_rundown_service),
):
    service.delete_transito(id_transito)
    return {"mensaje": f"Tránsito {id_transito} eliminado"}


@router.put("/stock-inicial")
def update_stock_inicial(
    data: RundownStockInicialUpdate,
    service: RundownService = Depends(get_rundown_service),
):
    service.update_stock_inicial(data.id_parametro, data.stock_inicial, data.tipo_stock)
    return {"mensaje": f"Stock inicial ({data.tipo_stock}) actualizado correctamente"}


@router.put("/stock-ajuste")
def update_stock_ajuste(
    data: RundownStockAjusteUpdate,
    service: RundownService = Depends(get_rundown_service),
):
    service.upsert_stock_ajuste(data)
    return {"mensaje": f"Stock ({data.tipo_stock}) para la fecha {data.fecha} actualizado correctamente"}


@router.put("/scrap")
def update_scrap(
    data: RundownScrapUpdate,
    service: RundownService = Depends(get_rundown_service),
):
    service.update_scrap_porcentaje(data.id_parametro, data.scrap_porcentaje)
    return {"mensaje": "Porcentaje de scrap actualizado correctamente"}

