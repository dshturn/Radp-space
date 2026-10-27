"""Fake package generator in the layout of a real service-provider LoR, with seeded defects modelled on
issues found in real packages. All names, serials and companies are fictitious.
expected.json is the answer key: what the system must find. Serves as both test and demo."""
from __future__ import annotations

import json
import zipfile
from datetime import date
from pathlib import Path

import yaml
from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

REQUEST = {"request_id": "RADP-DEMO-0002", "service_line": "wireline", "discipline": "engineering",
           "work_start": "2026-11-10", "work_end": "2026-11-30"}
D = date


def _xl(d: date) -> int:
    """Excel serial number, as found in LoR cells formatted as numbers."""
    return (d - date(1899, 12, 30)).days


MPI = (D(2026, 1, 28), D(2027, 1, 27))
HT = (D(2026, 1, 29), D(2027, 1, 28))

# (serial, description, check, inspection date, expiry, responsible unit)
EQUIPMENT = [
    ("EMX20C011", "WL VALVE (BOP)", "MPI", _xl(MPI[0]), MPI[1], "ENG"),
    ("EMX20C011", "WL VALVE (BOP)", "HT", _xl(HT[0]), HT[1], "ENG"),
    ("EMX20C011", "WL VALVE (BOP)", "COC", _xl(D(2025, 2, 13)), "-", "ENG"),
    ("WX-201", "LUBRICATOR", "MPI", _xl(MPI[0]), MPI[1], "ENG"),
    ("WX-201", "LUBRICATOR", "HT", _xl(HT[0]), HT[1], "ENG"),
    ("WX-201", "LUBRICATOR", "COC", _xl(D(2025, 1, 20)), "-", "ENG"),
    ("WX-202", "LUBRICATOR", "MPI", _xl(MPI[0]), MPI[1], "ENG"),
    ("WX-202", "LUBRICATOR", "HT", _xl(HT[0]), HT[1], "ENG"),
    ("WX-202", "LUBRICATOR", "COC", _xl(D(2025, 2, 16)), "-", "ENG"),            # wrong COC date
    ("EMX200037", "TOOL TRAP", "MPI", _xl(MPI[0]), MPI[1], "ENG"),              # serial typo (C -> 0)
    ("EMX200037", "TOOL TRAP", "HT", _xl(HT[0]), HT[1], "ENG"),
    ("EMX200037", "TOOL TRAP", "COC", _xl(D(2025, 2, 16)), "-", "ENG"),
    ("XO-4471-4", 'X-over, 8-3/4"', "MPI", _xl(MPI[0]), MPI[1], "ENG"),
    ("XO-4471-4", 'X-over, 8-3/4"', "HT", _xl(D(2026, 11, 2)), D(2027, 10, 2), "ENG"),  # day/month swapped
    ("XO-4471-4", 'X-over, 8-3/4"', "COC", _xl(D(2025, 2, 3)), "-", "ENG"),
    ("XO-5512-1", 'X-over, 5-3/4"', "MPI", _xl(D(2025, 11, 20)), D(2026, 11, 19), "ENG"),  # expires during job
    ("XO-5512-1", 'X-over, 5-3/4"', "HT", _xl(D(2026, 2, 11)), D(2027, 2, 10), "ENG"),
    ("XO-5512-1", 'X-over, 5-3/4"', "COC", _xl(D(2023, 3, 16)), "-", "ENG"),     # document missing
    ("PIS-0902", "PUMP IN SUB", "MPI", _xl(MPI[0]), MPI[1], "ENG"),             # HT not listed at all
    ("PIS-0902", "PUMP IN SUB", "COC", "16/2/2025", "-", "ENG"),
    ("QTS-118", "QUICK TEST SUB", "MPI", _xl(MPI[0]), MPI[1], "ENG"),
    ("QTS-118", "QUICK TEST SUB", "HT", _xl(D(2025, 10, 15)), D(2026, 10, 14), "ENG"),  # expired before job
    ("QTS-118", "QUICK TEST SUB", "COC", _xl(D(2025, 2, 16)), "-", "ENG"),
    ("SW-2289", "Sheave Wheel", "MPI", _xl(D(2026, 7, 20)), D(2027, 1, 10), "ENG"),  # lifting item on ENG
    ("SW-2289", "Sheave Wheel", "LOAD TEST", _xl(D(2026, 1, 18)), D(2029, 1, 18), "ENG"),
    ("SL-1483", "WIRE ROPE SLING", "LOAD TEST", _xl(D(2026, 3, 16)), D(2027, 3, 16), "HSE"),
    ("SH-6471", "SKID SHACKLE", "MPI", _xl(D(2026, 7, 10)), D(2027, 1, 10), "HSE"),
    ("MGB-019", "PTU", "LOAD TEST", _xl(D(2026, 2, 4)), "until major repair", "HSE"),
]

