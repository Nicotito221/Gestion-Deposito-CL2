from typing import Any, Dict, Optional

from fastapi import Depends, Header, HTTPException, status

from app.core.security import verify_access_token

ROLES_EDICION_PLANIFICACION = {"administrador", "gerente", "jefe", "analista"}


def require_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de autenticación requerido.")
    payload = verify_access_token(authorization.split("Bearer ", 1)[1].strip())
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado.")
    return payload


def require_editor_planificacion(payload: Dict[str, Any] = Depends(require_user)) -> Dict[str, Any]:
    if str(payload.get("rol", "")).lower() not in ROLES_EDICION_PLANIFICACION:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permisos para esta edición.")
    return payload
