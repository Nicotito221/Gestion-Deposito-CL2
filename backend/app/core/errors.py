import logging

from fastapi import HTTPException, status

logger = logging.getLogger("app.errors")


def error_interno(contexto: str, err: Exception) -> HTTPException:
    logger.error("%s: %s", contexto, err, exc_info=err)
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"{contexto}. El detalle quedó registrado en el log del servidor.",
    )
