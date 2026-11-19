from fastapi import APIRouter, Depends
from app.core.auth_deps import require_user

from app.schemas.dashboard import DashboardResumenResponse
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"], dependencies=[Depends(require_user)])
_service = DashboardService()


def get_dashboard_service() -> DashboardService:
    return _service


@router.get("/resumen", response_model=DashboardResumenResponse)
def get_dashboard_resumen(
    service: DashboardService = Depends(get_dashboard_service),
) -> DashboardResumenResponse:
    return service.get_resumen()
