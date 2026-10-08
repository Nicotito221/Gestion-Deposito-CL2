from datetime import date, datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field, field_validator
from app.core.time import get_argentina_today


class PedidoExistenteItem(BaseModel):
    id_pedido: int
    turno: Optional[str] = None
    cantidad_pedida: float
    estado: str


class SugerenciaMaterialInput(BaseModel):
    id_material: str
    stock_contado: float = Field(ge=0)


class CalcularSugerenciaRequest(BaseModel):
    id_conteo: Optional[int] = None
    solo_conteo: Optional[bool] = False
    materiales: Optional[List[SugerenciaMaterialInput]] = None
    fecha_conteo: Optional[date] = None
    fecha_requerida: Optional[date] = None
    modalidad_turnos: str = Field(default="completo")
    turnos: Optional[List[str]] = None
    turno: Optional[str] = None
    sector: Optional[str] = None


class SugerenciaMaterialDetalle(BaseModel):
    id_parametro: Optional[int] = None
    id_material: str
    nombre: str
    unidad: str
    id_proveedor: int
    nombre_proveedor: str
    stock_contado: float
    stock_cl2: float = 0.0
    en_cl2: bool = True
    consumo_diario: float
    consumo_sig: float = 0.0
    doh_sugerido_planta: float
    stock_objetivo: float
    stock_proyectado_inicio: float = 0.0
    stock_minimo_inicio: float = 0.0
    lote_minimo: Optional[float] = None
    tipo_empaque: str = "pallet"
    tamanio_lote: Optional[float] = None
    unidad_por_bulto: Optional[float] = None
    bultos_por_pallet: Optional[int] = None
    cantidad_pallets_sugerida: int = 0
    cantidad_bultos_sugerida: Optional[int] = None
    pallets_por_turno: Dict[str, int] = {}
    pedidos_existentes: List[PedidoExistenteItem] = []
    cantidad_ya_pedida_total: float = 0.0
    cantidad_sugerida_bruta: float = 0.0
    cantidad_sugerida_neta: float = 0.0
    desglose_turnos: Dict[str, float] = {}
    pedidos_por_turno: Dict[str, float] = {}
    sugerido_por_turno: Dict[str, float] = {}


class ReglaSugerenciaConfigOut(BaseModel):
    factor_consumo_siguiente: float = Field(ge=0.0, le=5.0)
    descripcion: Optional[str] = None
    fecha_actualizacion: Optional[datetime] = None


class ReglaSugerenciaConfigUpdate(BaseModel):
    factor_consumo_siguiente: float = Field(ge=0.0, le=5.0, description="Factor multiplicador para el consumo del día siguiente")



class CalcularSugerenciaResponse(BaseModel):
    fecha_requerida: str
    modalidad_turnos: str
    turnos: List[str]
    total_materiales: int
    materiales_a_pedir: int
    items: List[SugerenciaMaterialDetalle]
    turno_sugerido: Optional[str] = None


class PedidoItemInput(BaseModel):
    id_material: str
    cantidad: float = Field(gt=0)
    comentario: Optional[str] = None


class PedidoCreate(BaseModel):
    sector: str = Field(default="produccion")
    prioridad: str = Field(default="normal")
    origen: str = Field(default="conteo_planta")
    fecha_requerida: Optional[date] = None
    turno: Optional[str] = None
    id_conteo: Optional[int] = None
    comentario: Optional[str] = None
    id_usuario_solicitante: Optional[int] = None
    items: List[PedidoItemInput] = Field(min_length=1)

    @field_validator("fecha_requerida")
    @classmethod
    def validar_fecha_no_pasada(cls, v: Optional[date]) -> Optional[date]:
        if v is not None and v < get_argentina_today():
            raise ValueError("La fecha requerida no puede ser anterior a la fecha actual")
        return v


class PedidoItemOut(BaseModel):
    id_material: str
    nombre_material: Optional[str] = None
    unidad: Optional[str] = "MTS"
    cantidad_pedida: float
    cantidad_preparada: float = 0.0
    cantidad_entregada: float = 0.0
    cantidad_pendiente: float = 0.0
    estado: str = "pendiente"
    comentario: Optional[str] = None
    tipo_empaque: Optional[str] = "unidad"
    tamanio_lote: Optional[float] = 1.0
    bultos_por_pallet: Optional[int] = None
    unidad_por_bulto: Optional[float] = None
    cantidad_pallets: Optional[int] = None
    cantidad_pallets_preparada: Optional[int] = None
    cantidad_pallets_entregada: Optional[int] = None
    cantidad_pallets_pendiente: Optional[int] = None
    cantidad_bultos: Optional[int] = None
    cantidad_bultos_preparada: Optional[int] = None
    cantidad_bultos_entregada: Optional[int] = None
    cantidad_bultos_pendiente: Optional[int] = None



class RemitoItemOut(BaseModel):
    id_material: str
    nombre_material: Optional[str] = None
    unidad: Optional[str] = "UN"
    cantidad: float
    tipo_empaque: Optional[str] = "unidad"
    tamanio_lote: Optional[float] = 1.0
    cantidad_pallets: Optional[int] = None
    bultos_por_pallet: Optional[int] = None
    cantidad_bultos: Optional[int] = None


class RemitoDetalleOut(BaseModel):
    id_remito: str
    id_pedido: int
    fecha_emision: datetime
    fecha_entrega: Optional[datetime] = None
    estado: str
    id_usuario_emisor: Optional[int] = None
    usuario_emisor: Optional[str] = None
    observacion: Optional[str] = None
    sector_destino: Optional[str] = None
    usuario_solicitante: Optional[str] = None
    fecha_requerida: Optional[date] = None
    turno: Optional[str] = None
    total_items: int = 0
    total_pallets: int = 0
    total_unidades: float = 0.0
    items: List[RemitoItemOut] = []


class PedidoOut(BaseModel):
    id_pedido: int
    sector: str
    prioridad: str
    origen: str
    estado: str
    fecha_creacion: datetime
    fecha_despacho: Optional[datetime] = None
    fecha_entrega: Optional[datetime] = None
    fecha_requerida: Optional[date] = None
    turno: Optional[str] = None
    id_conteo: Optional[int] = None
    comentario: Optional[str] = None
    id_usuario_solicitante: Optional[int] = None
    usuario_solicitante: Optional[str] = None
    id_remito: Optional[str] = None
    remitos: List[RemitoDetalleOut] = []
    total_items: int = 0
    items: List[PedidoItemOut] = []
    es_demorado: bool = False


class PedidoCancelarRequest(BaseModel):
    motivo: str = Field(min_length=1, max_length=500, description="Motivo de la cancelación del pedido")
    id_usuario: Optional[int] = None


class PedidosListResponse(BaseModel):
    items: List[PedidoOut]
    total: int


class PreparacionItemUpdate(BaseModel):
    id_material: str
    cantidad_preparada: float = Field(ge=0)
    estado: Optional[str] = None
    comentario: Optional[str] = None


class PreparacionPedidoUpdate(BaseModel):
    accion: str = Field(description="'guardar_avance' | 'confirmar_parcial' | 'confirmar_completo'")
    comentario: Optional[str] = None
    items: List[PreparacionItemUpdate]


class PreparacionPedidoResponse(BaseModel):
    pedido: PedidoOut
    id_remito: Optional[str] = None
    mensaje: str
