"""Package folder intake: unpack archives, locate the LoR, list documents."""
from __future__ import annotations

import zipfile
from dataclasses import dataclass, field
from pathlib import Path

DOC_SUFFIXES = {".pdf", ".png", ".jpg", ".jpeg"}
LOR_SUFFIXES = {".xlsx", ".xlsm"}
LOR_HINTS = ("lor", "readiness", "list of readiness")
WORK_DIR_NAME = "_radp"


@dataclass
class Package:
    root: Path
    lor: Path | None = None
    request_file: Path | None = None
    documents: list[Path] = field(default_factory=list)
    skipped: list[tuple[Path, str]] = field(default_factory=list)


def _safe_extract(zip_path: Path, dest: Path) -> None:
    with zipfile.ZipFile(zip_path) as zf:
        for member in zf.infolist():
            target = (dest / member.filename).resolve()
            if not str(target).startswith(str(dest.resolve())):
                raise ValueError(f"Unsafe path in archive: {member.filename}")
        zf.extractall(dest)


def collect(root: Path, lor_override: Path | None = None) -> Package:
    root = Path(root)
    work = root / WORK_DIR_NAME
    pkg = Package(root=root)

    # Unpack archives (including nested ones) into _radp/unzipped
    pending = [p for p in root.rglob("*.zip") if WORK_DIR_NAME not in p.relative_to(root).parts]
    done = set()
    while pending:
        z = pending.pop()
        if z in done:
            continue
        done.add(z)
        dest = work / "unzipped" / z.stem
        try:
            _safe_extract(z, dest)
        except (zipfile.BadZipFile, ValueError) as e:
            pkg.skipped.append((z, f"Could not unpack: {e}"))
            continue
        pending.extend(p for p in dest.rglob("*.zip") if p not in done)

    candidates = [p for p in root.rglob("*") if p.is_file()
                  and (WORK_DIR_NAME not in p.relative_to(root).parts
                       or "unzipped" in p.relative_to(root).parts)]

    lor_candidates = []
    for p in sorted(candidates):
        suffix = p.suffix.lower()
        if p.name.lower() in ("request.yaml", "request.yml"):
            pkg.request_file = p
        elif suffix == ".zip":
            continue
        elif suffix in LOR_SUFFIXES:
            lor_candidates.append(p)
        elif suffix in DOC_SUFFIXES:
            pkg.documents.append(p)
        elif p.name.startswith("~$") or p.name.lower() in ("thumbs.db", ".ds_store"):
            continue
        else:
            pkg.skipped.append((p, f"File type {suffix or '(no extension)'} not supported"))

    if lor_override:
        pkg.lor = Path(lor_override)
    else:
        named = [p for p in lor_candidates if any(h in p.stem.lower() for h in LOR_HINTS)]
        pick = named or lor_candidates
        pkg.lor = pick[0] if pick else None
    for p in lor_candidates:
        if p != pkg.lor:
            pkg.skipped.append((p, "Excel file not recognised as the LoR"))
    return pkg


def pdf_pages_text(path: Path) -> list[str]:
    from pypdf import PdfReader
    try:
        return [page.extract_text() or "" for page in PdfReader(str(path)).pages]
    except Exception:
        return []
