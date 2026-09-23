from datetime import datetime, date, timezone, timedelta
from typing import Optional

ARGENTINA_TZ = timezone(timedelta(hours=-3))


def get_argentina_now() -> datetime:
    return datetime.now(ARGENTINA_TZ)


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
