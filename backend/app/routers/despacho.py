from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth_deps import require_editor_planificacion as require_editor, require_user
from app.repositories.despacho_repository import DespachoRepository
from app.schemas.despacho import DespachoItem, DespachoUpsertBatch, DespachoUpsertResult

router = APIRouter(prefix="/api/despachos", tags=["Despachos a terceros"])

_repo = DespachoRepository()


def get_despacho_repository() -> DespachoRepository:
    return _repo


@router.get("", response_model=List[DespachoItem])
def listar_despachos(
    anio_desde: int = Query(...),
    mes_desde: int = Query(..., ge=1, le=12),
    anio_hasta: int = Query(...),
    mes_hasta: int = Query(..., ge=1, le=12),
    _: Dict[str, Any] = Depends(require_user),
    repo: DespachoRepository = Depends(get_despacho_repository),
) -> List[DespachoItem]:
    return repo.listar(anio_desde, mes_desde, anio_hasta, mes_hasta)


@router.put("", response_model=DespachoUpsertResult)
def guardar_despachos(
    data: DespachoUpsertBatch,
    payload: Dict[str, Any] = Depends(require_editor),
    repo: DespachoRepository = Depends(get_despacho_repository),
) -> DespachoUpsertResult:
    id_usuario = payload.get("id_usuario")
    return repo.upsert_batch(data.items, int(id_usuario) if id_usuario is not None else None)


@router.delete("/{id_despacho}")
def eliminar_despacho(
    id_despacho: int,
    _: Dict[str, Any] = Depends(require_editor),
    repo: DespachoRepository = Depends(get_despacho_repository),
) -> Dict[str, bool]:
    if not repo.eliminar(id_despacho):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Despacho inexistente.")
    return {"ok": True}
