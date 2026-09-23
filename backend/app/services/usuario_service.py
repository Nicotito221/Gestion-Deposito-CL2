from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.repositories.usuario_repository import UsuarioRepository
from app.schemas.usuario import UsuarioCreate, UsuarioUpdate


class UsuarioService:
    def __init__(self, repository: Optional[UsuarioRepository] = None) -> None:
        self.repository = repository or UsuarioRepository()

    def authenticate(self, username: str, password: str) -> Dict[str, Any]:
        user = self.repository.get_by_username(username.strip())
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas.",
            )
        if not user["activo"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="La cuenta de usuario se encuentra deshabilitada.",
            )
        if not verify_password(password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas.",
            )

        self.repository.update_ultimo_acceso(user["id_usuario"])
        token_payload = {
            "sub": user["username"],
            "id_usuario": user["id_usuario"],
            "rol": user["rol"],
            "sector": user["sector"],
        }
        token = create_access_token(token_payload)
        return {
            "token": token,
            "usuario": user,
        }

    def get_by_id(self, id_usuario: int) -> Dict[str, Any]:
        user = self.repository.get_by_id(id_usuario)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado.",
            )
        return user

    def list_users(
        self,
        rol: Optional[str] = None,
        sector: Optional[str] = None,
        solo_activos: bool = False,
    ) -> List[Dict[str, Any]]:
        return self.repository.list_all(rol=rol, sector=sector, solo_activos=solo_activos)

    def create_user(self, data: UsuarioCreate) -> Dict[str, Any]:
        existing = self.repository.get_by_username(data.username.strip())
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El nombre de usuario '{data.username}' ya está registrado.",
            )
        pw_hash = hash_password(data.password)
        return self.repository.create(
            username=data.username.strip(),
            password_hash=pw_hash,
            nombre=data.nombre.strip(),
            apellido=data.apellido.strip(),
            rol=data.rol,
            sector=data.sector.strip() if data.sector else "TODOS",
            email=data.email.strip() if data.email else None,
            activo=data.activo,
        )

    def update_user(self, id_usuario: int, data: UsuarioUpdate) -> Dict[str, Any]:
        self.get_by_id(id_usuario)
        updated = self.repository.update(
            id_usuario=id_usuario,
            nombre=data.nombre.strip() if data.nombre else None,
            apellido=data.apellido.strip() if data.apellido else None,
            rol=data.rol,
            sector=data.sector.strip() if data.sector else None,
            email=data.email.strip() if data.email else None,
            activo=data.activo,
        )
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo actualizar el usuario.",
            )
        return updated

    def change_password(self, id_usuario: int, new_password: str) -> None:
        self.get_by_id(id_usuario)
        pw_hash = hash_password(new_password)
        success = self.repository.update_password(id_usuario, pw_hash)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al actualizar la contraseña.",
            )

    def delete_user(self, id_usuario: int) -> None:
        self.get_by_id(id_usuario)
        success = self.repository.delete(id_usuario)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al desactivar el usuario.",
            )


def get_usuario_service() -> UsuarioService:
    return UsuarioService()

