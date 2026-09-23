from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from app.schemas.usuario import (
    PasswordChangeRequest,
    UsuarioCreate,
    UsuarioResponse,
    UsuarioUpdate,
)
from app.services.usuario_service import UsuarioService, get_usuario_service

router = APIRouter(prefix="/api/usuarios", tags=["Gestión de Usuarios"])


@router.get("", response_model=List[UsuarioResponse])
def list_usuarios(
    rol: Optional[str] = Query(None, description="Filtrar por rol"),
    sector: Optional[str] = Query(None, description="Filtrar por sector"),
    solo_activos: bool = Query(False, description="Mostrar únicamente usuarios activos"),
    service: UsuarioService = Depends(get_usuario_service),
):
    users = service.list_users(rol=rol, sector=sector, solo_activos=solo_activos)
    return [UsuarioResponse.model_validate(u) for u in users]


@router.post("", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
def create_usuario(
    req: UsuarioCreate,
    service: UsuarioService = Depends(get_usuario_service),
):
    created = service.create_user(req)
    return UsuarioResponse.model_validate(created)


@router.get("/{id_usuario}", response_model=UsuarioResponse)
def get_usuario(
    id_usuario: int,
    service: UsuarioService = Depends(get_usuario_service),
):
    user = service.get_by_id(id_usuario)
    return UsuarioResponse.model_validate(user)


@router.put("/{id_usuario}", response_model=UsuarioResponse)
def update_usuario(
    id_usuario: int,
    req: UsuarioUpdate,
    service: UsuarioService = Depends(get_usuario_service),
):
    updated = service.update_user(id_usuario, req)
    return UsuarioResponse.model_validate(updated)


@router.put("/{id_usuario}/password", status_code=status.HTTP_200_OK)
def change_usuario_password(
    id_usuario: int,
    req: PasswordChangeRequest,
    service: UsuarioService = Depends(get_usuario_service),
):
    service.change_password(id_usuario, req.password_nuevo)
    return {"message": "Contraseña actualizada exitosamente."}


@router.delete("/{id_usuario}", status_code=status.HTTP_200_OK)
def delete_usuario(
    id_usuario: int,
    service: UsuarioService = Depends(get_usuario_service),
):
    service.delete_user(id_usuario)
    return {"message": "Usuario desactivado exitosamente."}

