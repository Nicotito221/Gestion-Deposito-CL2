from datetime import date
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class RundownTransitoCreate(BaseModel):
    id_proveedor: int
    id_material: str = Field(min_length=1, max_length=50)
    fecha_eta: date
    tipo_via: str = Field(pattern=r"^(Maritimo|Aereo|Local|AjusteScrap)$")
    po_numero: Optional[str] = Field(default=None, max_length=50)
    factura_numero: Optional[str] = Field(default=None, max_length=50)
    cantidad: float
    observacion: Optional[str] = Field(default=None, max_length=255)


class RundownTransitoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_transito: int
    id_proveedor: int
    id_material: str
    fecha_eta: str
    tipo_via: str
    po_numero: Optional[str] = None
    factura_numero: Optional[str] = None
    cantidad: float
    observacion: Optional[str] = None


class RundownStockInicialUpdate(BaseModel):
    id_parametro: int
    stock_inicial: float = Field(ge=0)
    tipo_stock: str = Field(default="total", pattern=r"^(total|planta)$")


class RundownStockAjusteUpdate(BaseModel):
    id_parametro: int
    id_proveedor: int
    id_material: str = Field(min_length=1, max_length=50)
    fecha: date
    tipo_stock: str = Field(default="total", pattern=r"^(total|planta)$")
    stock_ajustado: float = Field(ge=0)
    observacion: Optional[str] = Field(default=None, max_length=255)


class RundownScrapUpdate(BaseModel):
    id_parametro: int
    scrap_porcentaje: float = Field(ge=0, le=1.0)


class RundownIngresoDiaUpdate(BaseModel):
    id_proveedor: int
    id_material: str = Field(min_length=1, max_length=50)
    fecha_eta: date
    tipo_via: str = Field(pattern=r"^(Maritimo|Aereo|Local|AjusteScrap)$")
    cantidad: float
    po_numero: Optional[str] = Field(default=None, max_length=50)
    factura_numero: Optional[str] = Field(default=None, max_length=50)
    observacion: Optional[str] = Field(default=None, max_length=255)


class RundownDayCell(BaseModel):
    fecha: str
    dia_nombre: str
    produccion_vehiculos: float
    uso: float
    plan_maritimo: float
    pedidos_aereos: float
    entregas_locales: float
    ajuste_scrap: float
    stock_final: float
    dias_cobertura: float
    alerta_quiebre: bool
    tiene_ajuste: bool = False


class RundownMaterialGrid(BaseModel):
    id_parametro: int
    id_material: str
    descripcion: str
    categoria_cabina: Optional[str] = None
    unidad: str
    lote_mts: Optional[float] = None
    scrap_porcentaje: float
    stock_inicial: float
    stock_inicial_planta: float = 0.0
    stock_inicial_total: float = 0.0
    dias: List[RundownDayCell]
    total_uso: float
    total_ingresos: float


class RundownPeriodoItem(BaseModel):
    periodo: str
    anio: int
    mes: int
    label: str
    es_firme: bool


class RundownSupplierReport(BaseModel):
    id_proveedor: int
    codigo_proveedor: str
    nombre_proveedor: str
    fecha_desde: str
    fecha_hasta: str
    alcance: str = "total"
    periodo_actual: str = "2026-09"
    es_mes_firme: bool = True
    dias_laborales_mes: int = 23
    meses_disponibles: List[RundownPeriodoItem] = []
    columnas_fechas: List[str]
    materiales: List[RundownMaterialGrid]


class RundownProveedorItem(BaseModel):
    id_proveedor: int
    codigo_proveedor: str
    nombre: str
    id_seccion: Optional[int] = None
    activo: bool = True
    tiene_parametros: bool = False


class RundownSeccionItem(BaseModel):
    id_seccion: int
    codigo: str
    nombre: str
    descripcion: Optional[str] = None
    orden: int
    activo: bool = True
    proveedores: List[RundownProveedorItem] = []


class RundownSeccionCreate(BaseModel):
    codigo: str = Field(min_length=1, max_length=50)
    nombre: str = Field(min_length=1, max_length=100)
    descripcion: Optional[str] = Field(default=None, max_length=255)
    orden: int = 1


class RundownProveedorCreate(BaseModel):
    codigo_proveedor: str = Field(min_length=1, max_length=30)
    nombre: str = Field(min_length=1, max_length=80)
    id_seccion: Optional[int] = None
    pais: Optional[str] = Field(default=None, max_length=30)


class RundownProveedorUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, max_length=80)
    id_seccion: Optional[int] = None
    activo: Optional[bool] = None


class RundownCalendarioDia(BaseModel):
    fecha: str
    dia: int
    dia_semana: int
    dia_nombre: str
    es_laboral: bool
    observacion: Optional[str] = None


class RundownCalendarioMesOut(BaseModel):
    anio: int
    mes: int
    mes_nombre: str
    es_mes_firme: bool
    dias_laborales_count: int
    volumen_total_planificado: float
    promedio_diario_estimado: float
    dias: List[RundownCalendarioDia]


class RundownCalendarioDiaUpdate(BaseModel):
    fecha: str
    es_laboral: bool
    observacion: Optional[str] = Field(default=None, max_length=150)


class RundownCalendarioMesSave(BaseModel):
    anio: int
    mes: int
    dias: List[RundownCalendarioDiaUpdate]
