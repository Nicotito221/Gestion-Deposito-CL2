from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status

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
    MaterialCatalogoItem,
    RundownParametroMaterialCreate,
    RundownParametroMaterialItem,
    RundownPeriodoProyeccionItem,
    RundownPeriodoProyeccionCreate,
    PlanSemanalPreviewOut,
    PlanSemanalConfirmRequest,
    PlanSemanalConfirmOut,
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


@router.get("/materiales-catalogo", response_model=List[MaterialCatalogoItem])
def search_materiales_catalogo(
    q: str = Query(default="", description="Búsqueda por código o nombre"),
    service: RundownService = Depends(get_rundown_service),
) -> List[MaterialCatalogoItem]:
    return service.search_materiales_catalogo(q)


@router.get("/proveedores/{id_proveedor}/materiales", response_model=List[RundownParametroMaterialItem])
def get_materiales_proveedor(
    id_proveedor: int,
    service: RundownService = Depends(get_rundown_service),
) -> List[RundownParametroMaterialItem]:
    return service.get_materiales_proveedor(id_proveedor)


@router.post("/proveedores/{id_proveedor}/materiales", status_code=status.HTTP_201_CREATED)
def add_material_proveedor(
    id_proveedor: int,
    data: RundownParametroMaterialCreate,
    service: RundownService = Depends(get_rundown_service),
):
    param_id = service.add_material_proveedor(id_proveedor, data)
    return {"id_parametro": param_id, "mensaje": f"Material {data.id_material} agregado al Rundown"}


@router.delete("/proveedores/{id_proveedor}/materiales/{id_parametro}")
def delete_material_proveedor(
    id_proveedor: int,
    id_parametro: int,
    service: RundownService = Depends(get_rundown_service),
):
    service.delete_material_proveedor(id_parametro)
    return {"mensaje": "Material removido del Rundown"}


@router.get("/proveedor/{identifier}", response_model=RundownSupplierReport)
def get_supplier_rundown(
    identifier: str,
    fecha_desde: Optional[date] = Query(default=None),
    fecha_hasta: Optional[date] = Query(default=None),
    alcance: str = Query(default="total", pattern=r"^(total|planta)$"),
    periodo: Optional[str] = Query(default=None),
    id_seccion: Optional[int] = Query(default=None),
    service: RundownService = Depends(get_rundown_service),
) -> RundownSupplierReport:
    return service.get_supplier_rundown(
        identifier=identifier,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        alcance=alcance,
        periodo=periodo,
        id_seccion=id_seccion,
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


@router.get("/periodos-proyeccion", response_model=List[RundownPeriodoProyeccionItem])
def get_periodos_proyeccion(
    service: RundownService = Depends(get_rundown_service),
) -> List[RundownPeriodoProyeccionItem]:
    return service.get_periodos_proyeccion()


@router.post("/periodos-proyeccion", status_code=status.HTTP_201_CREATED)
def create_periodo_proyeccion(
    data: RundownPeriodoProyeccionCreate,
    service: RundownService = Depends(get_rundown_service),
):
    new_id = service.create_periodo_proyeccion(data)
    return {"id_proyeccion": new_id, "mensaje": f"Proyección para {data.anio}-{data.mes:02d} configurada exitosamente"}


@router.delete("/periodos-proyeccion/{id_proyeccion}")
def delete_periodo_proyeccion(
    id_proyeccion: int,
    service: RundownService = Depends(get_rundown_service),
):
    service.delete_periodo_proyeccion(id_proyeccion)
    return {"mensaje": "Mes de proyección eliminado del horizonte extendido"}


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


@router.delete("/stock-ajuste")
def delete_stock_ajuste(
    id_parametro: int = Query(...),
    fecha: date = Query(...),
    tipo_stock: str = Query(default="total"),
    service: RundownService = Depends(get_rundown_service),
):
    service.delete_stock_ajuste(id_parametro, fecha, tipo_stock)
    return {"mensaje": f"Ajuste de stock ({tipo_stock}) para la fecha {fecha} eliminado correctamente"}


@router.put("/scrap")
def update_scrap(
    data: RundownScrapUpdate,
    service: RundownService = Depends(get_rundown_service),
):
    service.update_scrap_porcentaje(data.id_parametro, data.scrap_porcentaje)
    return {"mensaje": "Porcentaje de scrap actualizado correctamente"}


@router.post("/secciones/{id_seccion}/plan-semanal/previsualizar", response_model=PlanSemanalPreviewOut)
async def preview_plan_semanal(
    id_seccion: int,
    file: UploadFile = File(...),
    override_fecha_inicio: Optional[date] = Form(default=None),
    service: RundownService = Depends(get_rundown_service),
) -> PlanSemanalPreviewOut:
    contents = await file.read()
    return service.preview_plan_semanal(id_seccion, contents, override_fecha_inicio)


@router.post("/secciones/{id_seccion}/plan-semanal/confirmar", response_model=PlanSemanalConfirmOut)
def confirm_plan_semanal(
    id_seccion: int,
    payload: PlanSemanalConfirmRequest,
    service: RundownService = Depends(get_rundown_service),
) -> PlanSemanalConfirmOut:
    return service.confirm_plan_semanal(id_seccion, payload)


