"""Генератор фейкового пакета slickline с заранее заложенными дефектами.
expected.json — эталон: что система обязана найти. Это и тест, и демо."""
from __future__ import annotations

import json
import zipfile
from pathlib import Path

import yaml
from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

REQUEST = {"request_id": "RADP-DEMO-0001", "service_line": "slickline",
           "work_start": "2026-11-10", "work_end": "2026-11-30", "flags": {"h2s_service": True}}

# (описание в LoR, серийник в LoR, ссылки на документы в LoR)
LOR_ROWS = [
    ("Slickline Unit c/w power pack", "SLU-4471", "TPI TPI-2026-0311"),
    ('Wireline BOP 5k, 2-1/2"', "BOP-77812", "Pressure Test PT-2026-0145; TPI TPI-2026-0298"),
    ("Lubricator 3 x 8ft, 5k", "LUB-20931", "Pressure Test PT-2026-0377"),
    ("Hydraulic Stuffing Box", "SFB-5520", "Pressure Test PT-2026-0402"),
    ('Slickline Wire 0.108"', "WR-108-3321", "Wire Test WT-2026-0088"),
    ("Weight Indicator", "WI-9012", ""),
    ("Telescopic Mast", "MST-1180", "Load Test LT-2026-0221"),
    ("Tool string assembly", "TS-001", ""),
]

# Сертификаты в пакете: (имя файла, поля, в zip?)
CERTS = [
    ("TPI_SLU-4471.pdf", dict(type="Third Party Inspection", no="TPI-2026-0311", equip="Slickline Unit",
                              sn="SLU-4471", issue="15-Mar-2026", until="14-Mar-2027",
                              issuer="Falcon Inspection Co"), False),
    ("PT_BOP-77812.pdf", dict(type="Pressure Test Certificate", no="PT-2026-0145", equip="Wireline BOP 5k",
                              sn="BOP-77812", issue="20-Apr-2026", until=None,
                              issuer="Gulf Inspection Services"), False),
    ("TPI_BOP-77812.pdf", dict(type="Third Party Inspection", no="TPI-2026-0298", equip="Wireline BOP 5k",
                               sn="BOP-77812", issue="02-Jun-2026", until="01-Jun-2027",
                               issuer="Arabian Testing Bureau"), False),
    ("PT_Lubricator.pdf", dict(type="Pressure Test Certificate", no="PT-2026-0377", equip="Lubricator 8ft",
                               sn="LUB-20391", issue="10-Aug-2026", until=None,
                               issuer="Gulf Inspection Services"), False),
    ("WireTest_0108.pdf", dict(type="Wire Test Certificate", no="WT-2026-0088", equip='Slickline wire 0.108"',
                               sn="WR-108-3321", issue="20-May-2026", until=None,
                               issuer="Contractor workshop"), False),
    ("Calibration_WI.pdf", dict(type="Calibration Certificate", no="CAL-2026-0510", equip="Weight Indicator",
                                sn="WI-9012", issue="05-Jul-2026", until="04-Jul-2027",
                                issuer="Desert Certification Ltd"), False),
    ("LoadTest_Mast.pdf", dict(type="Load Test Certificate", no="LT-2026-0221", equip="Telescopic Mast",
                               sn="MST-1180", issue="12-Sep-2026", until="11-Sep-2027",
                               issuer="Arabian Testing Bureau"), True),
]

EXPECTED = {
    "findings": {
        "SL-UNT-001": ["WARN", "нет в списке одобренных"],
        "SL-BOP-001": ["FAIL", "до начала работ"],
        "SL-BOP-002": ["OK", ""],
        "SL-LUB-001": ["FAIL", "не совпадает"],
        "SL-SFB-001": ["FAIL", "не найден в пакете"],
        "SL-WIR-001": ["WARN", "во время работ"],
        "SL-WIR-002": ["FAIL", "не заявлен в LoR"],
        "SL-WI-001": ["WARN", "не указан в LoR"],
        "SL-MST-001": ["OK", ""],
    },
    "unrecognized_contains": ["Tool string assembly", "Company_Profile.pdf", "Method_Statement.docx"],
}


def _cert_pdf(path: Path, f: dict) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    _, h = A4
    c.setFont("Helvetica-Bold", 16)
    c.drawString(60, h - 80, f["issuer"].upper())
    c.setFont("Helvetica-Bold", 13)
    c.drawString(60, h - 120, f["type"].upper())
    lines = [
        f"Certificate Type: {f['type']}",
        f"Certificate No: {f['no']}",
        f"Equipment: {f['equip']}",
        f"Serial No: {f['sn']}",
        f"Date of Issue: {f['issue']}",
    ] + ([f"Valid Until: {f['until']}"] if f["until"] else []) + [
        f"Issued by: {f['issuer']}",
        "",
        "This is to certify that the above equipment has been examined/tested",
        "and found satisfactory at the time of test.",
        "",
        "FICTITIOUS DOCUMENT - GENERATED FOR SOFTWARE TESTING ONLY",
    ]
    c.setFont("Helvetica", 11)
    for i, line in enumerate(lines):
        c.drawString(60, h - 170 - i * 20, line)
    c.drawString(60, 120, "Inspector: J. Doe            Signature: ____________")
    c.save()


def generate(root: Path) -> Path:
    """Создаёт root/package (то, что «скачано из EFT») и root/expected.json (эталон)."""
    root = Path(root)
    out = root / "package"
    out.mkdir(parents=True, exist_ok=True)
    (out / "request.yaml").write_text(yaml.safe_dump(REQUEST, sort_keys=False), encoding="utf-8")

    wb = Workbook()
    ws = wb.active
    ws.title = "LoR"
    ws.append(["LIST OF READINESS — FICTITIOUS CONTRACTOR LLC"])
    ws.append([])
    ws.append(["Item", "Equipment Description", "Serial Number", "Certificates"])
    for i, (desc, sn, refs) in enumerate(LOR_ROWS, start=1):
        ws.append([i, desc, sn, refs])
    wb.save(out / "LoR_RADP-DEMO-0001.xlsx")

    zipped = []
    for name, fields, in_zip in CERTS:
        _cert_pdf(out / name, fields)
        if in_zip:
            zipped.append(out / name)
    with zipfile.ZipFile(out / "Lifting_certs.zip", "w") as zf:
        for p in zipped:
            zf.write(p, p.name)
            p.unlink()

    c = canvas.Canvas(str(out / "Company_Profile.pdf"), pagesize=A4)
    c.drawString(60, 760, "Fictitious Contractor LLC - Company Profile")
    c.drawString(60, 740, "Founded 2001. Slickline, e-line and pumping services.")
    c.save()
    (out / "Method_Statement.docx").write_bytes(b"placeholder")
    (root / "expected.json").write_text(json.dumps(EXPECTED, ensure_ascii=False, indent=1), encoding="utf-8")
    return out
