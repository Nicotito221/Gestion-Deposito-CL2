from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class TraceEventOut(BaseModel):
    timestamp: str
    action: str
    user: str
    role: str
    detail: str
    type: Literal["solicitud", "aprobacion", "preparacion", "entrega", "ajuste", "sistema"]


class TraceOrderOut(BaseModel):
    id: str
    number: str
    sector: str
    status: str
    events: List[TraceEventOut] = Field(default_factory=list)


class AuditLogEntryOut(TraceEventOut):
    orderNumber: str
    sector: str


class AuditListResponse(BaseModel):
    orders: List[TraceOrderOut]
    total_orders: int
