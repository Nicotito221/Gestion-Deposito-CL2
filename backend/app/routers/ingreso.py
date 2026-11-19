from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.core.auth_deps import ROLES_DEPOSITO, ROLES_JEFATURA, id_usuario_de, require_roles, require_user
from app.core.errors import error_interno
from app.schemas.ingreso import (
    IngresoConfirmarRecepcion,
    IngresoCreate,
    IngresoOut,
    ParsedInvoiceResult,
)
from app.services.ingreso_service import IngresoService
from app.services.invoice_parser_service import InvoiceParserService

router = APIRouter(prefix="", tags=["Ingresos / Remitos de Proveedores"], dependencies=[Depends(require_user)])
require_deposito = require_roles(ROLES_DEPOSITO)
require_jefatura = require_roles(ROLES_JEFATURA)
MAX_PDF_BYTES = 15 * 1024 * 1024


def get_ingreso_service() -> IngresoService:
    return IngresoService()


def get_invoice_parser_service() -> InvoiceParserService:
    return InvoiceParserService()


@router.post("/parse-document", response_model=ParsedInvoiceResult)
async def parse_invoice_document(
    file: UploadFile = File(...),
    _: dict = Depends(require_deposito),
    parser_service: InvoiceParserService = Depends(get_invoice_parser_service),
) -> ParsedInvoiceResult:
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de archivo no soportado. Debe ser un documento PDF.",
        )
    try:
        content = await file.read(MAX_PDF_BYTES + 1)
        if len(content) > MAX_PDF_BYTES:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="El PDF supera los 15 MB.")
        return parser_service.parse_pdf_invoice(content, file.filename)
    except HTTPException:
        raise
    except Exception as e:
        raise error_interno("Error al procesar el archivo PDF", e)


@router.get("", response_model=List[IngresoOut])
def listar_ingresos(
    estado: Optional[str] = Query(default=None, description="Filtrar por estado: pendiente, parcial, completo"),
    id_proveedor: Optional[int] = Query(default=None, description="Filtrar por proveedor"),
    search: Optional[str] = Query(default=None, description="Búsqueda por factura, PO o proveedor"),
    service: IngresoService = Depends(get_ingreso_service),
) -> List[IngresoOut]:
    try:
        return service.get_ingresos(estado=estado, id_proveedor=id_proveedor, search=search)
    except Exception as e:
        raise error_interno("Error al listar ingresos", e)


@router.get("/{id_ingreso}", response_model=IngresoOut)
def obtener_ingreso(
    id_ingreso: int,
    service: IngresoService = Depends(get_ingreso_service),
) -> IngresoOut:
    return service.get_ingreso_by_id(id_ingreso)


@router.post("", response_model=IngresoOut, status_code=status.HTTP_201_CREATED)
def crear_ingreso(
    data: IngresoCreate,
    token_data: dict = Depends(require_deposito),
    service: IngresoService = Depends(get_ingreso_service),
) -> IngresoOut:
    try:
        return service.create_ingreso(data, id_usuario=id_usuario_de(token_data))
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise error_interno("Error al registrar factura/remito", e)


@router.put("/{id_ingreso}/recepcion", response_model=IngresoOut)
def confirmar_recepcion_ingreso(
    id_ingreso: int,
    data: IngresoConfirmarRecepcion,
    token_data: dict = Depends(require_deposito),
    service: IngresoService = Depends(get_ingreso_service),
) -> IngresoOut:
    try:
        return service.confirmar_recepcion(id_ingreso, data, id_usuario=id_usuario_de(token_data))
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise error_interno("Error al confirmar recepción en depósito", e)


@router.delete("/{id_ingreso}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_ingreso(
    id_ingreso: int,
    token_data: dict = Depends(require_jefatura),
    service: IngresoService = Depends(get_ingreso_service),
) -> None:
    try:
        service.delete_ingreso(id_ingreso, id_usuario=id_usuario_de(token_data))
    except HTTPException:
        raise
    except Exception as e:
        raise error_interno(f"Error al eliminar comprobante #{id_ingreso}", e)
