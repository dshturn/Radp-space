"""List of Readiness (Excel) reader: equipment, serial numbers, declared documents."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from openpyxl import load_workbook

from .knowledge import Knowledge
from .util import norm_id

HEADER_ALIASES = {
    "description": ("equipment description", "item description", "description", "equipment"),
    "serial": ("serial number", "serial no", "serial no.", "s/n", "serial", "sn"),
    "documents": ("certificates", "certificate", "documents", "document reference", "certs", "attached documents"),
}
CERT_NO_RE = re.compile(r"\b[A-Z0-9]+(?:[-/][A-Z0-9]+)+\b")


@dataclass
class LorItem:
    row: int
    description: str
    serial: str
    category: str | None
    refs: list[str] = field(default_factory=list)
    declared_types: set[str] = field(default_factory=set)
    declared_numbers: set[str] = field(default_factory=set)


def _find_header(ws) -> tuple[int, dict] | None:
    for r_idx, row in enumerate(ws.iter_rows(min_row=1, max_row=15, values_only=True), start=1):
        cells = [str(v or "").strip().lower() for v in row]
        cols = {}
        for key, aliases in HEADER_ALIASES.items():  # aliases ordered from specific to generic
            for alias in aliases:
                if alias in cells:
                    cols[key] = cells.index(alias)
                    break
        if "description" in cols and "serial" in cols:
            return r_idx, cols
    return None


def read_lor(path: Path, kn: Knowledge) -> tuple[list[LorItem], list[str]]:
    wb = load_workbook(path, data_only=True, read_only=True)
    for ws in wb.worksheets:
        found = _find_header(ws)
        if found:
            break
    else:
        return [], [f"No header row found in {path.name} (description and serial number columns are required)"]

    header_row, cols = found
    items, problems = [], []
    for r_idx, row in enumerate(ws.iter_rows(min_row=header_row + 1, values_only=True), start=header_row + 1):
        get = lambda k: str(row[cols[k]] or "").strip() if k in cols and cols[k] < len(row) else ""
        desc, serial = get("description"), get("serial")
        if not desc and not serial:
            continue
        refs = [s.strip() for s in re.split(r"[;\n]+", get("documents")) if s.strip()]
        item = LorItem(row=r_idx, description=desc, serial=serial, category=kn.match_equipment(desc), refs=refs)
        for ref in refs:
            t = kn.match_doc_type(ref)
            if t:
                item.declared_types.add(t)
            item.declared_numbers.update(norm_id(n) for n in CERT_NO_RE.findall(ref.upper()) if any(ch.isdigit() for ch in n))
        if not serial:
            problems.append(f"LoR row {r_idx}: '{desc}' has no serial number")
        items.append(item)
    return items, problems