ATB, GIS, INHOUSE = "Arabian Testing Bureau", "Gulf Inspection Services", "Fictitious Wireline Services (in-house)"
# file -> list of pages: (type, number, serials, description, date, valid until, issuer); None = non-certificate page
DOCUMENTS = {
    "MPI_report_JAN26.pdf": [("Magnetic Particle Inspection", "MPI-26-0117",
                              "EMX20C011, WX-201, WX-202, EMX20C037, XO-4471-4, PIS-0902, QTS-118",
                              "Pressure control equipment", "28-01-2026", "27-01-2027", ATB)],
    "MPI_XO-5512-1.pdf": [("Magnetic Particle Inspection", "MPI-25-0988", "XO-5512-1", 'X-over 5-3/4"',
                           "20-11-2025", "19-11-2026", ATB)],
    "HT_chart_EMX20C011.pdf": [("Pressure Test", "TC-1490", "EMX20C011, WX-201, WX-202, EMX20C037, PIS-0902",
                                "BOP body test", "29-01-2026", None, INHOUSE)],
    "HT_witness_X-overs.pdf": [("Certificate of Pressure Test Witness", "GIS-HT-2026-003", "XO-4471-4, XO-5512-1",
                                "X-overs", "11-02-2026", "10-02-2027", GIS)],
    "HT_QTS-118.pdf": [("Certificate of Pressure Test Witness", "GIS-HT-2025-077", "QTS-118", "Quick test sub",
                        "15-10-2025", "14-10-2026", GIS)],
    "COC_bundle.pdf": [
        ("Certificate of Conformance", "WO-3011", "EMX20C011", "WL valve", "13-02-2025", None, "Fictitious Metals Co"),
        ("Certificate of Conformance", "WO-3012", "WX-201, WX-202", "Lubricators", "20-01-2025", None,
         "Fictitious Metals Co"),
        ("Certificate of Conformance", "WO-3013", "EMX20C037, PIS-0902, QTS-118", "Subs", "16-02-2025", None,
         "Fictitious Metals Co"),
        ("Certificate of Conformance", "WO-1009", "XO-4471-1, XO-4471-2, XO-4471-3, XO-4471-4", "X-overs",
         "03-02-2025", None, "Fictitious Metals Co"),
        ("Mill Test Certificate", "MTC-77812", "", "AISI 4140 bar", "19-12-2022", None, "Fictitious Steel SpA"),
    ],
    "COC_XO-9001.pdf": [("Certificate of Conformance", "WO-9001", "XO-9001", "X-over", "01-03-2025", None,
                         "Fictitious Metals Co")],
    "Company_Profile.pdf": [None],
}
ZIPPED = {"HT_QTS-118.pdf"}

EXPECTED = {
    "findings": {
        "EMX20C011|mpi": ["OK", ""],
        "EMX20C011|hydrostatic_test": ["WARN", "not an approved third party"],
        "EMX20C011|coc": ["OK", ""],
        "WX-201|mpi": ["OK", ""],
        "WX-201|hydrostatic_test": ["WARN", "not an approved third party"],
        "WX-201|coc": ["OK", ""],
        "WX-202|mpi": ["OK", ""],
        "WX-202|hydrostatic_test": ["WARN", "not an approved third party"],
        "WX-202|coc": ["FAIL", "differs from document date"],
        "EMX200037|mpi": ["WARN", "probable typo"],
        "EMX200037|hydrostatic_test": ["WARN", "probable typo"],
        "EMX200037|coc": ["WARN", "probable typo"],
        "XO-4471-4|mpi": ["OK", ""],
        "XO-4471-4|hydrostatic_test": ["FAIL", "day and month swapped"],
        "XO-4471-4|coc": ["OK", ""],
        "XO-5512-1|mpi": ["WARN", "during the work period"],
        "XO-5512-1|hydrostatic_test": ["OK", ""],
        "XO-5512-1|coc": ["FAIL", "No document"],
        "PIS-0902|mpi": ["OK", ""],
        "PIS-0902|hydrostatic_test": ["FAIL", "not listed in the LoR (document found"],
        "PIS-0902|coc": ["OK", ""],
        "QTS-118|mpi": ["OK", ""],
        "QTS-118|hydrostatic_test": ["FAIL", "before work start"],
        "QTS-118|coc": ["OK", ""],
    },
    "also_in_reason": {"XO-4471-4|hydrostatic_test": ["in the future", "document supports only 10-Feb-2027"]},
    "assignment_remarks": ["SW-2289"],
    "unrecognized_contains": ["COC_XO-9001.pdf", "Company_Profile.pdf", "Method_Statement.docx"],
}


