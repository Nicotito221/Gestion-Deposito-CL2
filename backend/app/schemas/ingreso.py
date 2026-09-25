from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class IngresoDetalleCreate(BaseModel):
    id_material: str
    cantidad_facturada: float = Field(gt=0, description="Cantidad facturada en unidad del material")
    observacion: Optional[str] = None


class IngresoCreate(BaseModel):
    id_proveedor: int
    numero_factura: str = Field(min_length=1, max_length=100)
    orden_compra: Optional[str] = Field(default=None, max_length=100)
    fecha_emision: Optional[date] = None
    observacion: Optional[str] = None
    confirmar_inmediato: bool = False
    fecha_recepcion: Optional[date] = None
    items: List[IngresoDetalleCreate] = Field(min_length=1)


class IngresoRecepcionItem(BaseModel):
    id_material: str
    cantidad_recibida: float = Field(ge=0, description="Cantidad efectivamente recibida en depósito")
    conforme: bool = True
    observacion: Optional[str] = None


class IngresoConfirmarRecepcion(BaseModel):
    fecha_recepcion: Optional[date] = None
    observacion: Optional[str] = None
    items: List[IngresoRecepcionItem] = Field(min_length=1)


class IngresoDetalleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_ingreso_detalle: int
    id_material: str
    nombre_material: Optional[str] = None
    unidad: str = "UN"
    cantidad_facturada: float
    cantidad_recibida: Optional[float] = None
    conforme: bool = True
    observacion: Optional[str] = None


class IngresoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_ingreso: int
    id_proveedor: int
    nombre_proveedor: Optional[str] = None
    codigo_proveedor: Optional[str] = None
    deposito_en_planta: bool = False
    numero_factura: str
    orden_compra: Optional[str] = None
    estado: str
    fecha_emision: Optional[date] = None
    fecha_recepcion: Optional[datetime] = None
    id_usuario_creacion: Optional[int] = None
    usuario_creacion: Optional[str] = None
    id_usuario_recepcion: Optional[int] = None
    usuario_recepcion: Optional[str] = None
    observacion: Optional[str] = None
    total_items: int = 0
    items: List[IngresoDetalleOut] = []
