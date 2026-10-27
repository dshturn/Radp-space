"""Command line: python -m radp_check <command> ... (see README.md)."""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

import yaml
from openpyxl import Workbook, load_workbook

from . import samples
from .checker import Context, run_check
from .extract import extract_all, get_extractor
from .ingest import WORK_DIR_NAME, collect
from .knowledge import RULE_STATUSES, Knowledge
from .lor import read_lor
from .report import CHECK_COLUMNS, write_report
from .util import parse_date


def _flag(value: str) -> tuple[str, object]:
    key, _, raw = value.partition("=")
    return key.strip(), yaml.safe_load(raw) if raw else True


# ---------------- check ----------------

def cmd_check(args, kn: Knowledge) -> int:
    pkg = collect(Path(args.package), args.lor)
    req = yaml.safe_load(pkg.request_file.read_text(encoding="utf-8")) if pkg.request_file else {}
    flags = dict(req.get("flags") or {})
    flags.update(dict(_flag(f) for f in args.flag or []))
    ctx = Context(
        request_id=args.request_id or req.get("request_id") or Path(args.package).name,
        service_line=args.service_line or req.get("service_line") or "",
        work_start=parse_date(args.work_start or req.get("work_start")),
        work_end=parse_date(args.work_end or req.get("work_end") or args.work_start or req.get("work_start")),
        flags=flags,
    )
    missing = [n for n, v in (("--service-line", ctx.service_line), ("--work-start", ctx.work_start)) if not v]
    if missing:
        print(f"Missing request context: {', '.join(missing)} (or put request.yaml in the package folder)")
        return 2
    if not pkg.lor:
        print("No LoR (.xlsx) found in the package. Specify it with --lor <file>")
        return 2

    print(f"Request {ctx.request_id} | {ctx.service_line} | work {ctx.work_start} to {ctx.work_end} | {flags or ''}")
    items, lor_problems = read_lor(pkg.lor, kn)
    print(f"LoR: {pkg.lor.name} - {len(items)} items")
    for p in lor_problems:
        print(f"  ! {p}")

    print(f"Documents: {len(pkg.documents)} files, reader: {args.provider}")
    extractor = get_extractor(args.provider)
    certs, failures = extract_all(pkg.documents, extractor, kn, Path(args.package) / WORK_DIR_NAME / "cache")

    result = run_check(kn, ctx, items, certs, pkg.skipped + failures, args.approved_only)
    out = Path(args.out) if args.out else (Path(args.package) / WORK_DIR_NAME /
                                           f"report_{ctx.request_id}_{datetime.now():%Y%m%d_%H%M}.xlsx")
    write_report(out, kn, ctx, result, args.provider)

    c = result.counts()
    print(f"\nResult: OK {c.get('OK', 0)} | WARNING {c.get('WARN', 0)} | FAIL {c.get('FAIL', 0)} | "
          f"unrecognised {len(result.unrecognized)}")
    print(f"Report: {out}")
    return 0


# ---------------- learning: rules ----------------

def cmd_rules_list(args, kn: Knowledge) -> int:
    for r in kn.rules:
        if args.service_line and r.get("service_line") != args.service_line:
            continue
        when = ", ".join(f"{k}={v}" for k, v in (r.get("when") or {}).items())
        print(f"{r['id']:<12} [{r.get('status', 'draft'):<8}] {r['equipment']:<18} -> {r['document']:<26} "
              f"max {r.get('max_age_months') or '-'} mo."
              f"{'  3rd party' if r.get('third_party_required') else ''}{'  when ' + when if when else ''}")
    return 0


def cmd_rules_add(args, kn: Knowledge) -> int:
    if kn.rule(args.id):
        print(f"Rule {args.id} already exists. To change it, disable it and add a new rule with a new id.")
        return 1
    rule = {
        "id": args.id, "service_line": args.service_line, "equipment": args.equipment,
        "document": args.document, "when": dict(_flag(f) for f in args.when or []),
        "max_age_months": args.max_age, "serial_must_match": not args.no_serial_match,
        "third_party_required": args.third_party, "status": "draft",
        "source": {"document": args.source_doc or "PLACEHOLDER", "clause": args.clause or "",
                   "revision": args.revision or ""},
        "note": args.note or "",
    }
    kn.rules.append(rule)
    problems = [p for p in kn.validate() if p.startswith(args.id)]
    if problems:
        print("Rule not added:\n  " + "\n  ".join(problems))
        return 1
    kn.save_rules()
    kn.log("rule_add", rule=rule)
    print(f"Added {args.id} (status: draft). To approve: rules status {args.id} approved")
    return 0


