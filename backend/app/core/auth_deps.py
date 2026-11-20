import threading
import time
from typing import Any, Callable, Dict, Optional, Tuple

from fastapi import Depends, Header, HTTPException, status

from app.core.config import get_db_connection
from app.core.security import verify_access_token

ROLES_EDICION_PLANIFICACION = {"administrador", "gerente", "jefe", "analista"}
ROLES_JEFATURA = {"administrador", "gerente", "jefe"}
ROLES_PLANTA = ROLES_EDICION_PLANIFICACION | {"operario_planta", "supervisor"}
ROLES_CONFIG_MATERIALES = ROLES_EDICION_PLANIFICACION | {"supervisor"}
ROLES_CONTEO = ROLES_EDICION_PLANIFICACION | {"contador_ciclico", "operario_planta"}
ROLES_DEPOSITO = ROLES_EDICION_PLANIFICACION | {"deposito", "operario_deposito"}


CACHE_USUARIO_SEGUNDOS = 60
_cache_usuarios: Dict[int, Tuple[float, Optional[Dict[str, Any]]]] = {}
_lock_cache_usuarios = threading.Lock()


def _estado_usuario(id_usuario: int) -> Optional[Dict[str, Any]]:
    ahora = time.monotonic()
    with _lock_cache_usuarios:
        en_cache = _cache_usuarios.get(id_usuario)
        if en_cache and en_cache[0] > ahora:
            return en_cache[1]

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT rol, sector FROM dbo.usuario
            WHERE id_usuario = ? AND activo = 1 AND ISNULL(eliminado, 0) = 0
            """,
            (id_usuario,),
        )
        fila = cursor.fetchone()
        estado = {"rol": str(fila[0]), "sector": fila[1]} if fila else None
    finally:
        conn.close()

    with _lock_cache_usuarios:
        _cache_usuarios[id_usuario] = (ahora + CACHE_USUARIO_SEGUNDOS, estado)
    return estado


def invalidar_cache_usuario(id_usuario: int) -> None:
    with _lock_cache_usuarios:
        _cache_usuarios.pop(id_usuario, None)


def require_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de autenticación requerido.")
    payload = verify_access_token(authorization.split("Bearer ", 1)[1].strip())
    if not payload or payload.get("id_usuario") is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado.")
    estado = _estado_usuario(int(payload["id_usuario"]))
    if estado is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="El usuario está deshabilitado o fue eliminado.")
    return {**payload, "rol": estado["rol"], "sector": estado["sector"]}


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
