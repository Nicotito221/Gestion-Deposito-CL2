from datetime import datetime, date, timezone, timedelta
from typing import Optional

ARGENTINA_TZ = timezone(timedelta(hours=-3))


def get_argentina_now() -> datetime:
    return datetime.now(ARGENTINA_TZ)


def get_argentina_now_naive() -> datetime:
    return datetime.now(ARGENTINA_TZ).replace(tzinfo=None)


def get_argentina_today() -> date:
    return datetime.now(ARGENTINA_TZ).date()


def get_argentina_yesterday() -> date:
    return datetime.now(ARGENTINA_TZ).date() - timedelta(days=1)


def parse_argentina_date(date_str: Optional[str]) -> Optional[date]:
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str.strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def get_turno_sugerido_actual(dt: Optional[datetime] = None) -> str:
    if dt is None:
        dt = get_argentina_now()
    total_minutes = dt.hour * 60 + dt.minute
    if 360 <= total_minutes <= 840:
        return "Turno Mañana"
    elif 840 < total_minutes < 1380:
        return "Turno Tarde"
    return "Completo"


HORAS_JORNADA_DIARIA = 21.38
HORA_INICIO_JORNADA = 6.0


def get_avance_jornada_produccion(dt: Optional[datetime] = None) -> tuple[float, float]:
    if dt is None:
        dt = get_argentina_now()
    hora_actual = dt.hour + (dt.minute / 60.0) + (dt.second / 3600.0)
    if hora_actual < HORA_INICIO_JORNADA:
        return 0.0, 1.0
    horas_transcurridas = hora_actual - HORA_INICIO_JORNADA
    if horas_transcurridas >= HORAS_JORNADA_DIARIA:
        return 1.0, 0.0
    fraccion_transcurrida = min(1.0, max(0.0, horas_transcurridas / HORAS_JORNADA_DIARIA))
    fraccion_restante = 1.0 - fraccion_transcurrida
    return fraccion_transcurrida, fraccion_restante


def get_fecha_operativa_stock(dt: Optional[datetime] = None) -> date:
    if dt is None:
        dt = get_argentina_now()
    if dt.hour < 6:
        return dt.date() - timedelta(days=1)
    return dt.date()