def cmd_rules_status(args, kn: Knowledge) -> int:
    rule = kn.rule(args.id)
    if not rule:
        print(f"No rule {args.id}")
        return 1
    if args.status == "approved" and (rule.get("source") or {}).get("document") in (None, "", "PLACEHOLDER"):
        print("A rule cannot be approved without a requirement source (document/clause/revision).")
        return 1
    old = rule.get("status")
    rule["status"] = args.status
    kn.save_rules()
    kn.log("rule_status", id=args.id, old=old, new=args.status, reason=args.reason)
    print(f"{args.id}: {old} -> {args.status}")
    return 0


# ---------------- learning: dictionaries ----------------

def _table(kn: Knowledge, kind: str):
    return (kn.equipment, kn.save_equipment) if kind == "equipment" else (kn.doc_types, kn.save_doc_types)


def cmd_alias_add(args, kn: Knowledge) -> int:
    table, save = _table(kn, args.kind)
    if args.key not in table:
        print(f"No key '{args.key}'. Existing: {', '.join(table)}")
        return 1
    aliases = table[args.key].setdefault("aliases", [])
    if args.alias.lower() in (a.lower() for a in aliases):
        print("Alias already exists")
        return 0
    aliases.append(args.alias)
    save()
    kn.log("alias_add", kind=args.kind, key=args.key, alias=args.alias)
    print(f"{args.kind}/{args.key}: added alias '{args.alias}'")
    return 0


def cmd_category_add(args, kn: Knowledge) -> int:
    table, save = _table(kn, args.kind)
    if args.key in table:
        print(f"'{args.key}' already exists")
        return 1
    table[args.key] = {"name": args.name, "aliases": args.alias or []}
    save()
    kn.log("category_add", kind=args.kind, key=args.key, name=args.name, aliases=args.alias or [])
    print(f"Added {args.kind}/{args.key}")
    return 0


def cmd_issuer_add(args, kn: Knowledge) -> int:
    if kn.issuer_approved(args.name):
        print("Already on the list")
        return 0
    kn.issuers.append(args.name)
    kn.save_issuers()
    kn.log("issuer_add", name=args.name, reason=args.reason)
    print(f"Added: {args.name}")
    return 0


# ---------------- feedback, export, validation ----------------

def cmd_feedback(args, kn: Knowledge) -> int:
    ws = load_workbook(args.report, read_only=True)["Check"]
    rows = list(ws.iter_rows(values_only=True))
    idx = {name: i for i, name in enumerate(rows[0])}
    agree, disagree = 0, []
    for row in rows[1:]:
        verdict = str(row[idx["Assessor agrees?"]] or "").strip().lower()
        if verdict == "yes":
            agree += 1
        elif verdict == "no":
            disagree.append({k: row[idx[k]] for k in CHECK_COLUMNS if k in idx})
    with open(kn.dir / "feedback.jsonl", "a", encoding="utf-8") as f:
        for d in disagree:
            f.write(json.dumps({"ts": datetime.now().isoformat(timespec="seconds"),
                                "report": Path(args.report).name, **d}, ensure_ascii=False, default=str) + "\n")
    total = agree + len(disagree)
    if not total:
        print("The 'Assessor agrees?' column is empty in this report")
        return 1
    print(f"Reviewed {total}: agree {agree}, disagree {len(disagree)} "
          f"(precision {agree / total:.0%}). Disagreements saved to knowledge/feedback.jsonl")
    for rule_id, n in Counter(d["Rule"] or "(no rule)" for d in disagree).most_common():
        print(f"  {rule_id}: {n} - review the rule or aliases")
        for d in disagree:
            if (d["Rule"] or "(no rule)") == rule_id and d.get("Assessor comment"):
                print(f"      \"{d['Assessor comment']}\"")
    return 0