def _pdf(path: Path, pages: list) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    _, h = A4
    for page in pages:
        if page is None:
            c.setFont("Helvetica", 12)
            c.drawString(60, h - 80, "Fictitious Wireline Services - Company Profile")
            c.drawString(60, h - 100, "Founded 2001. Wireline, slickline and logging services.")
        else:
            kind, no, serials, desc, issued, until, issuer = page
            c.setFont("Helvetica-Bold", 15)
            c.drawString(60, h - 80, issuer.upper())
            c.setFont("Helvetica-Bold", 13)
            c.drawString(60, h - 115, kind.upper())
            lines = [f"Certificate Type: {kind}", f"Certificate No: {no}", f"Equipment: {desc}",
                     f"Serial No: {serials}", f"Date of Issue: {issued}"]
            lines += [f"Valid Until: {until}"] if until else []
            lines += [f"Issued by: {issuer}", "", "FICTITIOUS DOCUMENT - GENERATED FOR SOFTWARE TESTING ONLY"]
            c.setFont("Helvetica", 11)
            for i, line in enumerate(lines):
                c.drawString(60, h - 160 - i * 20, line)
        c.showPage()
    c.save()


def _lor(path: Path) -> None:
    wb = Workbook()
    ws = wb.active
    ws.append(["Yellow fields to be filled by SP"])
    ws.append(["List of Readiness - FICTITIOUS SAMPLE"])
    ws.append(["SP", "Fictitious Wireline Services", "Date of issue", D(2026, 10, 26), "Valid till"])
    ws.append(["Job / Campaign information", "Field / Well", "DEMO-FIELD-01"])
    ws.append(["Type of job", "Logging Campaign"])
    ws.append([])
    ws.append(["Manpower:"])
    ws.append(["#", "Name", "Years of experience", "Job role", "Document name", "Date of Expiry (MM/DD/YY)",
               "Responsible unit"])
    ws.append([1, "John Doe", 5, "Equipment Operator", "MED", D(2027, 4, 24), "HSE"])
    ws.append([])
    ws.append(["Equipment:"])
    ws.append(["#", "Equipment S/N", "Equipment Description", "Type of Integrity Check",
               "Date of Inspection (MM/DD/YY)", "Date of Expiry (MM/DD/YY)", "Responsible unit", "Auditor",
               "Inspection Date", "Readiness for operations", "Comment"])
    for i, (sn, desc, check, insp, exp, unit) in enumerate(EQUIPMENT, start=1):
        ws.append([i, sn, desc, check, insp, exp, unit, "Auditor A", D(2026, 2, 19), "Ready"])
    wb.save(path)


def generate(root: Path) -> Path:
    """Creates root/package (as "downloaded from EFT") and root/expected.json (answer key)."""
    root = Path(root)
    out = root / "package"
    out.mkdir(parents=True, exist_ok=True)
    (out / "request.yaml").write_text(yaml.safe_dump(REQUEST, sort_keys=False), encoding="utf-8")
    _lor(out / "LoR_RADP-DEMO-0002.xlsx")
    for name, pages in DOCUMENTS.items():
        _pdf(out / name, pages)
    with zipfile.ZipFile(out / "Pressure_tests.zip", "w") as zf:
        for name in ZIPPED:
            zf.write(out / name, name)
            (out / name).unlink()
    (out / "Method_Statement.docx").write_bytes(b"placeholder")
    (root / "expected.json").write_text(json.dumps(EXPECTED, ensure_ascii=False, indent=1), encoding="utf-8")
    return out
