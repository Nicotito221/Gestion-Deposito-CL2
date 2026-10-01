from math import ceil
from typing import Optional

from app.repositories.stock_repository import StockRepository
from app.schemas.stock import (
    StockAjusteInput,
    StockAjusteResponse,
    StockListResponse,
    StockMaterialItem,
    StockMovimientoItem,
    StockMovimientosResponse,
    MaterialConfigItem,
    MaterialConfigListResponse,
    MaterialConfigUpdate,
)


class StockService:
    def __init__(
        self,
        repository: Optional[StockRepository] = None,
        rundown_service: Optional[Any] = None,
    ) -> None:
        self._repo = repository or StockRepository()
        self._rundown_service = rundown_service

    def _get_rundown_service(self):
        if not self._rundown_service:
            from app.services.rundown_service import RundownService
            self._rundown_service = RundownService()
        return self._rundown_service

    def get_stock_deposito(
        self,
        search: Optional[str] = None,
        id_proveedor: Optional[int] = None,
        solo_con_stock: bool = False,
        tipo_almacen: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> StockListResponse:
        current_page = max(1, page)
        current_page_size = max(1, min(page_size, 200))

        items_raw, total = self._repo.get_stock_deposito_paginated(
            search=search,
            id_proveedor=id_proveedor,
            solo_con_stock=solo_con_stock,
            tipo_almacen=tipo_almacen,
            page=current_page,
            page_size=current_page_size,
        )

        rs = self._get_rundown_service()
        planta_stocks = rs.get_planta_stocks_map()

        for it in items_raw:
            mat_id = it["id_material"]
            if mat_id in planta_stocks:
                it["stock_planta"] = planta_stocks[mat_id]
            is_dep_planta = bool(it.get("deposito_en_planta", False))
            stock_cl2 = 0.0 if is_dep_planta else float(it.get("stock_cl2", 0.0))
            stock_planta = float(it.get("stock_planta", 0.0))
            it["stock_cl2"] = stock_cl2
            it["stock_total"] = stock_planta + (0.0 if is_dep_planta else stock_cl2)
            if tipo_almacen == "cl2":
                it["stock_actual"] = stock_cl2
            elif tipo_almacen == "planta":
                it["stock_actual"] = stock_planta
            else:
                it["stock_actual"] = it["stock_total"]

        total_pages = ceil(total / current_page_size) if total > 0 else 1
        items = [StockMaterialItem.model_validate(it) for it in items_raw]

        return StockListResponse(
            items=items,
            total=total,
            page=current_page,
            page_size=current_page_size,
            total_pages=total_pages,
        )

    def ajustar_stock(
        self, id_material: str, data: StockAjusteInput
    ) -> StockAjusteResponse:
        rs = self._get_rundown_service()
        planta_stocks = rs.get_planta_stocks_map(target_date=data.fecha)
        current_planta = planta_stocks.get(id_material.strip())

        res = self._repo.ajustar_stock_deposito(
            id_material=id_material.strip(),
            nuevo_stock=data.nuevo_stock,
            nuevo_stock_planta=data.nuevo_stock_planta,
            nuevo_stock_cl2=data.nuevo_stock_cl2,
            observacion=data.observacion,
            id_usuario=data.id_usuario,
            stock_planta_actual=current_planta,
            fecha=data.fecha,
        )
        return StockAjusteResponse(
            id_material=id_material.strip(),
            stock_anterior=res["stock_anterior"],
            stock_nuevo=res["stock_nuevo"],
            stock_planta=res.get("stock_planta"),
            stock_cl2=res.get("stock_cl2"),
            stock_total=res.get("stock_total"),
            mensaje="Stock actualizado correctamente",
        )

    def get_movimientos(
        self,
        search: Optional[str] = None,
        tipo: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> StockMovimientosResponse:
        current_page = max(1, page)
        current_page_size = max(1, min(page_size, 200))

        items_raw, total = self._repo.get_movimientos_paginated(
            search=search,
            tipo=tipo,
            page=current_page,
            page_size=current_page_size,
        )

        total_pages = ceil(total / current_page_size) if total > 0 else 1
        items = [StockMovimientoItem.model_validate(it) for it in items_raw]

        return StockMovimientosResponse(
            items=items,
            total=total,
            page=current_page,
            page_size=current_page_size,
            total_pages=total_pages,
        )

    def get_materiales_configuracion(
        self,
        search: Optional[str] = None,
        id_proveedor: Optional[int] = None,
        tipo_empaque: Optional[str] = None,
        en_cl2: Optional[bool] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> MaterialConfigListResponse:
        current_page = max(1, page)
        current_page_size = max(1, min(page_size, 200))

        items_raw, total = self._repo.get_materiales_configuracion_paginated(
            search=search,
            id_proveedor=id_proveedor,
            tipo_empaque=tipo_empaque,
            en_cl2=en_cl2,
            page=current_page,
            page_size=current_page_size,
        )

        total_pages = ceil(total / current_page_size) if total > 0 else 1
        items = [MaterialConfigItem.model_validate(it) for it in items_raw]

        return MaterialConfigListResponse(
            items=items,
            total=total,
            page=current_page,
            page_size=current_page_size,
            total_pages=total_pages,
        )

    def update_material_configuracion(self, data: MaterialConfigUpdate) -> None:
        lote_calculado = data.lote_mts
        if data.tipo_empaque == "rollo":
            if data.unidad_por_bulto and data.bultos_por_pallet:
                lote_calculado = float(data.unidad_por_bulto * data.bultos_por_pallet)
        elif data.tipo_empaque == "unidad":
            lote_calculado = 1.0

        self._repo.update_material_configuracion(
            id_material=data.id_material.strip(),
            id_proveedor=data.id_proveedor,
            deposito_en_planta=data.deposito_en_planta,
            tipo_empaque=data.tipo_empaque,
            lote_mts=lote_calculado,
            unidad_por_bulto=data.unidad_por_bulto if data.tipo_empaque == "rollo" else None,
            bultos_por_pallet=data.bultos_por_pallet if data.tipo_empaque == "rollo" else None,
            doh_sugerido_planta=data.doh_sugerido_planta,
            unidad=data.unidad.strip().upper() if data.unidad and data.unidad.strip() else None,
            en_cl2=data.en_cl2,
        )
