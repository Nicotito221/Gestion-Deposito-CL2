from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class DespachoItem(BaseModel):
    id_despacho: int
    id_producto: str
    empresa_destino: str
    anio: int
    mes: int
    cantidad: float
    observacion: Optional[str] = None


class DespachoUpsert(BaseModel):
    id_producto: str = Field(..., min_length=1, max_length=30)
    empresa_destino: str = Field(..., min_length=1, max_length=100)
    anio: int = Field(..., ge=2000, le=2100)
    mes: int = Field(..., ge=1, le=12)
    cantidad: float = Field(..., ge=0)
    observacion: Optional[str] = Field(None, max_length=250)

    @field_validator("id_producto", "empresa_destino")
    @classmethod
    def _limpiar(cls, v: str) -> str:
        limpio = v.strip()
        if not limpio:
            raise ValueError("No puede estar vacío.")
        return limpio

    @field_validator("id_producto")
    @classmethod
    def _mayusculas(cls, v: str) -> str:
        return v.upper()


class DespachoUpsertBatch(BaseModel):
    items: List[DespachoUpsert] = Field(..., min_length=1)


class DespachoUpsertResult(BaseModel):
    guardados: int
    eliminados: int
    productos_no_encontrados: List[str]
