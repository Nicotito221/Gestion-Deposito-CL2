from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from app.core.security import verify_access_token
from app.schemas.usuario import LoginRequest, LoginResponse, UsuarioResponse
from app.services.usuario_service import UsuarioService, get_usuario_service

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])


def get_current_user_token(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autorización requerido.",
        )
    token = authorization.split("Bearer ", 1)[1].strip()
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
        )
    return payload


@router.post("/login", response_model=LoginResponse)
def login(
    req: LoginRequest,
    service: UsuarioService = Depends(get_usuario_service),
):
    result = service.authenticate(req.username, req.password)
    return LoginResponse(
        token=result["token"],
        usuario=UsuarioResponse.model_validate(result["usuario"]),
    )


@router.get("/me", response_model=UsuarioResponse)
def get_me(
    token_data: dict = Depends(get_current_user_token),
    service: UsuarioService = Depends(get_usuario_service),
):
    id_usuario = token_data.get("id_usuario")
    if not id_usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identificador de usuario inválido en sesión.",
        )
    user = service.get_by_id(id_usuario)
    return UsuarioResponse.model_validate(user)
