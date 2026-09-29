from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from app.schemas.stock import (
    StockAjusteInput,
    StockAjusteResponse,
    StockListResponse,
    StockMovimientosResponse,
    MaterialConfigListResponse,
    MaterialConfigUpdate,
)
from app.services.stock_service import StockService

router = APIRouter(prefix="/api/stock", tags=["Stock CL2"])


def get_stock_service() -> StockService:
    return StockService()


@router.get("/movimientos", response_model=StockMovimientosResponse)
def get_stock_movimientos(
    search: Optional[str] = Query(default=None, description="Búsqueda por material u observación"),
    tipo: Optional[str] = Query(default=None, description="Tipo de movimiento"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    service: StockService = Depends(get_stock_service),
) -> StockMovimientosResponse:
    try:
        return service.get_movimientos(
            search=search,
            tipo=tipo,
            page=page,
            page_size=page_size,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener movimientos de stock: {e}")


@router.get("/deposito", response_model=StockListResponse)
def get_stock_deposito(
    search: Optional[str] = Query(default=None, description="Búsqueda por código o nombre"),
    id_proveedor: Optional[int] = Query(default=None, description="Filtrar por ID de proveedor"),
    solo_con_stock: bool = Query(default=False, description="Filtrar solo materiales con stock > 0"),
    tipo_almacen: Optional[str] = Query(default=None, description="Filtro opcional: 'cl2' o 'general'"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    service: StockService = Depends(get_stock_service),
) -> StockListResponse:
    try:
        return service.get_stock_deposito(
            search=search,
            id_proveedor=id_proveedor,
            solo_con_stock=solo_con_stock,
            tipo_almacen=tipo_almacen,
            page=page,
            page_size=page_size,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener stock: {e}")


@router.put("/deposito/{id_material}", response_model=StockAjusteResponse)
def ajustar_stock_deposito(
    id_material: str,
    data: StockAjusteInput,
    service: StockService = Depends(get_stock_service),
) -> StockAjusteResponse:
    try:
        return service.ajustar_stock(id_material=id_material, data=data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar stock: {e}")


@router.get("/configuracion-materiales", response_model=MaterialConfigListResponse)
def get_materiales_configuracion(
    search: Optional[str] = Query(default=None, description="Búsqueda por código o nombre"),
    id_proveedor: Optional[int] = Query(default=None, description="Filtrar por proveedor"),
    tipo_empaque: Optional[str] = Query(default=None, description="Filtrar por empaque: pallet, rollo, unidad"),
    en_cl2: Optional[bool] = Query(default=None, description="Filtrar por gestión en CL2"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    service: StockService = Depends(get_stock_service),
) -> MaterialConfigListResponse:
    try:
        return service.get_materiales_configuracion(
            search=search,
            id_proveedor=id_proveedor,
            tipo_empaque=tipo_empaque,
            en_cl2=en_cl2,
            page=page,
            page_size=page_size,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener configuración de materiales: {e}")


@router.put("/configuracion-materiales")
def update_material_configuracion(
    data: MaterialConfigUpdate,
    service: StockService = Depends(get_stock_service),
):
    try:
        service.update_material_configuracion(data)
        return {"mensaje": f"Configuración de material {data.id_material} actualizada exitosamente"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar configuración de material: {e}")
