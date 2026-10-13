import os
import shutil
import tempfile
from typing import List, Optional

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status

from app.repositories.bom_repository import BomRepository
from app.schemas.bom import (
    BomEstructuraResponse,
    BomImportResult,
    BomVersionOut,
    SetComponenteCreate,
    SetComponenteOut,
    SetComponenteUpdate,
)
from app.services.bom_service import BomService

router = APIRouter(prefix="/api/bom", tags=["BOM"])
_repository = BomRepository()
_bom_service = BomService()


@router.get("/estructura-activa", response_model=BomEstructuraResponse)
def get_bom_estructura_activa(
    id_version: Optional[int] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> BomEstructuraResponse:
    try:
        return _repository.get_bom_estructura(
            id_version=id_version, search=search, limit=limit, offset=offset
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al consultar estructura de BOM: {err}",
        )


@router.get("/versiones", response_model=List[BomVersionOut])
def list_versions() -> List[BomVersionOut]:
    try:
        return _repository.get_versions()
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al consultar versiones de BOM: {err}",
        )


@router.get("/relaciones")
def list_relations(
    sector: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=300, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    try:
        items, total = _repository.get_set_componentes(
            sector=sector, search=search, limit=limit, offset=offset
        )
        return {"items": items, "total": total}
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al consultar relaciones de componentes: {err}",
        )


@router.post("/relaciones", response_model=SetComponenteOut, status_code=status.HTTP_201_CREATED)
def create_relation(payload: SetComponenteCreate) -> SetComponenteOut:
    try:
        return _repository.create_set_componente(payload)
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al crear relación: {err}",
        )


@router.put("/relaciones/{id_set_componente}", response_model=SetComponenteOut)
def update_relation(
    id_set_componente: int, payload: SetComponenteUpdate
) -> SetComponenteOut:
    try:
        updated = _repository.update_set_componente(id_set_componente, payload)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Relación no encontrada.",
            )
        return updated
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al actualizar relación: {err}",
        )


@router.patch("/relaciones/{id_set_componente}/toggle")
def toggle_relation(id_set_componente: int):
    try:
        new_status = _repository.toggle_set_componente(id_set_componente)
        if new_status is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Relación no encontrada.",
            )
        return {"id_set_componente": id_set_componente, "activo": new_status}
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al alternar estado de relación: {err}",
        )


@router.post("/upload", response_model=BomImportResult)
def upload_bom(file: UploadFile = File(...)) -> BomImportResult:
    temp_dir = tempfile.mkdtemp()
    temp_path = os.path.join(temp_dir, file.filename or "uploaded_bom.xlsx")
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        result = _bom_service.importar_bom(temp_path, nombre_archivo=file.filename)
        return result
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Fallo durante la importación de la receta BOM: {err}",
        )
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        if os.path.exists(temp_dir):
            os.rmdir(temp_dir)
