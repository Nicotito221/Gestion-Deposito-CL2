from datetime import date
from typing import Any, Dict, List, Optional
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
    fecha_origen: Optional[date] = None


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
    desvio_ajuste: float = 0.0


class RundownMaterialGrid(BaseModel):
    id_parametro: int
    id_material: str
    descripcion: str
    categoria_cabina: Optional[str] = None
    unidad: str
    lote_mts: Optional[float] = None
    tipo_empaque: Optional[str] = "pallet"
    scrap_porcentaje: float
    stock_inicial: float
    stock_inicial_planta: float = 0.0
    stock_inicial_total: float = 0.0
    dias: List[RundownDayCell]
    total_uso: float
    total_ingresos: float
    id_proveedor: Optional[int] = None
    nombre_proveedor: Optional[str] = None


class RundownPeriodoItem(BaseModel):
    periodo: str
    anio: int
    mes: int
    label: str
    es_firme: bool
    es_proyectado_manual: bool = False
    periodo_copia: Optional[str] = None
    total_volumen: float = 0.0


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
    dias_alerta_rojo: float = 5.0
    dias_alerta_amarillo: float = 15.0
    deposito_en_planta: bool = False
    doh_sugerido_planta: float = 1.0


class RundownProveedorItem(BaseModel):
    id_proveedor: int
    codigo_proveedor: str
    nombre: str
    id_seccion: Optional[int] = None
    activo: bool = True
    tiene_parametros: bool = False
    dias_alerta_rojo: float = 5.0
    dias_alerta_amarillo: float = 15.0
    deposito_en_planta: bool = False
    doh_sugerido_planta: float = 1.0


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
    dias_alerta_rojo: Optional[float] = Field(default=5.0, ge=0)
    dias_alerta_amarillo: Optional[float] = Field(default=15.0, ge=0)
    deposito_en_planta: bool = False
    doh_sugerido_planta: Optional[float] = Field(default=1.0, ge=0)


class RundownProveedorUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, max_length=80)
    id_seccion: Optional[int] = None
    activo: Optional[bool] = None
    dias_alerta_rojo: Optional[float] = Field(default=None, ge=0)
    dias_alerta_amarillo: Optional[float] = Field(default=None, ge=0)
    deposito_en_planta: Optional[bool] = None
    doh_sugerido_planta: Optional[float] = Field(default=None, ge=0)


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


class MaterialCatalogoItem(BaseModel):
    id_material: str
    nombre: str
    unidad: Optional[str] = "UN"
    categoria: Optional[str] = None


class RundownParametroMaterialCreate(BaseModel):
    id_material: str = Field(min_length=1, max_length=50)
    descripcion: Optional[str] = Field(default=None, max_length=150)
    unidad: str = Field(default="MTS", max_length=10)
    lote_mts: Optional[float] = Field(default=None, ge=0)
    tipo_empaque: str = Field(default="pallet", max_length=20)
    scrap_porcentaje: float = Field(default=0.0, ge=0, le=1.0)
    factor_conversion: float = Field(default=1.0, gt=0)
    categoria_cabina: Optional[str] = Field(default=None, max_length=30)
    stock_inicial_planta: float = Field(default=0.0, ge=0)
    stock_inicial_total: float = Field(default=0.0, ge=0)
    doh_sugerido_planta: Optional[float] = Field(default=None, ge=0)


class RundownParametroMaterialItem(BaseModel):
    id_parametro: int
    id_proveedor: int
    id_material: str
    descripcion: str
    unidad: str
    lote_mts: Optional[float] = None
    tipo_empaque: str = "pallet"
    scrap_porcentaje: float
    factor_conversion: float
    categoria_cabina: Optional[str] = None
    stock_inicial_planta: float
    stock_inicial_total: float
    doh_sugerido_planta: Optional[float] = None
    cant_productos: int
    activo: bool


class RundownLoteMaterialUpdate(BaseModel):
    id_parametro: Optional[int] = None
    id_material: Optional[str] = None
    lote_mts: Optional[float] = Field(default=None, ge=0)
    unidad_por_bulto: Optional[float] = Field(default=None, ge=0)
    bultos_por_pallet: Optional[int] = Field(default=None, ge=1)
    tipo_empaque: str = Field(default="pallet", pattern="^(pallet|rollo|unidad)$")



class RundownPeriodoProyeccionCreate(BaseModel):
    anio: int
    mes: int
    periodo_copia: str
    observacion: Optional[str] = None


class RundownPeriodoProyeccionItem(BaseModel):
    id_proyeccion: int
    anio: int
    mes: int
    periodo: str
    periodo_copia: str
    label: str
    observacion: Optional[str] = None
    es_oficial: bool = False
    activo: bool = True


class PlanSemanalDiaHeader(BaseModel):
    nombre: str
    fecha: str
    total: float


class PlanSemanalFila(BaseModel):
    sd: str
    id_producto: Optional[str] = None
    descripcion: Optional[str] = None
    cantidades: Dict[str, float]
    total_semana: float
    mapeado: bool = True


class PlanSemanalPreviewOut(BaseModel):
    id_seccion: int
    seccion_nombre: str
    fecha_inicio: str
    fecha_fin: str
    dias: List[PlanSemanalDiaHeader]
    filas: List[PlanSemanalFila]
    totales_dia: Dict[str, float]
    total_general: float
    advertencias: List[str] = []


class PlanSemanalItemConfirm(BaseModel):
    sd: str
    id_producto: str
    fecha: date
    cantidad: float = Field(ge=0)


class PlanSemanalConfirmRequest(BaseModel):
    fecha_inicio: date
    fecha_fin: date
    items: List[PlanSemanalItemConfirm]


class PlanSemanalConfirmOut(BaseModel):
    success: bool
    registros_plan_linea: int
    registros_produccion_planificada: int
    mensaje: str


