from math import ceil
from typing import Any, List, Optional, Tuple

import openpyxl

COLUMNA_MATERIAL = 0
COLUMNA_PROVEEDOR = 9

from app.repositories.stock_repository import StockRepository
from app.schemas.stock import (
    AsignacionProveedorResultado,
    StockAjusteInput,
    StockAjusteResponse,
    StockListResponse,
    StockMaterialItem,
    StockMovimientoItem,
    StockMovimientosResponse,
    MaterialConfigItem,
    MaterialConfigListResponse,
    MaterialConfigUpdate,
    CajaPedidoCreate,
    CajaPedidoOut,
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
        cierre_ayer_stocks = rs.get_cierre_ayer_stocks_map()

        for it in items_raw:
            mat_id = it["id_material"]
            is_dep_planta = bool(it.get("deposito_en_planta", False))
            if mat_id in cierre_ayer_stocks:
                stk_ayer = cierre_ayer_stocks[mat_id]
                it["stock_planta"] = stk_ayer["stock_planta"]
                it["stock_cl2"] = 0.0 if is_dep_planta else stk_ayer["stock_cl2"]
                it["stock_total"] = it["stock_planta"] + it["stock_cl2"]
            else:
                stock_cl2 = 0.0 if is_dep_planta else float(it.get("stock_cl2", 0.0))
                stock_planta = float(it.get("stock_planta", 0.0))
                it["stock_cl2"] = stock_cl2
                it["stock_planta"] = stock_planta
                it["stock_total"] = stock_planta + (0.0 if is_dep_planta else stock_cl2)

            if tipo_almacen == "cl2":
                it["stock_actual"] = it["stock_cl2"]
            elif tipo_almacen == "planta":
                it["stock_actual"] = it["stock_planta"]
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

    @staticmethod
    def _texto_celda(valor: Any) -> str:
        if valor is None:
            return ""
        if isinstance(valor, float) and valor.is_integer():
            return str(int(valor))
        return str(valor).strip().upper()

    def importar_asignacion_proveedores(self, ruta: str, nombre_archivo: str) -> AsignacionProveedorResultado:
        wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
        try:
            pares: List[Tuple[int, str, str]] = []
            errores: List[str] = []
            for numero, fila in enumerate(
                wb.worksheets[0].iter_rows(min_row=2, max_col=COLUMNA_PROVEEDOR + 1, values_only=True), start=2
            ):
                material = self._texto_celda(fila[COLUMNA_MATERIAL] if len(fila) > COLUMNA_MATERIAL else None)
                proveedor = self._texto_celda(fila[COLUMNA_PROVEEDOR] if len(fila) > COLUMNA_PROVEEDOR else None)
                if not material and not proveedor:
                    continue
                if not material or not proveedor:
                    errores.append(f"Fila {numero}: falta el material o el proveedor.")
                    continue
                pares.append((numero, material[:50], proveedor))
        finally:
            wb.close()

        if not pares and not errores:
            raise ValueError("El archivo no tiene filas con PN (columna A) y proveedor (columna J) desde la fila 2.")

        asignados, sin_cambios, errores_repo, creados = self._repo.asignar_proveedores_masivo(pares)
        return AsignacionProveedorResultado(
            nombre_archivo=nombre_archivo,
            total_filas=len(pares) + len(errores),
            asignados=asignados,
            sin_cambios=sin_cambios,
            proveedores_creados=creados,
            errores=errores + errores_repo,
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

    def get_cajas_pedido(self) -> List[CajaPedidoOut]:
        raw = self._repo.get_cajas_pedido()
        return [CajaPedidoOut.model_validate(c) for c in raw]

    def create_caja_pedido(self, data: CajaPedidoCreate) -> CajaPedidoOut:
        res = self._repo.create_caja_pedido(
            nombre=data.nombre,
            items=[it.model_dump() for it in data.items],
            codigo_caja=data.codigo_caja,
        )
        return CajaPedidoOut.model_validate(res)

    def update_caja_pedido(self, id_caja: int, data: CajaPedidoCreate) -> CajaPedidoOut:
        res = self._repo.update_caja_pedido(
            id_caja=id_caja,
            nombre=data.nombre,
            items=[it.model_dump() for it in data.items],
            codigo_caja=data.codigo_caja,
        )
        return CajaPedidoOut.model_validate(res)

    def delete_caja_pedido(self, id_caja: int) -> None:
        self._repo.delete_caja_pedido(id_caja)

