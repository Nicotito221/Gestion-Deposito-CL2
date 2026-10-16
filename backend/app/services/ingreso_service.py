from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status

from app.repositories.ingreso_repository import IngresoRepository
from app.schemas.ingreso import IngresoConfirmarRecepcion, IngresoCreate, IngresoOut


class IngresoService:
    def __init__(self, repository: Optional[IngresoRepository] = None) -> None:
        self._repo = repository or IngresoRepository()

    def get_ingresos(
        self,
        estado: Optional[str] = None,
        id_proveedor: Optional[int] = None,
        search: Optional[str] = None,
    ) -> List[IngresoOut]:
        data = self._repo.get_ingresos(estado=estado, id_proveedor=id_proveedor, search=search)
        return [IngresoOut.model_validate(it) for it in data]

    def get_ingreso_by_id(self, id_ingreso: int) -> IngresoOut:
        data = self._repo.get_ingreso_by_id(id_ingreso)
        if not data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Comprobante de ingreso #{id_ingreso} no encontrado",
            )
        return IngresoOut.model_validate(data)

    def create_ingreso(self, data: IngresoCreate, id_usuario: Optional[int] = None) -> IngresoOut:
        if not data.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El comprobante debe contener al menos un material con cantidad facturada.",
            )
        for it in data.items:
            if it.cantidad_facturada <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"La cantidad facturada para el material '{it.id_material}' debe ser mayor a 0.",
                )

        id_ingreso = self._repo.create_ingreso(data, id_usuario=id_usuario)
        res = self.get_ingreso_by_id(id_ingreso)

        from app.services.cl2_sync_service import Cl2SyncService
        Cl2SyncService().sync_ingreso_creado(res.model_dump())

        return res

    def confirmar_recepcion(
        self, id_ingreso: int, data: IngresoConfirmarRecepcion, id_usuario: Optional[int] = None
    ) -> IngresoOut:
        if not data.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe especificar los ítems a recibir.",
            )
        res = self._repo.confirmar_recepcion(id_ingreso, data, id_usuario=id_usuario)
        from app.services.cl2_sync_service import Cl2SyncService
        Cl2SyncService().sync_ingreso_creado(res)
        return IngresoOut.model_validate(res)

    def delete_ingreso(self, id_ingreso: int, id_usuario: Optional[int] = None) -> None:
        self.get_ingreso_by_id(id_ingreso)
        success = self._repo.delete_ingreso(id_ingreso, id_usuario=id_usuario)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Comprobante de ingreso #{id_ingreso} no encontrado",
            )
