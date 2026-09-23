from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class ConteoMaterialSearchItem(BaseModel):
    id_material: str
    nombre: str
    unidad: str
    id_proveedor: Optional[int] = None
    nombre_proveedor: Optional[str] = None
    deposito_en_planta: bool = False
    stock_teorico: float = 0.0


class MaterialConteoItemInput(BaseModel):
    id_material: str = Field(..., min_length=1)
    stock_contado: float = Field(..., ge=0)
    observacion: Optional[str] = None


class ConteoCreateRequest(BaseModel):
    fecha_impacto: Optional[date] = None
    observacion: Optional[str] = None
    items: List[MaterialConteoItemInput] = Field(..., min_length=1)


class MaterialConteoItemResponse(BaseModel):
    id_conteo: int
    id_material: str
    nombre_material: Optional[str] = None
    unidad: Optional[str] = None
    nombre_proveedor: Optional[str] = None
    stock_teorico: float
    stock_contado: float
    desvio: float
    observacion: Optional[str] = None


class ConteoResponse(BaseModel):
    id_conteo: int
    tipo: str
    id_usuario: int
    nombre_usuario: Optional[str] = None
    estado: str
    fecha_impacto: date
    fecha_inicio: Optional[datetime] = None
    fecha_finalizacion: Optional[datetime] = None
    observacion: Optional[str] = None
    total_items: int
    items: List[MaterialConteoItemResponse] = []


class ConteoHistoricoItem(BaseModel):
    id_conteo: int
    tipo: str
    id_usuario: int
    nombre_usuario: Optional[str] = None
    estado: str
    fecha_impacto: Optional[date] = None
    fecha_inicio: Optional[datetime] = None
    fecha_finalizacion: Optional[datetime] = None
    observacion: Optional[str] = None
    total_items: int = 0
    total_desvio: float = 0.0


class ConteoHistoricoResponse(BaseModel):
    items: List[ConteoHistoricoItem]
    total: int
