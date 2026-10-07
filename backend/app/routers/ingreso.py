from typing import List, Optional
from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile, status

from app.core.security import verify_access_token
from app.schemas.ingreso import (
    IngresoConfirmarRecepcion,
    IngresoCreate,
    IngresoOut,
    ParsedInvoiceResult,
)
from app.services.ingreso_service import IngresoService
from app.services.invoice_parser_service import InvoiceParserService

router = APIRouter(prefix="", tags=["Ingresos / Remitos de Proveedores"])

ADMIN_ROLES = {"administrador", "gerente", "jefe"}


def get_ingreso_service() -> IngresoService:
    return IngresoService()


def get_invoice_parser_service() -> InvoiceParserService:
    return InvoiceParserService()


def get_current_user_payload(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split("Bearer ", 1)[1].strip()
    return verify_access_token(token)


@router.post("/parse-document", response_model=ParsedInvoiceResult)
async def parse_invoice_document(
    file: UploadFile = File(...),
    parser_service: InvoiceParserService = Depends(get_invoice_parser_service),
) -> ParsedInvoiceResult:
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de archivo no soportado. Debe ser un documento PDF.",
        )
    try:
        content = await file.read()
        return parser_service.parse_pdf_invoice(content, file.filename)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al procesar el archivo PDF: {str(e)}",
        )


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
        raise HTTPException(status_code=500, detail=f"Error al listar ingresos: {e}")


@router.get("/{id_ingreso}", response_model=IngresoOut)
def obtener_ingreso(
    id_ingreso: int,
    service: IngresoService = Depends(get_ingreso_service),
) -> IngresoOut:
    return service.get_ingreso_by_id(id_ingreso)


@router.post("", response_model=IngresoOut, status_code=status.HTTP_201_CREATED)
def crear_ingreso(
    data: IngresoCreate,
    id_usuario: Optional[int] = Query(default=None, description="ID del usuario emisor"),
    service: IngresoService = Depends(get_ingreso_service),
) -> IngresoOut:
    try:
        return service.create_ingreso(data, id_usuario=id_usuario)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al registrar factura/remito: {e}")


@router.put("/{id_ingreso}/recepcion", response_model=IngresoOut)
def confirmar_recepcion_ingreso(
    id_ingreso: int,
    data: IngresoConfirmarRecepcion,
    id_usuario: Optional[int] = Query(default=None, description="ID del usuario que recibe en depósito"),
    service: IngresoService = Depends(get_ingreso_service),
) -> IngresoOut:
    try:
        return service.confirmar_recepcion(id_ingreso, data, id_usuario=id_usuario)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al confirmar recepción en depósito: {e}")


@router.delete("/{id_ingreso}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_ingreso(
    id_ingreso: int,
    token_data: Optional[dict] = Depends(get_current_user_payload),
    service: IngresoService = Depends(get_ingreso_service),
) -> None:
    user_rol = (token_data.get("rol") or "").lower() if token_data else ""
    if user_rol not in ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permisos para eliminar remitos. Se requiere rol Jefe, Gerente o Administrador.",
        )
    user_id = token_data.get("id_usuario") if token_data else None
    try:
        service.delete_ingreso(id_ingreso, id_usuario=user_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar comprobante #{id_ingreso}: {e}")
