from __future__ import annotations

import calendar
import hashlib
import re
from datetime import date, datetime, timedelta
from pathlib import Path

_DATE_FORMATS = ("%Y-%m-%d", "%d-%b-%Y", "%d %b %Y", "%d-%b-%y", "%b %d, %Y", "%B %d, %Y", "%d %B %Y",
                 "%d/%m/%Y", "%d.%m.%Y", "%d-%m-%Y", "%d/%m/%y")
_EXCEL_EPOCH = date(1899, 12, 30)


def parse_date(value) -> date | None:
    """Dates as found in documents: ISO, day-first numeric, month names."""
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


def parse_lor_date(value, month_first: bool = True) -> tuple[date | None, str | None]:
    """Dates as found in a LoR cell: Excel datetime, Excel serial number stored as a number,
    or text. Returns (date, remark); remark explains anything doubtful."""
    if value is None:
        return None, None
    if isinstance(value, datetime):
        return value.date(), None
    if isinstance(value, date):
        return value, None
    if isinstance(value, (int, float)) or re.fullmatch(r"\d{5}(\.0+)?", str(value).strip()):
        n = float(value)
        if 20000 < n < 80000:
            return _EXCEL_EPOCH + timedelta(days=int(n)), None
        return None, f"Unreadable date '{value}'"
    text = str(value).strip()
    if text in ("", "-", "--", "n/a", "N/A", "NA"):
        return None, None
    m = re.fullmatch(r"(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})", text)
    if m:
        a, b, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        y += 2000 if y < 100 else 0
        first, second = (a, b) if month_first else (b, a)   # (month, day)
        try:
            if a > 12 or b > 12:  # unambiguous: whichever is > 12 is the day
                return (date(y, b, a) if a > 12 else date(y, a, b)), None
            return date(y, first, second), (f"Ambiguous date '{text}' read as "
                                            f"{'MM/DD' if month_first else 'DD/MM'}")
        except ValueError:
            return None, f"Invalid date '{text}'"
    d = parse_date(text)
    return (d, None) if d else (None, f"Not a date: '{text}'")


def swap_day_month(d: date) -> date | None:
    try:
        return date(d.year, d.day, d.month) if d.day != d.month else None
    except ValueError:
        return None


def add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    y, m = d.year + m // 12, m % 12 + 1
    return date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


def norm_id(value: str | None) -> str:
    """Normalise serial/certificate numbers: case, spaces, dashes, slashes."""
    return re.sub(r"[\s\-/_.]", "", (value or "").upper())


def near_miss(a: str, b: str) -> bool:
    """True when two normalised serials differ by exactly one substituted, missing or extra character
    (typical typos: O/0, C/0, I/1). Only for serials long enough to make this meaningful."""
    if a == b or min(len(a), len(b)) < 5 or abs(len(a) - len(b)) > 1:
        return False
    if len(a) == len(b):
        return sum(x != y for x, y in zip(a, b)) == 1
    short, long_ = sorted((a, b), key=len)
    return any(long_[:i] + long_[i + 1:] == short for i in range(len(long_)))


def file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]
