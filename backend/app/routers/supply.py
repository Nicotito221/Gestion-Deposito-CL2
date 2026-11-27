import json
import os
import shutil
import tempfile
from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.core.auth_deps import id_usuario_de, require_editor_planificacion, require_user
from app.schemas.supply import (
    ConversionOrdenImportResult,
    ConversionOrdenResumen,
    SupplyConsolidateResult,
    SupplyItemUpdate,
    SupplySummaryOut,
)
from app.services.conversion_orden_service import ConversionOrdenError, ConversionOrdenService
from app.services.supply_service import SupplyService
from app.core.errors import error_interno

router = APIRouter(prefix="/api/suministro", tags=["Orden de Suministro"], dependencies=[Depends(require_user)])
_service = SupplyService()
_conversion_service = ConversionOrdenService()


@router.get("/resumen", response_model=SupplySummaryOut)
def get_supply_summary() -> SupplySummaryOut:
    try:
        return _service.get_summary()
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error al obtener resumen de suministro: {err}")
    except Exception as err:
        raise error_interno("Error al obtener resumen de suministro", err)


@router.get("/conversiones/resumen", response_model=ConversionOrdenResumen)
def resumen_conversiones() -> ConversionOrdenResumen:
    return _conversion_service.resumen()


@router.post("/conversiones/importar", response_model=ConversionOrdenImportResult)
def importar_conversiones(
    file: UploadFile = File(...),
    _: Dict[str, Any] = Depends(require_editor_planificacion),
) -> ConversionOrdenImportResult:
    temp_dir = tempfile.mkdtemp()
    nombre = os.path.basename(file.filename or "conversiones.xlsx")
    temp_path = os.path.join(temp_dir, nombre)
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return _conversion_service.importar(temp_path, nombre)
    except ConversionOrdenError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Fallo durante la importación de conversiones: {err}")
    except Exception as err:
        raise error_interno("Fallo durante la importación de conversiones", err)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.put("/produccion-diaria")
def update_produccion_diaria(
    data: SupplyItemUpdate,
    token_data: Dict[str, Any] = Depends(require_editor_planificacion),
):
    try:
        _service.update_produccion_diaria(data.id_producto, data.fecha, data.cantidad, id_usuario=id_usuario_de(token_data))
        return {"mensaje": f"Producción de {data.id_producto} para {data.fecha} actualizada a {data.cantidad}"}
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error al actualizar valor diario: {err}")
    except Exception as err:
        raise error_interno("Error al actualizar valor diario", err)


@router.post("/consolidar", response_model=SupplyConsolidateResult, dependencies=[Depends(require_editor_planificacion)])
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
            name = os.path.basename(f.filename or f"f1_{idx}.xlsx")
            dst = os.path.join(temp_dir, f"f1_{idx}_{name}")
            with open(dst, "wb") as buf:
                shutil.copyfileobj(f.file, buf)
            paths_f1.append(dst)

        for idx, f in enumerate(f2_list):
            name = os.path.basename(f.filename or f"f2_{idx}.xlsx")
            dst = os.path.join(temp_dir, f"f2_{idx}_{name}")
            with open(dst, "wb") as buf:
                shutil.copyfileobj(f.file, buf)
            paths_f2.append(dst)

        result = _service.consolidar_archivos(f1_paths=paths_f1, f2_paths=paths_f2)
        return result
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error durante el procesamiento de la orden de suministro: {err}")
    except Exception as err:
        raise error_interno("Error durante el procesamiento de la orden de suministro", err)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.get("/exportar/excel")
def export_excel_consolidado(
    fecha_corte: Optional[date] = Query(None, description="Fecha de corte. Se omiten las columnas anteriores a esta fecha."),
    fechas_tentativas: Optional[str] = Query(None, description="JSON de fechas personalizadas por mes extendido."),
    descuento_hoy: Optional[float] = Query(None, ge=0, le=100, description="Porcentaje a descontar solo del dia actual."),
):
    try:
        parsed_tentativas: Optional[Dict[str, str]] = None
        if fechas_tentativas:
            loaded = json.loads(fechas_tentativas)
            if isinstance(loaded, dict):
                parsed_tentativas = {str(k): str(v) for k, v in loaded.items() if v}
        temp_path, file_name = _service.export_excel(
            fecha_corte=fecha_corte, fechas_tentativas=parsed_tentativas, descuento_hoy=descuento_hoy
        )
        return FileResponse(
            path=temp_path,
            filename=file_name,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            background=BackgroundTask(lambda: os.remove(temp_path) if os.path.exists(temp_path) else None),
        )
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error al generar archivo Excel consolidado: {err}")
    except Exception as err:
        raise error_interno("Error al generar archivo Excel consolidado", err)


@router.get("/exportar/sap-pir")
def export_sap_pir_txt(
    fecha_corte: Optional[date] = Query(None, description="Fecha de corte. Solo se exportarán fechas >= fecha_corte con cantidad > 0."),
    fechas_tentativas: Optional[str] = Query(None, description="JSON de fechas personalizadas por mes extendido."),
    descuento_hoy: Optional[float] = Query(None, ge=0, le=100, description="Porcentaje a descontar solo del dia actual."),
):
    try:
        parsed_tentativas: Optional[Dict[str, str]] = None
        if fechas_tentativas:
            loaded = json.loads(fechas_tentativas)
            if isinstance(loaded, dict):
                parsed_tentativas = {str(k): str(v) for k, v in loaded.items() if v}

        temp_path, file_name = _service.export_sap_txt(
            fecha_corte=fecha_corte,
            fechas_tentativas=parsed_tentativas,
            descuento_hoy=descuento_hoy,
        )
        return FileResponse(
            path=temp_path,
            filename=file_name,
            media_type="text/plain; charset=windows-1252",
            background=BackgroundTask(lambda: os.remove(temp_path) if os.path.exists(temp_path) else None),
        )
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error al generar archivo SAP PIR (.txt): {err}")
    except Exception as err:
        raise error_interno("Error al generar archivo SAP PIR (.txt)", err)

