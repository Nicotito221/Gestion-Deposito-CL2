from dataclasses import dataclass
from decimal import Decimal
from typing import Dict, List, Optional


@dataclass(slots=True)
class MaterialRecord:
    id_material: str
    nombre: str
    unidad: str = "UN"


@dataclass(slots=True)
class BomRelationRecord:
    id_producto_raiz: str
    id_padre: str
    id_hijo: str
    cantidad: Decimal
    unidad: str
    nivel: int
    orden: int


@dataclass(slots=True)
class BomParseResult:
    materiales: Dict[str, MaterialRecord]
    relaciones: List[BomRelationRecord]
    total_lineas_archivo: int


@dataclass(slots=True)
class BomImportResult:
    id_version: int
    nombre_archivo: str
    total_lineas_procesadas: int
    nuevos_materiales_registrados: int
    total_relaciones_creadas: int
    tiempo_segundos: float
    mensaje: str


from pydantic import BaseModel, ConfigDict, Field, field_validator


class BomVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_version: int
    nombre_archivo: str
    fecha_importacion: str
    total_lineas: int
    es_vigente: bool
    observacion: Optional[str] = None


class BomEstructuraItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_bom: int
    id_version: int
    nivel: int
    id_producto_raiz: str
    id_padre: str
    id_hijo: str
    descripcion_hijo: Optional[str] = None
    cantidad: float
    unidad: str
    orden: int


class BomEstructuraResponse(BaseModel):
    id_version: Optional[int] = None
    nombre_archivo: Optional[str] = None
    total: int = 0
    items: List[BomEstructuraItemOut] = []


class SetComponenteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_set_componente: int
    sector: Optional[str] = None
    sd: Optional[str] = None
    codigo_tasa: str
    codigo_sap_padre: str
    id_material_hijo: str
    descripcion_hijo: Optional[str] = None
    cantidad: float
    unidad: str = "UN"
    activo: bool = True


class SetComponenteCreate(BaseModel):
    sector: Optional[str] = None
    sd: Optional[str] = None
    codigo_tasa: str = Field(min_length=1, max_length=50)
    codigo_sap_padre: str = Field(min_length=1, max_length=50)
    id_material_hijo: str = Field(min_length=1, max_length=50)
    cantidad: float = Field(gt=0)
    unidad: str = Field(default="UN", max_length=10)

    @field_validator("sector", mode="before")
    @classmethod
    def sanitize_sector(cls, v: Optional[str]) -> Optional[str]:
        if isinstance(v, str) and v.strip().lower() == "amnrest":
            return "Armrest"
        return v


class SetComponenteUpdate(BaseModel):
    sector: Optional[str] = None
    sd: Optional[str] = None
    codigo_tasa: Optional[str] = Field(default=None, max_length=50)
    codigo_sap_padre: Optional[str] = Field(default=None, max_length=50)
    id_material_hijo: Optional[str] = Field(default=None, max_length=50)
    cantidad: Optional[float] = Field(default=None, gt=0)
    unidad: Optional[str] = Field(default=None, max_length=10)
    activo: Optional[bool] = None

    @field_validator("sector", mode="before")
    @classmethod
    def sanitize_sector(cls, v: Optional[str]) -> Optional[str]:
        if isinstance(v, str) and v.strip().lower() == "amnrest":
            return "Armrest"
        return v


