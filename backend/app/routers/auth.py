from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth_deps import require_user
from app.schemas.usuario import LoginRequest, LoginResponse, UsuarioResponse
from app.services.usuario_service import UsuarioService, get_usuario_service

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])


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
    token_data: dict = Depends(require_user),
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
