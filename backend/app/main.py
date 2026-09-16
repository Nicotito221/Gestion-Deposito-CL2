import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_db_connection
from app.routers import bom, supply, rundown

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Gestión Depósito API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Error no controlado en la API: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )


app.include_router(bom.router)
app.include_router(supply.router)
app.include_router(rundown.router)


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
        db_status = f"error: {e}"

    return {"status": "ok", "database": db_status}
