import os
import shutil
import tempfile
from typing import List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.schemas.supply import SupplyConsolidateResult, SupplySummaryOut
from app.services.supply_service import SupplyService

router = APIRouter(prefix="/api/suministro", tags=["Orden de Suministro"])
_service = SupplyService()


@router.get("/resumen", response_model=SupplySummaryOut)
def get_supply_summary() -> SupplySummaryOut:
    try:
        return _service.get_summary()
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener resumen de suministro: {err}",
        )


@router.post("/consolidar", response_model=SupplyConsolidateResult)
def consolidate_supply(
    files_f1: List[UploadFile] = File(default=[]),
    files_f2: List[UploadFile] = File(default=[]),
) -> SupplyConsolidateResult:
    f1_list = files_f1 or []
    f2_list = files_f2 or []

    if not f1_list and not f2_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe suministrar al menos un archivo (F1 o F2) para consolidar.",
        )

    temp_dir = tempfile.mkdtemp()
    paths_f1: List[str] = []
    paths_f2: List[str] = []

    try:
        for idx, f in enumerate(f1_list):
            name = f.filename or f"f1_{idx}.xlsx"
            dst = os.path.join(temp_dir, f"f1_{idx}_{name}")
            with open(dst, "wb") as buf:
                shutil.copyfileobj(f.file, buf)
            paths_f1.append(dst)

        for idx, f in enumerate(f2_list):
            name = f.filename or f"f2_{idx}.xlsx"
            dst = os.path.join(temp_dir, f"f2_{idx}_{name}")
            with open(dst, "wb") as buf:
                shutil.copyfileobj(f.file, buf)
            paths_f2.append(dst)

        result = _service.consolidar_archivos(f1_paths=paths_f1, f2_paths=paths_f2)
        return result
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Error durante el procesamiento de la orden de suministro: {err}",
        )
    finally:
        for p in paths_f1 + paths_f2:
            if os.path.exists(p):
                os.remove(p)
        if os.path.exists(temp_dir):
            os.rmdir(temp_dir)
