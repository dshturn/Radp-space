"""Excel-отчёт. Колонки «Ассессор: согласен?» и «Комментарий» заполняет человек —
потом команда `feedback` забирает их в базу знаний."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

from .checker import Context, Result
from .knowledge import Knowledge

FILLS = {s: PatternFill("solid", fgColor=c) for s, c in
         {"OK": "C6EFCE", "INFO": "DDEBF7", "WARN": "FFEB9C", "FAIL": "FFC7CE"}.items()}
STATUS_RU = {"OK": "OK", "INFO": "ИНФО", "WARN": "ВНИМАНИЕ", "FAIL": "НЕ СООТВ."}
CHECK_COLUMNS = ["Строка LoR", "Оборудование (LoR)", "Серийный № (LoR)", "Категория", "Правило",
                 "Статус правила", "Требуемый документ", "Заявлен в LoR", "Файл", "Стр.",
                 "№ сертификата", "Дата выдачи", "Действует до", "Выдал", "Результат", "Причина",
                 "Источник требования", "Ассессор: согласен?", "Комментарий ассессора"]
FEEDBACK_COL = CHECK_COLUMNS.index("Ассессор: согласен?") + 1


def _header(ws, columns, widths=None):
    ws.append(columns)
    for i, cell in enumerate(ws[1], start=1):
        cell.font = Font(bold=True)
        cell.fill = PatternFill("solid", fgColor="D9D9D9")
        cell.alignment = Alignment(wrap_text=True, vertical="top")
        ws.column_dimensions[cell.column_letter].width = (widths or {}).get(i, 16)
    ws.freeze_panes = "A2"


def write_report(path: Path, kn: Knowledge, ctx: Context, result: Result, provider: str) -> Path:
    wb = Workbook()
    counts = result.counts()

    ws = wb.active
    ws.title = "Сводка"
    overall = ("ВЕРНУТЬ ПОДРЯДЧИКУ" if counts.get("FAIL") else
               "ГОТОВ К РЕВЬЮ (есть замечания)" if counts.get("WARN") or result.unrecognized else "ГОТОВ К РЕВЬЮ")
    rows = [
        ("Заявка", ctx.request_id), ("Сервисная линия", ctx.service_line),
        ("Период работ", f"{ctx.work_start:%d.%m.%Y} – {ctx.work_end:%d.%m.%Y}"),
        ("Условия", ", ".join(f"{k}={v}" for k, v in ctx.flags.items()) or "—"),
        ("Проверено", datetime.now().strftime("%d.%m.%Y %H:%M")), ("Чтение документов", provider),
        ("", ""),
        ("Требований проверено", len(result.findings)),
        ("OK", counts.get("OK", 0)), ("Внимание", counts.get("WARN", 0)),
        ("Не соответствует", counts.get("FAIL", 0)), ("Нераспознанное", len(result.unrecognized)),
        ("", ""), ("Предварительный статус", overall),
        ("", ""), ("ВАЖНО", "Это предварительная проверка. Решение принимает ассессор."),
    ]
    if any(f.rule and f.rule.get("status") != "approved" for f in result.findings):
        rows.append(("", "Использованы НЕУТВЕРЖДЁННЫЕ правила (draft) — результат только для отладки."))
    for r in rows:
        ws.append(r)
    ws.column_dimensions["A"].width, ws.column_dimensions["B"].width = 26, 70
    for cell in ws["A"]:
        cell.font = Font(bold=True)

    ws = wb.create_sheet("Проверка")
    _header(ws, CHECK_COLUMNS, {2: 30, 7: 28, 9: 30, 16: 50, 17: 30, 19: 30})
    order = sorted(result.findings, key=lambda f: (-{"FAIL": 3, "WARN": 2, "INFO": 1, "OK": 0}[f.status], f.item.row))
    for f in order:
        c, rule = f.cert or {}, f.rule or {}
        src = rule.get("source") or {}
        ws.append([
            f.item.row, f.item.description, f.item.serial,
            kn.equipment.get(f.item.category, {}).get("name", f.item.category),
            rule.get("id", ""), rule.get("status", ""),
            kn.doc_types.get(rule.get("document"), {}).get("name", rule.get("document", "")),
            "да" if f.declared else "нет",
            Path(c["file"]).name if c.get("file") else "", c.get("page") or "",
            c.get("certificate_number") or "", c.get("issue_date") or "",
            f.valid_until.isoformat() if f.valid_until else (c.get("expiry_date") or ""),
            c.get("issuer") or "", STATUS_RU[f.status], "; ".join(f.reasons) or "",
            " ".join(x for x in (src.get("document"), src.get("clause"), src.get("revision")) if x),
            "", "",
        ])
        row = ws.max_row
        ws.cell(row, CHECK_COLUMNS.index("Результат") + 1).fill = FILLS[f.status]
        for col in (2, 7, 16, 17):
            ws.cell(row, col).alignment = Alignment(wrap_text=True, vertical="top")
    dv = DataValidation(type="list", formula1='"Да,Нет"', allow_blank=True)
    ws.add_data_validation(dv)
    col_letter = ws.cell(1, FEEDBACK_COL).column_letter
    dv.add(f"{col_letter}2:{col_letter}{max(ws.max_row, 2)}")
    ws.auto_filter.ref = ws.dimensions

    ws = wb.create_sheet("Нераспознанное")
    _header(ws, ["Что", "Объект", "Причина"], {1: 20, 2: 45, 3: 80})
    for u in result.unrecognized:
        ws.append([u["what"], u["name"], u["reason"]])

    ws = wb.create_sheet("Извлечено")
    cols = ["cert_id", "file", "page", "doc_type", "certificate_number", "serial_numbers",
            "equipment_description", "issue_date", "expiry_date", "issuer", "notes"]
    _header(ws, cols, {2: 40, 7: 30, 10: 28, 11: 40})
    for c in result.certs:
        ws.append([Path(c[k]).name if k == "file" else
                   ", ".join(c[k]) if k == "serial_numbers" else c.get(k) for k in cols])

    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)
    return path
