from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from app.core.auth_deps import ROLES_PLANTA, id_usuario_de, require_roles, require_user
from app.core.errors import error_interno

from app.schemas.rundown import ProveedorAdminItem
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
    RundownConsumoDiaUpdate,
    RundownCalendarioMesOut,
    RundownCalendarioMesSave,
    MaterialCatalogoItem,
    RundownParametroMaterialCreate,
    RundownParametroMaterialItem,
    RundownLoteMaterialUpdate,
    RundownPeriodoItem,
    RundownPeriodoProyeccionItem,
    RundownPeriodoProyeccionCreate,
    PlanSemanalPreviewOut,
    PlanSemanalConfirmRequest,
    PlanSemanalConfirmOut,
)
from app.services.rundown_service import RundownService

router = APIRouter(prefix="/api/rundown", tags=["Rundown"], dependencies=[Depends(require_user)])
require_planta = require_roles(ROLES_PLANTA)

_rundown_service = RundownService()


def get_rundown_service() -> RundownService:
    return _rundown_service


@router.get("/secciones", response_model=List[RundownSeccionItem])
def get_secciones(
    service: RundownService = Depends(get_rundown_service),
) -> List[RundownSeccionItem]:
    return service.get_secciones()


@router.post("/secciones", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_planta)])
def create_seccion(
    data: RundownSeccionCreate,
    service: RundownService = Depends(get_rundown_service),
):
    new_id = service.create_seccion(data)
    return {"id_seccion": new_id, "mensaje": "Sección creada exitosamente"}


@router.post("/proveedores", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_planta)])
def create_proveedor(
    data: RundownProveedorCreate,
    service: RundownService = Depends(get_rundown_service),
):
    try:
        new_id = service.create_proveedor(data)
        return {"id_proveedor": new_id, "mensaje": "Proveedor registrado exitosamente"}
    except Exception as err:
        if "Violation of UNIQUE KEY constraint" in str(err) or "2627" in str(err):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El proveedor con código '{data.codigo_proveedor.strip().upper()}' ya existe en el sistema.",
            )
        raise error_interno("Error al registrar proveedor", err)



@router.get("/proveedores", response_model=List[ProveedorAdminItem])
def list_proveedores_admin(
    service: RundownService = Depends(get_rundown_service),
) -> List[ProveedorAdminItem]:
    return service.list_proveedores_admin()


@router.put("/proveedores/{id_proveedor}", dependencies=[Depends(require_planta)])
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


@router.get("/materiales-catalogo/{id_material:path}", response_model=MaterialCatalogoItem)
def get_material_catalogo(
    id_material: str,
    service: RundownService = Depends(get_rundown_service),
) -> MaterialCatalogoItem:
    item = service.get_material_catalogo(id_material)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Material '{id_material}' no encontrado en el catálogo",
        )
    return item


@router.get("/proveedores/{id_proveedor}/materiales", response_model=List[RundownParametroMaterialItem])
def get_materiales_proveedor(
    id_proveedor: int,
    service: RundownService = Depends(get_rundown_service),
) -> List[RundownParametroMaterialItem]:
    return service.get_materiales_proveedor(id_proveedor)


@router.post("/proveedores/{id_proveedor}/materiales", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_planta)])
def add_material_proveedor(
    id_proveedor: int,
    data: RundownParametroMaterialCreate,
    service: RundownService = Depends(get_rundown_service),
):
    param_id = service.add_material_proveedor(id_proveedor, data)
    return {"id_parametro": param_id, "mensaje": f"Material {data.id_material} agregado al Rundown"}


@router.delete("/proveedores/{id_proveedor}/materiales/{id_parametro}", dependencies=[Depends(require_planta)])
def delete_material_proveedor(
    id_proveedor: int,
    id_parametro: int,
    service: RundownService = Depends(get_rundown_service),
):
    service.delete_material_proveedor(id_parametro)
    return {"mensaje": "Material removido del Rundown"}


@router.put("/materiales/lote", dependencies=[Depends(require_planta)])
def update_lote_material(
    data: RundownLoteMaterialUpdate,
    service: RundownService = Depends(get_rundown_service),
):
    service.update_lote_material(data)
    return {"mensaje": "Lote y empaque actualizados correctamente"}



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


@router.put("/calendario", dependencies=[Depends(require_planta)])
def save_calendario(
    data: RundownCalendarioMesSave,
    service: RundownService = Depends(get_rundown_service),
):
    service.save_calendario_mes(data)
    return {"mensaje": f"Calendario productivo para {data.anio}-{data.mes:02d} guardado exitosamente"}


