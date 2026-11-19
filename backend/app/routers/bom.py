import os
import shutil
import tempfile
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.core.auth_deps import require_editor_planificacion, require_user

from app.repositories.bom_repository import BomRepository
from app.schemas.bom import (
    BomEstructuraResponse,
    BomExtensionImportResult,
    BomExtensionItem,
    BomExtensionResult,
    BomExtensionUpsert,
    BomImportResult,
    BomVersionOut,
    SdSetImportResult,
    SetComponenteCreate,
    SetComponenteOut,
    SetComponenteUpdate,
)
from app.services.bom_service import BomExtensionError, BomService

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


@router.post("/relaciones/importar")
def import_relations_file(
    file: UploadFile = File(...),
    reemplazar: bool = Query(default=False),
):
    import csv
    import io
    import openpyxl

    try:
        raw_bytes = file.file.read()
        fname = (file.filename or "").lower()
        parsed_rows = []

        if fname.endswith((".xlsx", ".xlsm")):
            wb = openpyxl.load_workbook(io.BytesIO(raw_bytes), data_only=True)
            ws = wb.active
            all_rows = list(ws.iter_rows(values_only=True))
        else:
            text = raw_bytes.decode("utf-8-sig", errors="replace")
            delimiter = "\t" if "\t" in text.splitlines()[0] else (";" if ";" in text.splitlines()[0] else ",")
            all_rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))

        for idx, r in enumerate(all_rows):
            if not r or all(c is None or str(c).strip() == "" for c in r):
                continue
            vals = [str(c).strip() if c is not None else "" for c in r]
            if idx == 0 and any(h in vals[0].lower() for h in ("sector", "sd", "tasa", "codigo")):
                continue
            if len(vals) < 5:
                continue
            sector = vals[0] or "Seat"
            sd = vals[1]
            tasa = vals[2]
            sap_padre = vals[3]
            hijo = vals[4]
            if not tasa or not sap_padre or not hijo:
                continue
            try:
                cant = float(str(vals[5]).replace(",", ".")) if len(vals) > 5 and vals[5] else 1.0
            except ValueError:
                cant = 1.0
            parsed_rows.append((sector, sd, tasa, sap_padre, hijo, cant))

        if not parsed_rows:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se encontraron filas válidas en el archivo (Columnas esperadas: Sector, SD, Código TASA, Código SAP Padre, Material Hijo, Cantidad).",
            )

        count = _repository.bulk_import_set_componentes(parsed_rows, replace_all=reemplazar)
        return {
            "mensaje": f"Se importaron {count} relaciones de sets/componentes correctamente.",
            "total_importados": count,
        }
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Error al importar archivo de relaciones: {err}",
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


@router.get("/extension", response_model=List[BomExtensionItem])
def listar_extension(_: Dict[str, Any] = Depends(require_user)) -> List[BomExtensionItem]:
    return _bom_service.listar_extension()


@router.put("/extension", response_model=BomExtensionResult)
def guardar_extension(
    data: BomExtensionUpsert,
    payload: Dict[str, Any] = Depends(require_editor_planificacion),
) -> BomExtensionResult:
    if data.id_padre == data.id_hijo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El padre y el componente no pueden ser el mismo PN.")
    id_usuario = payload.get("id_usuario")
    try:
        return _bom_service.guardar_extension(data, int(id_usuario) if id_usuario is not None else None)
    except BomExtensionError as err:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(err))


@router.delete("/extension/{id_extension}", response_model=BomExtensionResult)
def eliminar_extension(
    id_extension: int,
    _: Dict[str, Any] = Depends(require_editor_planificacion),
) -> BomExtensionResult:
    try:
        return _bom_service.eliminar_extension(id_extension)
    except BomExtensionError as err:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(err))


@router.post("/sd-sets/importar", response_model=SdSetImportResult)
def importar_sd_sets(
    file: UploadFile = File(...),
    _: Dict[str, Any] = Depends(require_editor_planificacion),
) -> SdSetImportResult:
    temp_dir = tempfile.mkdtemp()
    nombre = os.path.basename(file.filename or "sd_sets.xlsx")
    temp_path = os.path.join(temp_dir, nombre)
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return _bom_service.importar_sd_sets(temp_path, nombre)
    except BomExtensionError as err:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(err))
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Fallo durante la importación de SD y SETs: {err}",
        )
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        if os.path.exists(temp_dir):
            os.rmdir(temp_dir)


@router.post("/extension/importar", response_model=BomExtensionImportResult)
def importar_extension(
    file: UploadFile = File(...),
    payload: Dict[str, Any] = Depends(require_editor_planificacion),
) -> BomExtensionImportResult:
    temp_dir = tempfile.mkdtemp()
    nombre = os.path.basename(file.filename or "bom_complementaria.xlsx")
    temp_path = os.path.join(temp_dir, nombre)
    id_usuario = payload.get("id_usuario")
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return _bom_service.importar_extension(
            temp_path, nombre, int(id_usuario) if id_usuario is not None else None
        )
    except BomExtensionError as err:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(err))
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Fallo durante la importación de la BOM complementaria: {err}",
        )
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        if os.path.exists(temp_dir):
            os.rmdir(temp_dir)
