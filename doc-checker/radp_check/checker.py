"""«Проверяющий»: сравнение требований (правила) с заявленным (LoR) и фактическим (пакет).
Здесь нет ИИ — только детерминированная логика, поэтому результат воспроизводим."""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from .knowledge import Knowledge
from .lor import LorItem
from .util import add_months, norm_id, parse_date

SEVERITY = {"OK": 0, "INFO": 1, "WARN": 2, "FAIL": 3}


@dataclass
class Context:
    request_id: str
    service_line: str
    work_start: date
    work_end: date
    flags: dict = field(default_factory=dict)


@dataclass
class Finding:
    item: LorItem
    rule: dict | None
    status: str
    reasons: list[str]
    declared: bool = False
    cert: dict | None = None
    valid_until: date | None = None


@dataclass
class Result:
    findings: list[Finding]
    unrecognized: list[dict]
    certs: list[dict]

    def counts(self) -> dict:
        c = defaultdict(int)
        for f in self.findings:
            c[f.status] += 1
        return dict(c)


def _valid_until(cert: dict, rule: dict) -> date | None:
    expiry = parse_date(cert.get("expiry_date"))
    issue = parse_date(cert.get("issue_date"))
    by_age = add_months(issue, rule["max_age_months"]) if issue and rule.get("max_age_months") else None
    candidates = [d for d in (expiry, by_age) if d]
    return min(candidates) if candidates else None


def _evaluate(cert: dict, rule: dict, ctx: Context, kn: Knowledge) -> tuple[str, list[str], date | None]:
    status, reasons = "OK", []
    until = _valid_until(cert, rule)
    if until is None:
        if rule.get("max_age_months") or cert.get("expiry_date"):
            status, reasons = "WARN", ["Не удалось определить срок действия (нет дат)"]
    elif until < ctx.work_start:
        status, reasons = "FAIL", [f"Истёк {until:%d.%m.%Y} — до начала работ"]
    elif until < ctx.work_end:
        status, reasons = "WARN", [f"Истекает {until:%d.%m.%Y} — во время работ"]
    if rule.get("third_party_required"):
        if not cert.get("issuer"):
            status = max(status, "WARN", key=SEVERITY.get)
            reasons.append("Не указана выдавшая организация")
        elif not kn.issuer_approved(cert["issuer"]):
            status = max(status, "WARN", key=SEVERITY.get)
            reasons.append(f"'{cert['issuer']}' нет в списке одобренных организаций")
    if cert.get("notes"):
        status = max(status, "WARN", key=SEVERITY.get)
        reasons.append(f"Замечание при чтении: {cert['notes']}")
    return status, reasons, until


def run_check(kn: Knowledge, ctx: Context, items: list[LorItem], certs: list[dict],
              skipped: list[tuple[Path, str]] = (), approved_only: bool = False) -> Result:
    by_serial, by_number = defaultdict(list), defaultdict(list)
    for c in certs:
        for s in c.get("serial_numbers") or []:
            by_serial[norm_id(s)].append(c)
        if c.get("certificate_number"):
            by_number[norm_id(c["certificate_number"])].append(c)

    findings, unrecognized, used = [], [], set()

    for item in items:
        if not item.category:
            unrecognized.append({"what": "Оборудование LoR", "name": f"строка {item.row}: {item.description}",
                                 "reason": "Категория не распознана — добавьте синоним (alias add equipment)"})
            continue
        rules = kn.applicable_rules(ctx.service_line, item.category, ctx.flags, approved_only)
        if not rules:
            findings.append(Finding(item, None, "INFO", [f"Нет правил для категории '{item.category}' "
                                                          f"в линии '{ctx.service_line}'"]))
            continue
        for rule in rules:
            doc = rule["document"]
            same_serial = [c for c in by_serial.get(norm_id(item.serial), []) if c["doc_type"] == doc]
            declared_certs = [c for n in item.declared_numbers for c in by_number.get(n, []) if c["doc_type"] == doc]
            declared = doc in item.declared_types or bool(declared_certs)

            if same_serial or (declared_certs and not rule.get("serial_must_match", True)):
                pool = same_serial or declared_certs
                best = max(pool, key=lambda c: _valid_until(c, rule) or date.min)
                used.update(c["cert_id"] for c in pool)
                status, reasons, until = _evaluate(best, rule, ctx, kn)
                if not declared:
                    status = max(status, "WARN", key=SEVERITY.get)
                    reasons.append("Документ есть в пакете, но не указан в LoR")
                findings.append(Finding(item, rule, status, reasons, declared, best, until))
            elif declared_certs:
                used.update(c["cert_id"] for c in declared_certs)
                c = declared_certs[0]
                findings.append(Finding(item, rule, "FAIL", [
                    f"Серийный номер в сертификате ({', '.join(c['serial_numbers']) or 'не указан'}) "
                    f"не совпадает с LoR ({item.serial})"], True, c))
            elif declared:
                findings.append(Finding(item, rule, "FAIL", ["Заявлен в LoR, но не найден в пакете"], True))
            else:
                findings.append(Finding(item, rule, "FAIL", ["Отсутствует в пакете и не заявлен в LoR"], False))

    for c in certs:
        if c["cert_id"] in used:
            continue
        name = f"{Path(c['file']).name} (стр. {c.get('page') or 1})"
        if c["doc_type"] == "unknown":
            reason = "Тип документа не распознан" + (f": {c['notes']}" if c.get("notes") else "")
        else:
            reason = (f"{kn.doc_types[c['doc_type']].get('name', c['doc_type'])}, s/n "
                      f"{', '.join(c['serial_numbers']) or '—'}: не относится ни к одному требованию по LoR")
        unrecognized.append({"what": "Документ пакета", "name": name, "reason": reason})
    for path, reason in skipped:
        unrecognized.append({"what": "Файл", "name": Path(path).name, "reason": reason})

    return Result(findings, unrecognized, certs)
