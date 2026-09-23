from datetime import date
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status

from app.core.time import get_argentina_yesterday
from app.repositories.conteo_repository import ConteoRepository
from app.schemas.conteo import (
    ConteoCreateRequest,
    ConteoHistoricoItem,
    ConteoHistoricoResponse,
    ConteoMaterialSearchItem,
    ConteoResponse,
    MaterialConteoItemResponse,
)


class ConteoService:
    def __init__(
        self,
        repo: Optional[ConteoRepository] = None,
        rundown_service: Optional[Any] = None,
    ) -> None:
        self._repo = repo or ConteoRepository()
        self._rundown_service = rundown_service

    def _get_rundown_service(self):
        if not self._rundown_service:
            from app.services.rundown_service import RundownService
            self._rundown_service = RundownService()
        return self._rundown_service

    def search_materiales(
        self,
        search: Optional[str] = None,
        id_proveedor: Optional[int] = None,
        target_date: Optional[date] = None,
        limit: int = 50,
    ) -> List[ConteoMaterialSearchItem]:
        t_date = target_date or get_argentina_yesterday()
        raw_items = self._repo.search_materiales_para_conteo(
            search=search,
            id_proveedor=id_proveedor,
            target_date=t_date,
            limit=limit,
        )

        rs = self._get_rundown_service()
        planta_stocks = rs.get_planta_stocks_map(t_date)

        for it in raw_items:
            mat_id = it["id_material"]
            if mat_id in planta_stocks:
                it["stock_teorico"] = planta_stocks[mat_id]

        return [ConteoMaterialSearchItem(**item) for item in raw_items]

    def crear_conteo(
        self,
        data: ConteoCreateRequest,
        id_usuario: Optional[int] = None,
    ) -> ConteoResponse:
        if not data.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El conteo debe incluir al menos un material",
            )

        target_date = data.fecha_impacto or get_argentina_yesterday()
        user_id = id_usuario or 2

        rs = self._get_rundown_service()
        planta_stocks = rs.get_planta_stocks_map(target_date)

        items_dict = []
        for it in data.items:
            dumped = it.model_dump()
            mat_id = dumped["id_material"]
            if mat_id in planta_stocks:
                dumped["stock_teorico"] = planta_stocks[mat_id]
            items_dict.append(dumped)

        try:
            res = self._repo.crear_conteo_con_sincronizacion(
                target_date=target_date,
                items=items_dict,
                id_usuario=user_id,
                observacion=data.observacion,
            )
            return ConteoResponse(
                id_conteo=res["id_conteo"],
                tipo=res["tipo"],
                id_usuario=res["id_usuario"],
                nombre_usuario=res["nombre_usuario"],
                estado=res["estado"],
                fecha_impacto=res["fecha_impacto"],
                fecha_inicio=res["fecha_inicio"],
                fecha_finalizacion=res["fecha_finalizacion"],
                observacion=res["observacion"],
                total_items=res["total_items"],
                items=[MaterialConteoItemResponse(**it) for it in res["items"]],
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al registrar conteo y sincronizar Rundown: {str(e)}",
            )

    def get_historico(
        self,
        limit: int = 20,
        offset: int = 0,
    ) -> ConteoHistoricoResponse:
        items, total = self._repo.get_historico_conteos(limit=limit, offset=offset)
        return ConteoHistoricoResponse(
            items=[ConteoHistoricoItem(**it) for it in items],
            total=total,
        )

    def get_detalle(self, id_conteo: int) -> ConteoResponse:
        res = self._repo.get_conteo_detalle(id_conteo)
        if not res:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conteo con ID {id_conteo} no encontrado",
            )
        return ConteoResponse(
            id_conteo=res["id_conteo"],
            tipo=res["tipo"],
            id_usuario=res["id_usuario"],
            nombre_usuario=res["nombre_usuario"],
            estado=res["estado"],
            fecha_impacto=res["fecha_impacto"] or get_argentina_yesterday(),
            fecha_inicio=res["fecha_inicio"],
            fecha_finalizacion=res["fecha_finalizacion"],
            observacion=res["observacion"],
            total_items=res["total_items"],
            items=[MaterialConteoItemResponse(**it) for it in res["items"]],
        )
