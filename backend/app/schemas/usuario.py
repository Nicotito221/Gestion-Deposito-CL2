from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

RolUsuario = Literal[
    "administrador",
    "gerente",
    "jefe",
    "analista",
    "deposito",
    "contador_ciclico",
    "operario_deposito",
    "operario_planta",
    "supervisor",
    "solicitante",
]


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=1)


class UsuarioBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    nombre: str = Field(..., min_length=1, max_length=100)
    apellido: str = Field(..., min_length=1, max_length=100)
    rol: RolUsuario
    sector: str = Field("TODOS", max_length=50)
    email: Optional[str] = Field(None, max_length=120)
    activo: bool = True


class UsuarioCreate(UsuarioBase):
    password: str = Field(..., min_length=3, max_length=100)


class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    apellido: Optional[str] = Field(None, min_length=1, max_length=100)
    rol: Optional[RolUsuario] = None
    sector: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=120)
    activo: Optional[bool] = None


class PasswordChangeRequest(BaseModel):
    password_nuevo: str = Field(..., min_length=3, max_length=100)


class UsuarioResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_usuario: int
    username: str
    nombre: str
    apellido: str
    rol: str
    sector: str
    email: Optional[str] = None
    activo: bool
    eliminado: bool = False
    fecha_creacion: Optional[datetime] = None
    ultimo_acceso: Optional[datetime] = None


class LoginResponse(BaseModel):
    token: str
    usuario: UsuarioResponse
