from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class StockMaterialItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_material: str
    nombre: str
    unidad: str
    categoria: Optional[str] = None
    stock_actual: float
    stock_planta: float = 0.0
    stock_cl2: float = 0.0
    stock_total: float = 0.0
    id_proveedor: Optional[int] = None
    nombre_proveedor: Optional[str] = None
    deposito_en_planta: bool = False
    fecha_actualizacion: Optional[datetime] = None
    id_parametro: Optional[int] = None
    lote_mts: Optional[float] = None
    unidad_por_bulto: Optional[float] = None
    bultos_por_pallet: Optional[int] = None
    tipo_empaque: Optional[str] = "pallet"


class StockListResponse(BaseModel):
    items: List[StockMaterialItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class StockAjusteInput(BaseModel):
    nuevo_stock: Optional[float] = Field(default=None, ge=0)
    nuevo_stock_planta: Optional[float] = Field(default=None, ge=0)
    nuevo_stock_cl2: Optional[float] = Field(default=None, ge=0)
    observacion: Optional[str] = Field(default=None, max_length=250)
    id_usuario: Optional[int] = None


class StockAjusteResponse(BaseModel):
    id_material: str
    stock_anterior: float
    stock_nuevo: float
    stock_planta: Optional[float] = None
    stock_cl2: Optional[float] = None
    stock_total: Optional[float] = None
    mensaje: str


class StockMovimientoItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_movimiento: int
    id_material: str
    nombre_material: Optional[str] = None
    unidad: Optional[str] = None
    tipo: str
    cantidad: float
    stock_anterior: float
    stock_posterior: float
    id_usuario: int
    nombre_usuario: Optional[str] = None
    fecha: datetime
    observacion: Optional[str] = None
    id_pedido: Optional[int] = None
    id_remito: Optional[str] = None


class StockMovimientosResponse(BaseModel):
    items: List[StockMovimientoItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class MaterialConfigItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_material: str
    nombre: str
    unidad: str
    categoria: Optional[str] = None
    id_proveedor: Optional[int] = None
    nombre_proveedor: Optional[str] = None
    deposito_en_planta: bool = False
    tipo_empaque: str = "pallet"
    lote_mts: Optional[float] = None
    unidad_por_bulto: Optional[float] = None
    bultos_por_pallet: Optional[int] = None
    doh_sugerido_planta: float = 1.0
    id_parametro: Optional[int] = None
    activo: bool = True


class MaterialConfigListResponse(BaseModel):
    items: List[MaterialConfigItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class MaterialConfigUpdate(BaseModel):
    id_material: str
    id_proveedor: Optional[int] = None
    deposito_en_planta: bool = False
    tipo_empaque: str = Field(default="pallet", pattern="^(pallet|rollo|unidad)$")
    lote_mts: Optional[float] = Field(default=None, ge=0)
    unidad_por_bulto: Optional[float] = Field(default=None, ge=0)
    bultos_por_pallet: Optional[int] = Field(default=None, ge=1)
    doh_sugerido_planta: float = Field(default=1.0, ge=0)
