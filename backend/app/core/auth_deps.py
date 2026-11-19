from typing import Any, Callable, Dict, Optional

from fastapi import Depends, Header, HTTPException, status

from app.core.security import verify_access_token

ROLES_EDICION_PLANIFICACION = {"administrador", "gerente", "jefe", "analista"}
ROLES_JEFATURA = {"administrador", "gerente", "jefe"}
ROLES_PLANTA = ROLES_EDICION_PLANIFICACION | {"operario_planta", "supervisor"}
ROLES_CONFIG_MATERIALES = ROLES_EDICION_PLANIFICACION | {"supervisor"}
ROLES_CONTEO = ROLES_EDICION_PLANIFICACION | {"contador_ciclico", "operario_planta"}
ROLES_DEPOSITO = ROLES_EDICION_PLANIFICACION | {"deposito", "operario_deposito"}


def require_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de autenticación requerido.")
    payload = verify_access_token(authorization.split("Bearer ", 1)[1].strip())
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado.")
    return payload


def require_roles(*grupos: set) -> Callable[[Dict[str, Any]], Dict[str, Any]]:
    permitidos = set().union(*grupos)

    def dependencia(payload: Dict[str, Any] = Depends(require_user)) -> Dict[str, Any]:
        if str(payload.get("rol", "")).lower() not in permitidos:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permisos para esta operación.")
        return payload

    return dependencia


require_editor_planificacion = require_roles(ROLES_EDICION_PLANIFICACION)
require_admin = require_roles({"administrador"})


def id_usuario_de(payload: Dict[str, Any]) -> Optional[int]:
    valor = payload.get("id_usuario")
    return int(valor) if valor is not None else None
