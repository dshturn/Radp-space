"""The "checker": verifies every check declared in the LoR against the documents in the package, and the
LoR itself against the rules. No AI here - deterministic logic only, so results are reproducible.

Three questions per in-scope equipment item:
  1. Is every check the rules require listed in the LoR?
  2. Is every listed check backed by a document for the same serial number and check type?
  3. Do the LoR dates match the document, and is the document valid for the work period?
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from .knowledge import Knowledge
from .lor import LorInfo, LorRow
from .util import add_months, near_miss, norm_id, parse_date, swap_day_month

SEVERITY = {"OK": 0, "INFO": 1, "WARN": 2, "FAIL": 3}


def worst(*statuses: str) -> str:
    return max(statuses, key=SEVERITY.get)


@dataclass
class Context:
    request_id: str
    service_line: str = ""
    discipline: str | None = None        # None = all disciplines
    work_start: date | None = None       # None = check validity as of today
    work_end: date | None = None
    flags: dict = field(default_factory=dict)
    today: date = field(default_factory=date.today)

    @property
    def period(self) -> tuple[date, date]:
        start = self.work_start or self.today
        return start, self.work_end or start


@dataclass
class Finding:
    serial: str
    description: str
    category: str | None
    check_type: str | None
    status: str
    reasons: list[str]
    lor_row: LorRow | None = None
    rule: dict | None = None
    cert: dict | None = None
    valid_until: date | None = None


@dataclass
class ScopeLine:
    row: LorRow
    discipline: str | None
    in_scope: bool
    note: str


@dataclass
class Result:
    info: LorInfo
    findings: list[Finding]
    scope: list[ScopeLine]
    unrecognized: list[dict]
    certs: list[dict]

    def counts(self) -> dict:
        c = defaultdict(int)
        for f in self.findings:
            c[f.status] += 1
        return dict(c)


class Evidence:
    """Index of extracted certificates by serial number."""

    def __init__(self, certs: list[dict]):
        self.by_serial = defaultdict(list)
        for c in certs:
            for s in c.get("serial_numbers") or []:
                self.by_serial[norm_id(s)].append(c)

    def find(self, serial: str, doc_type: str) -> tuple[list[dict], list[tuple[dict, str]]]:
        """(exact matches, near misses as (cert, serial on document))."""
        key = norm_id(serial)
        exact = [c for c in self.by_serial.get(key, []) if c["doc_type"] == doc_type]
        if exact:
            return exact, []
        near = [(c, s) for s, cs in self.by_serial.items() if near_miss(key, s)
                for c in cs if c["doc_type"] == doc_type]
        return [], near


def _evidence_valid_until(cert: dict, rule: dict | None) -> date | None:
    expiry = parse_date(cert.get("expiry_date"))
    issued = parse_date(cert.get("issue_date"))
    age = (rule or {}).get("max_age_months")
    by_age = add_months(issued, age) if issued and age else None
    candidates = [d for d in (expiry, by_age) if d]
    return min(candidates) if candidates else None


def _fmt(d: date | None) -> str:
    return d.strftime("%d-%b-%Y") if d else "-"


def _check_declared(row: LorRow, rule: dict | None, cert: dict, ctx: Context, kn: Knowledge,
                    info: LorInfo) -> tuple[str, list[str], date | None]:
    status, reasons = "OK", []
    doc_date = parse_date(cert.get("issue_date"))
    declared = row.inspection_date
    reference_day = info.issue_date or ctx.today

    if declared and declared > reference_day:
        status = worst(status, "FAIL")
        reasons.append(f"LoR inspection date {_fmt(declared)} is in the future")
    if declared is None:
        status = worst(status, "WARN")
        reasons.append("LoR inspection date missing")
    elif doc_date and declared != doc_date:
        status = worst(status, "FAIL")
        if swap_day_month(doc_date) == declared:
            reasons.append(f"LoR date {_fmt(declared)} is the document date {_fmt(doc_date)} with day and "
                           f"month swapped")
        else:
            reasons.append(f"LoR inspection date {_fmt(declared)} differs from document date {_fmt(doc_date)}")
    elif not doc_date:
        status = worst(status, "WARN")
        reasons.append("Date not readable on the document")

    until = _evidence_valid_until(cert, rule)
    if row.expiry_date and until and row.expiry_date > until:
        status = worst(status, "FAIL")
        reasons.append(f"LoR states valid until {_fmt(row.expiry_date)}; document supports only {_fmt(until)}")

    start, end = ctx.period
    if until:
        if until < start:
            status = worst(status, "FAIL")
            reasons.append(f"Expired {_fmt(until)}" + (", before work start" if ctx.work_start else ""))
        elif until < end:
            status = worst(status, "WARN")
            reasons.append(f"Expires {_fmt(until)}, during the work period")
    elif (rule or {}).get("max_age_months"):
        status = worst(status, "WARN")
        reasons.append("Validity could not be determined from the document")

    if (rule or {}).get("third_party_required"):
        if not cert.get("issuer"):
            status = worst(status, "WARN")
            reasons.append("Issuer / witness not stated - third-party witness required")
        elif not kn.issuer_approved(cert["issuer"]):
            status = worst(status, "WARN")
            reasons.append(f"Issued by '{cert['issuer']}', not an approved third party")
    if cert.get("notes"):
        status = worst(status, "WARN")
        reasons.append(f"Reader remark: {cert['notes']}")
    return status, reasons, until


def _scope(rows: list[LorRow], ctx: Context, kn: Knowledge) -> list[ScopeLine]:
    out = []
    for r in rows:
        cat_disc, unit_disc = kn.category_discipline(r.category), kn.match_unit(r.unit)
        disc = cat_disc or unit_disc
        note = ""
        if cat_disc and unit_disc and cat_disc != unit_disc:
            note = f"Assigned to '{r.unit}' ({unit_disc}) but {kn.equipment[r.category]['name']} is {cat_disc}"
        elif not disc:
            note = "Discipline unknown - add an equipment alias or map the responsible unit"
        out.append(ScopeLine(r, disc, ctx.discipline is None or disc == ctx.discipline, note))
    return out


def run_check(kn: Knowledge, ctx: Context, info: LorInfo, rows: list[LorRow], certs: list[dict],
              skipped: list[tuple[Path, str]] = (), approved_only: bool = False) -> Result:
    evidence = Evidence(certs)
    scope = _scope(rows, ctx, kn)
    findings, unrecognized, used = [], [], set()

    groups = defaultdict(list)
    for s in scope:
        if s.in_scope:
            groups[norm_id(s.row.serial) or f"row{s.row.row}"].append(s.row)

    for _, group in groups.items():
        first = group[0]
        category = next((r.category for r in group if r.category), None)
        rules = kn.applicable_rules(ctx.service_line, category, ctx.flags, approved_only) if category else []
        rule_by_doc = {r["document"]: r for r in rules}
        mk = lambda **kw: Finding(serial=first.serial, description=first.description, category=category, **kw)

        if not category:
            unrecognized.append({"what": "LoR equipment", "name": f"row {first.row}: {first.description}",
                                 "reason": "Equipment category not recognised - add an alias (alias add equipment)"})

        for row in group:
            rule = rule_by_doc.get(row.check_type)
            if not row.check_type:
                findings.append(mk(check_type=None, status="WARN", lor_row=row,
                                   reasons=[f"Check type '{row.check_raw}' not recognised - add an alias"]))
                continue
            exact, near = evidence.find(row.serial, row.check_type)
            if exact:
                best = min(exact, key=lambda c: (abs(((parse_date(c.get("issue_date")) or date.min) -
                                                      (row.inspection_date or date.min)).days), bool(c.get("notes"))))
                used.update(c["cert_id"] for c in exact)
                status, reasons, until = _check_declared(row, rule, best, ctx, kn, info)
            elif near:
                best, doc_serial = near[0]
                used.update(c["cert_id"] for c, _ in near)
                status, reasons, until = _check_declared(row, rule, best, ctx, kn, info)
                status = worst(status, "WARN")
                reasons.insert(0, f"Serial on document is '{doc_serial}', LoR has '{row.serial}' - probable typo, "
                                  f"verify")
            else:
                best, until = None, None
                status, reasons = "FAIL", ["No document in the package for this check"]
            if not rule and category:
                status = worst(status, "INFO")
                reasons.append("Check not required by the rules (listed by contractor)")
            reasons += row.remarks
            findings.append(mk(check_type=row.check_type, status=status, reasons=reasons, lor_row=row,
                               rule=rule, cert=best, valid_until=until))

        listed = {r.check_type for r in group}
        for doc, rule in rule_by_doc.items():
            if doc in listed:
                continue
            exact, near = evidence.find(first.serial, doc)
            hint = f" (document found in package: {Path(exact[0]['file']).name})" if exact else ""
            used.update(c["cert_id"] for c in exact)
            findings.append(mk(check_type=doc, status="FAIL", rule=rule, cert=exact[0] if exact else None,
                               reasons=[f"Required {kn.doc_name(doc)} not listed in the LoR{hint}"]))

    for c in certs:
        if c["cert_id"] in used or kn.is_supporting(c["doc_type"]):
            continue
        name = f"{Path(c['file']).name} (p. {c.get('page') or 1})"
        if c["doc_type"] == "unknown":
            reason = "Document type not recognised" + (f": {c['notes']}" if c.get("notes") else "")
        else:
            reason = (f"{kn.doc_name(c['doc_type'])}, s/n {', '.join(c['serial_numbers']) or '-'}: "
                      f"not linked to any in-scope LoR line")
        unrecognized.append({"what": "Package document", "name": name, "reason": reason})
    for path, reason in skipped:
        unrecognized.append({"what": "File", "name": Path(path).name, "reason": reason})

    return Result(info, findings, scope, unrecognized, certs)
