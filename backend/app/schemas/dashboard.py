from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class DashboardKpis(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    pedidos_pendientes: int
    pedidos_en_preparacion: int
    pedidos_parciales: int
    pedidos_completados_hoy: int
    total_pedidos: int
    materiales_criticos_count: int
    criticos_planta_count: int = 0
    criticos_tbar_count: int = 0
    remitos_hoy: int
    fill_rate_porcentaje: float
    turno_actual: str


class DashboardPedidoItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_pedido: int
    sector: str
    prioridad: str
    estado: str
    fecha_creacion: Optional[datetime] = None
    fecha_requerida: Optional[date] = None
    turno: Optional[str] = None
    usuario_solicitante: Optional[str] = None
    total_items: int = 0
    id_remito: Optional[str] = None
    es_demorado: bool = False


class DashboardMaterialCritico(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_material: str
    nombre: str
    unidad: str
    stock_cl2: float
    stock_planta: float
    stock_total: float
    nombre_proveedor: Optional[str] = None
    alerta_tipo: str
    alerta_label: str
    prioridad: str
    origen_alerta: str = "ambos"


class DashboardResumenResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    kpis: DashboardKpis
    ultimos_pedidos: List[DashboardPedidoItem]
    materiales_criticos: List[DashboardMaterialCritico]
