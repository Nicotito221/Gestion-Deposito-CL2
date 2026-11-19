import asyncio
import logging
import os
import re
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_db_connection, CORS_ORIGINS, CL2_SYNC_ENABLED, CL2_SYNC_INTERVAL_SECONDS
from app.routers import auth, bom, supply, rundown, stock, conteo, pedidos, usuarios, dashboard, ingreso, auditoria, despacho

logger = logging.getLogger(__name__)


async def _cl2_sync_polling_loop():
    from app.services.cl2_sync_service import Cl2SyncService
    sync_svc = Cl2SyncService()
    await asyncio.sleep(10)
    while True:
        try:
            await asyncio.to_thread(sync_svc.pull_updates_from_cl2)
        except Exception as e:
            logger.error("Error en bucle de sincronizacion CL2: %s", str(e))
        await asyncio.sleep(CL2_SYNC_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    polling_task = None
    if CL2_SYNC_ENABLED:
        polling_task = asyncio.create_task(_cl2_sync_polling_loop())
    yield
    if polling_task:
        polling_task.cancel()

_docs_habilitados = os.getenv("ENABLE_API_DOCS", "false").lower() in ("true", "1", "yes")

app = FastAPI(
    title="Gestión Depósito API",
    version="1.0.0",
    docs_url="/api/docs" if _docs_habilitados else None,
    redoc_url="/api/redoc" if _docs_habilitados else None,
    openapi_url="/api/openapi.json" if _docs_habilitados else None,
    lifespan=lifespan,
)


allowed_origins_list = [origin.strip() for origin in CORS_ORIGINS.split(",") if origin.strip()]
_ORIGEN_LOCAL = re.compile(r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$")


def _origen_permitido(origin: str) -> bool:
    return origin in allowed_origins_list or bool(_ORIGEN_LOCAL.match(origin))


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins_list,
    allow_origin_regex=_ORIGEN_LOCAL.pattern,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Error no controlado en la API: %s", exc)
    origin = request.headers.get("origin") or ""
    headers = {}
    if origin and _origen_permitido(origin):
        headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Vary": "Origin",
        }
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor. El detalle quedó registrado en el log."},
        headers=headers,
    )


app.include_router(auth.router)
app.include_router(usuarios.router)
app.include_router(bom.router)
app.include_router(supply.router)
app.include_router(rundown.router)
app.include_router(stock.router)
app.include_router(conteo.router)
app.include_router(pedidos.router)
app.include_router(dashboard.router)
app.include_router(ingreso.router, prefix="/api/ingresos")
app.include_router(auditoria.router)
app.include_router(despacho.router)


@app.get("/api/health", tags=["Health"])
def health_check():
    db_status = "ok"
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        conn.close()
    except Exception as e:
        logger.error("Health check sin conexión a la base: %s", e)
        db_status = "error"

    return {"status": "ok", "database": db_status}