@router.get("/meses-disponibles", response_model=List[RundownPeriodoItem])
def get_meses_disponibles(
    service: RundownService = Depends(get_rundown_service),
) -> List[RundownPeriodoItem]:
    return service.get_meses_disponibles()


@router.get("/periodos-proyeccion", response_model=List[RundownPeriodoProyeccionItem])
def get_periodos_proyeccion(
    service: RundownService = Depends(get_rundown_service),
) -> List[RundownPeriodoProyeccionItem]:
    return service.get_periodos_proyeccion()


@router.post("/periodos-proyeccion", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_planta)])
def create_periodo_proyeccion(
    data: RundownPeriodoProyeccionCreate,
    service: RundownService = Depends(get_rundown_service),
):
    new_id = service.create_periodo_proyeccion(data)
    return {"id_proyeccion": new_id, "mensaje": f"Proyección para {data.anio}-{data.mes:02d} configurada exitosamente"}


@router.delete("/periodos-proyeccion/{id_proyeccion}", dependencies=[Depends(require_planta)])
def delete_periodo_proyeccion(
    id_proyeccion: int,
    service: RundownService = Depends(get_rundown_service),
):
    service.delete_periodo_proyeccion(id_proyeccion)
    return {"mensaje": "Mes de proyección eliminado del horizonte extendido"}


@router.post("/transito", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_planta)])
def add_transito(
    data: RundownTransitoCreate,
    service: RundownService = Depends(get_rundown_service),
):
    new_id = service.add_transito(data)
    return {"id_transito": new_id, "mensaje": "Arribo en tránsito registrado exitosamente"}


@router.put("/ingreso-dia", dependencies=[Depends(require_planta)])
def upsert_ingreso_dia(
    data: RundownIngresoDiaUpdate,
    service: RundownService = Depends(get_rundown_service),
):
    service.upsert_ingreso_dia(data)
    return {"mensaje": "Ingreso actualizado exitosamente"}


@router.put("/consumo-dia", dependencies=[Depends(require_planta)])
def upsert_consumo_dia(
    data: RundownConsumoDiaUpdate,
    service: RundownService = Depends(get_rundown_service),
):
    service.upsert_consumo_dia(data)
    return {"mensaje": f"Producción/consumo de {data.id_material} para {data.fecha} actualizado correctamente"}


@router.delete("/transito/{id_transito}", dependencies=[Depends(require_planta)])
def delete_transito(
    id_transito: int,
    service: RundownService = Depends(get_rundown_service),
):
    service.delete_transito(id_transito)
    return {"mensaje": f"Tránsito {id_transito} eliminado"}


@router.put("/stock-inicial", dependencies=[Depends(require_planta)])
def update_stock_inicial(
    data: RundownStockInicialUpdate,
    service: RundownService = Depends(get_rundown_service),
):
    service.update_stock_inicial(data.id_parametro, data.stock_inicial, data.tipo_stock)
    return {"mensaje": f"Stock inicial ({data.tipo_stock}) actualizado correctamente"}


@router.put("/stock-ajuste", dependencies=[Depends(require_planta)])
def update_stock_ajuste(
    data: RundownStockAjusteUpdate,
    service: RundownService = Depends(get_rundown_service),
):
    service.upsert_stock_ajuste(data)
    return {"mensaje": f"Stock ({data.tipo_stock}) para la fecha {data.fecha} actualizado correctamente"}


@router.delete("/stock-ajuste", dependencies=[Depends(require_planta)])
def delete_stock_ajuste(
    id_parametro: int = Query(...),
    fecha: date = Query(...),
    tipo_stock: str = Query(default="total"),
    service: RundownService = Depends(get_rundown_service),
):
    service.delete_stock_ajuste(id_parametro, fecha, tipo_stock)
    return {"mensaje": f"Ajuste de stock ({tipo_stock}) para la fecha {fecha} eliminado correctamente"}


@router.put("/scrap", dependencies=[Depends(require_planta)])
def update_scrap(
    data: RundownScrapUpdate,
    service: RundownService = Depends(get_rundown_service),
):
    service.update_scrap_porcentaje(data.id_parametro, data.scrap_porcentaje)
    return {"mensaje": "Porcentaje de scrap actualizado correctamente"}


@router.post("/secciones/{id_seccion}/plan-semanal/previsualizar", response_model=PlanSemanalPreviewOut, dependencies=[Depends(require_planta)])
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
    token_data: dict = Depends(require_planta),
    service: RundownService = Depends(get_rundown_service),
) -> PlanSemanalConfirmOut:
    return service.confirm_plan_semanal(id_seccion, payload, id_usuario_de(token_data))


