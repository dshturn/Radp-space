"""List of Readiness (Excel) reader.

Expected layout (as used by service providers): a header block (SP, date of issue, field/well, type of job),
then sections such as "Manpower:" and "Equipment:". In the equipment table each row is one declared
integrity check: serial number x check type (MPI, HT, COC, LOAD TEST...) with its dates and responsible unit.
Only the equipment table is read; the manpower section is ignored.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from openpyxl import load_workbook

from .knowledge import Knowledge
from .util import parse_lor_date

# Column aliases, ordered from specific to generic; matched as substrings of the normalised header text.
COLUMNS = {
    "serial": ("equipment s/n", "serial number", "serial no", "s/n", "serial"),
    "description": ("equipment description", "item description", "description"),
    "check": ("type of integrity check", "integrity check", "type of check", "check type", "certificate type"),
    "inspection": ("date of inspection", "test date", "date of test"),
    "expiry": ("date of expiry", "expiry date", "valid until", "valid till"),
    "unit": ("responsible unit", "responsible", "discipline"),
    "readiness": ("readiness",),
    "comment": ("comment", "remarks"),
}
REQUIRED = ("serial", "description", "check")
HEADER_LABELS = {
    "provider": ("sp", "service provider", "contractor"),
    "issue_date": ("date of issue",),
    "field": ("field / well", "field/well", "field", "well"),
    "job_type": ("type of job", "job type"),
}


def _norm(v) -> str:
    return re.sub(r"\s+", " ", str(v or "")).strip().lower()


@dataclass
class LorInfo:
    provider: str = ""
    issue_date: date | None = None
    field: str = ""
    job_type: str = ""
    month_first: bool = True


@dataclass
class LorRow:
    row: int
    serial: str
    description: str
    check_raw: str
    check_type: str | None
    inspection_date: date | None
    expiry_date: date | None
    expiry_text: str
    unit: str
    readiness: str
    comment: str
    category: str | None
    remarks: list[str] = field(default_factory=list)


def _header_columns(cells: list[str]) -> dict | None:
    cols = {}
    for key, aliases in COLUMNS.items():
        for alias in aliases:
            idx = next((i for i, c in enumerate(cells) if alias in c and i not in cols.values()), None)
            if idx is not None:
                cols[key] = idx
                break
    return cols if all(k in cols for k in REQUIRED) else None


def _read_info(rows) -> LorInfo:
    info = LorInfo()
    for row in rows[:20]:
        for i, cell in enumerate(row):
            label = _norm(cell)
            for key, aliases in HEADER_LABELS.items():
                if label in aliases:
                    value = next((v for v in row[i + 1:] if v not in (None, "")), None)
                    if key == "issue_date":
                        info.issue_date = parse_lor_date(value)[0]
                    elif value is not None and not getattr(info, key):
                        setattr(info, key, str(value).strip())
    return info


def read_lor(path: Path, kn: Knowledge) -> tuple[LorInfo, list[LorRow], list[str]]:
    wb = load_workbook(path, data_only=True, read_only=True)
    for ws in wb.worksheets:
        rows = [list(r) for r in ws.iter_rows(values_only=True)]
        header_idx = next((i for i, r in enumerate(rows) if _header_columns([_norm(c) for c in r])), None)
        if header_idx is not None:
            break
    else:
        return LorInfo(), [], [f"No equipment table found in {Path(path).name} "
                               f"(need serial number, description and type of check columns)"]

    info = _read_info(rows)
    header = [_norm(c) for c in rows[header_idx]]
    cols = _header_columns(header)
    fmt_hint = " ".join(header)
    info.month_first = not ("dd/mm" in fmt_hint and "mm/dd" not in fmt_hint)

    items, problems = [], []
    for offset, raw in enumerate(rows[header_idx + 1:], start=header_idx + 2):
        get = lambda k: raw[cols[k]] if k in cols and cols[k] < len(raw) else None
        text = lambda k: str(get(k) or "").strip()
        if not any(v not in (None, "") for v in raw):
            continue
        first = next((str(v).strip() for v in raw if v not in (None, "")), "")
        if first.endswith(":") and not text("serial"):  # next section label, e.g. "Materials:"
            break
        if not text("serial") and not text("description"):
            continue
        insp, insp_remark = parse_lor_date(get("inspection"), info.month_first)
        exp, exp_remark = parse_lor_date(get("expiry"), info.month_first)
        item = LorRow(
            row=offset, serial=text("serial"), description=text("description"), check_raw=text("check"),
            check_type=kn.match_doc_type(text("check")), inspection_date=insp, expiry_date=exp,
            expiry_text=text("expiry") if exp_remark else "", unit=text("unit"), readiness=text("readiness"),
            comment=text("comment"), category=kn.match_equipment(text("description")),
        )
        item.remarks += [r for r in (insp_remark and f"Inspection date: {insp_remark}",
                                     exp_remark and f"Expiry date: {exp_remark}") if r]
        if not item.serial:
            problems.append(f"LoR row {offset}: '{item.description}' has no serial number")
        items.append(item)
    return info, items, problems