def cmd_export(args, kn: Knowledge) -> int:
    """Export the knowledge base to Excel in a format ready for SharePoint List import."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Rules"
    ws.append(["RuleID", "ServiceLine", "Equipment", "Document", "Conditions", "MaxAgeMonths",
               "SerialMustMatch", "ThirdPartyRequired", "Status", "SourceDocument", "Clause", "Revision", "Note"])
    for r in kn.rules:
        s = r.get("source") or {}
        ws.append([r["id"], r["service_line"], r["equipment"], r["document"],
                   json.dumps(r.get("when") or {}), r.get("max_age_months"), r.get("serial_must_match"),
                   r.get("third_party_required"), r.get("status"), s.get("document"), s.get("clause"),
                   s.get("revision"), r.get("note")])
    for title, table in (("EquipmentCategories", kn.equipment), ("DocumentTypes", kn.doc_types)):
        ws = wb.create_sheet(title)
        ws.append(["Key", "Name", "Aliases"])
        for k, v in table.items():
            ws.append([k, v.get("name"), "; ".join(v.get("aliases", []))])
    ws = wb.create_sheet("ApprovedIssuers")
    ws.append(["Name"])
    for i in kn.issuers:
        ws.append([i])
    wb.save(args.out)
    print(f"Exported to {args.out}")
    return 0


def cmd_validate(args, kn: Knowledge) -> int:
    problems = kn.validate()
    print("\n".join(problems) if problems else
          f"OK: {len(kn.rules)} rules, {len(kn.equipment)} equipment categories, {len(kn.doc_types)} document types")
    return 1 if problems else 0


def cmd_generate(args, kn: Knowledge) -> int:
    pkg = samples.generate(Path(args.dir))
    print(f"Fake package: {pkg}\nExpected defects: {Path(args.dir) / 'expected.json'}")
    print(f"To check it: python -m radp_check check \"{pkg}\"")
    return 0


# ---------------- argparse ----------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="radp_check", description="Readiness package pre-screening")
    p.add_argument("--knowledge", help="Knowledge base folder (default: ./knowledge)")
    sub = p.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("check", help="Check a package")
    c.add_argument("package")
    c.add_argument("--provider", choices=["mock", "claude", "openai"], default="mock")
    c.add_argument("--request-id")
    c.add_argument("--service-line")
    c.add_argument("--work-start")
    c.add_argument("--work-end")
    c.add_argument("--flag", action="append", help="Work condition, e.g. h2s_service=true")
    c.add_argument("--lor", help="LoR file, if not detected automatically")
    c.add_argument("--approved-only", action="store_true", help="Use approved rules only")
    c.add_argument("--out", help="Report output path")
    c.set_defaults(fn=cmd_check)

    g = sub.add_parser("generate-sample", help="Create a fake package with seeded defects")
    g.add_argument("dir")
    g.set_defaults(fn=cmd_generate)

    r = sub.add_parser("rules", help="Rule base").add_subparsers(dest="sub", required=True)
    rl = r.add_parser("list")
    rl.add_argument("--service-line")
    rl.set_defaults(fn=cmd_rules_list)
    ra = r.add_parser("add")
    ra.add_argument("--id", required=True)
    ra.add_argument("--service-line", required=True)
    ra.add_argument("--equipment", required=True, help="category key from equipment.yaml")
    ra.add_argument("--document", required=True, help="type key from document_types.yaml")
    ra.add_argument("--max-age", type=int, help="Maximum document age, months")
    ra.add_argument("--third-party", action="store_true", help="Approved third-party issuer required")
    ra.add_argument("--no-serial-match", action="store_true", help="Do not require a serial number match")
    ra.add_argument("--when", action="append", help="Condition, e.g. h2s_service=true")
    ra.add_argument("--source-doc")
    ra.add_argument("--clause")
    ra.add_argument("--revision")
    ra.add_argument("--note")
    ra.set_defaults(fn=cmd_rules_add)
    rs = r.add_parser("status")
    rs.add_argument("id")
    rs.add_argument("status", choices=RULE_STATUSES)
    rs.add_argument("--reason")
    rs.set_defaults(fn=cmd_rules_status)

    a = sub.add_parser("alias", help="Aliases").add_subparsers(dest="sub", required=True)
    aa = a.add_parser("add")
    aa.add_argument("kind", choices=["equipment", "document"])
    aa.add_argument("key")
    aa.add_argument("alias")
    aa.set_defaults(fn=cmd_alias_add)

    k = sub.add_parser("category", help="New equipment categories / document types").add_subparsers(
        dest="sub", required=True)
    ka = k.add_parser("add")
    ka.add_argument("kind", choices=["equipment", "document"])
    ka.add_argument("key")
    ka.add_argument("name")
    ka.add_argument("--alias", action="append")
    ka.set_defaults(fn=cmd_category_add)

    i = sub.add_parser("issuer", help="Approved issuers").add_subparsers(dest="sub", required=True)
    ia = i.add_parser("add")
    ia.add_argument("name")
    ia.add_argument("--reason")
    ia.set_defaults(fn=cmd_issuer_add)

    f = sub.add_parser("feedback", help="Collect assessor feedback from a report")
    f.add_argument("report")
    f.set_defaults(fn=cmd_feedback)

    e = sub.add_parser("export", help="Export the knowledge base to Excel (for SharePoint)")
    e.add_argument("out")
    e.set_defaults(fn=cmd_export)

    v = sub.add_parser("validate", help="Validate the knowledge base")
    v.set_defaults(fn=cmd_validate)
    return p


def main(argv=None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    args = build_parser().parse_args(argv)
    kn = Knowledge.load(Path(args.knowledge) if args.knowledge else None)
    return args.fn(args, kn)
