from __future__ import annotations

import calendar
import hashlib
import re
from datetime import date, datetime
from pathlib import Path

_DATE_FORMATS = ("%Y-%m-%d", "%d-%b-%Y", "%d %b %Y", "%d/%m/%Y", "%d.%m.%Y", "%d-%m-%Y",
                 "%b %d, %Y", "%d %B %Y", "%B %d, %Y")


def parse_date(value) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    y, m = d.year + m // 12, m % 12 + 1
    return date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


def norm_id(value: str | None) -> str:
    """Normalise serial/certificate numbers: case, spaces, dashes, slashes."""
    return re.sub(r"[\s\-/_.]", "", (value or "").upper())


def file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]
