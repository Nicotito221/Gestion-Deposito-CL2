from datetime import date
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class DemandRowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    part_number: str
    tasa_code: str
    description: str
    dock: str = ""
    box_type: str = ""
    qty_per_box: int = 1
    daily_values: Dict[str, float] = Field(default_factory=dict)
    tentative_values: Dict[str, float] = Field(default_factory=dict)
    tentative_total: float = 0.0
    total: float = 0.0
    status: str = "validado"


class SupplySummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    periodo: str
    total_demanda: float
    piezas_validadas: int
    total_piezas: int
    columnas_diarias: List[str] = Field(default_factory=list)
    columnas_tentativas: List[str] = Field(default_factory=list)
    columnas_fechas_map: Dict[str, str] = Field(default_factory=dict)
    items: List[DemandRowOut]


class SupplyConsolidateResult(BaseModel):
    total_items: int
    total_unidades: float
    columnas_diarias: List[str]
    columnas_tentativas: List[str]
    columnas_fechas_map: Dict[str, str] = Field(default_factory=dict)
    items: List[DemandRowOut]
    mensaje: str


class SupplyItemUpdate(BaseModel):
    id_producto: str
    fecha: date
    cantidad: float
