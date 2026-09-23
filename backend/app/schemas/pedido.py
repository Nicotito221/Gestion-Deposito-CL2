from datetime import date, datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


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
    materiales: Optional[List[SugerenciaMaterialInput]] = None
    fecha_conteo: Optional[date] = None
    fecha_requerida: Optional[date] = None
    modalidad_turnos: str = Field(default="completo")
    turnos: Optional[List[str]] = None


class SugerenciaMaterialDetalle(BaseModel):
    id_parametro: Optional[int] = None
    id_material: str
    nombre: str
    unidad: str
    id_proveedor: int
    nombre_proveedor: str
    stock_contado: float
    consumo_diario: float
    consumo_sig: float = 0.0
    doh_sugerido_planta: float
    stock_objetivo: float
    stock_proyectado_inicio: float = 0.0
    stock_minimo_inicio: float = 0.0
    lote_minimo: Optional[float] = None
    tipo_empaque: str = "pallet"
    tamanio_lote: Optional[float] = None
    cantidad_pallets_sugerida: int = 0
    pallets_por_turno: Dict[str, int] = {}
    pedidos_existentes: List[PedidoExistenteItem] = []
    cantidad_ya_pedida_total: float = 0.0
    cantidad_sugerida_bruta: float = 0.0
    cantidad_sugerida_neta: float = 0.0
    desglose_turnos: Dict[str, float] = {}
    pedidos_por_turno: Dict[str, float] = {}
    sugerido_por_turno: Dict[str, float] = {}



class CalcularSugerenciaResponse(BaseModel):
    fecha_requerida: str
    modalidad_turnos: str
    turnos: List[str]
    total_materiales: int
    materiales_a_pedir: int
    items: List[SugerenciaMaterialDetalle]


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


class PedidoItemOut(BaseModel):
    id_material: str
    nombre_material: Optional[str] = None
    unidad: Optional[str] = "MTS"
    cantidad_pedida: float
    cantidad_preparada: float = 0.0
    cantidad_entregada: float = 0.0
    estado: str = "pendiente"
    comentario: Optional[str] = None


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
    total_items: int = 0
    items: List[PedidoItemOut] = []


class PedidosListResponse(BaseModel):
    items: List[PedidoOut]
    total: int
