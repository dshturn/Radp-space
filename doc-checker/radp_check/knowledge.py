"""Knowledge base: rules, alias dictionaries, approved issuers.

This is the part of the system that "learns" and is transferred to the Aramco environment.
Everything lives in YAML files under knowledge/; every change is appended to history.jsonl.
"""
from __future__ import annotations

import getpass
import json
import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import yaml

DEFAULT_DIR = Path(__file__).resolve().parent.parent / "knowledge"
RULE_STATUSES = ("draft", "approved", "disabled")


def default_dir() -> Path:
    return Path(os.environ.get("RADP_KNOWLEDGE_DIR", DEFAULT_DIR))


def _norm_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def _best_alias_match(text: str, table: dict) -> str | None:
    """Table key whose longest alias occurs in the text as a whole word."""
    text = _norm_text(text)
    best, best_len = None, 0
    for key, entry in table.items():
        aliases = list(entry.get("aliases", [])) + [key.replace("_", " ")]
        for alias in aliases:
            alias = _norm_text(alias)
            if alias and len(alias) > best_len and re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", text):
                best, best_len = key, len(alias)
    return best


@dataclass
class Knowledge:
    dir: Path
    rules: list[dict] = field(default_factory=list)
    equipment: dict = field(default_factory=dict)
    doc_types: dict = field(default_factory=dict)
    issuers: list[str] = field(default_factory=list)

    # ---------- load / save ----------

    @classmethod
    def load(cls, directory: Path | None = None) -> "Knowledge":
        d = Path(directory or default_dir())
        read = lambda name: yaml.safe_load((d / name).read_text(encoding="utf-8")) or {}
        return cls(
            dir=d,
            rules=read("rules.yaml").get("rules", []) or [],
            equipment=read("equipment.yaml").get("categories", {}) or {},
            doc_types=read("document_types.yaml").get("types", {}) or {},
            issuers=read("issuers.yaml").get("approved", []) or [],
        )

    def _dump(self, name: str, data: dict) -> None:
        text = yaml.safe_dump(data, allow_unicode=True, sort_keys=False, width=120)
        (self.dir / name).write_text(text, encoding="utf-8")

    def save_rules(self) -> None:
        self._dump("rules.yaml", {"rules": self.rules})

    def save_equipment(self) -> None:
        self._dump("equipment.yaml", {"categories": self.equipment})

    def save_doc_types(self) -> None:
        self._dump("document_types.yaml", {"types": self.doc_types})

    def save_issuers(self) -> None:
        self._dump("issuers.yaml", {"approved": self.issuers})

    def log(self, action: str, **details) -> None:
        entry = {"ts": datetime.now().isoformat(timespec="seconds"), "user": getpass.getuser(),
                 "action": action, **details}
        with open(self.dir / "history.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False, default=str) + "\n")

    # ---------- lookup ----------

    def match_equipment(self, text: str) -> str | None:
        return _best_alias_match(text, self.equipment)

    def match_doc_type(self, text: str) -> str | None:
        return _best_alias_match(text, self.doc_types)

    def issuer_approved(self, issuer: str | None) -> bool:
        name = _norm_text(issuer or "")
        if not name:
            return False
        return any(_norm_text(a) in name or name in _norm_text(a) for a in self.issuers)

    def rule(self, rule_id: str) -> dict | None:
        return next((r for r in self.rules if r["id"] == rule_id), None)

    def applicable_rules(self, service_line: str, category: str, flags: dict,
                         approved_only: bool = False) -> list[dict]:
        out = []
        for r in self.rules:
            if r.get("service_line") != service_line or r.get("equipment") != category:
                continue
            status = r.get("status", "draft")
            if status == "disabled" or (approved_only and status != "approved"):
                continue
            if all(flags.get(k, False) == v for k, v in (r.get("when") or {}).items()):
                out.append(r)
        return out

    # ---------- integrity check ----------

    def validate(self) -> list[str]:
        problems, seen = [], set()
        for r in self.rules:
            rid = r.get("id", "?")
            if rid in seen:
                problems.append(f"{rid}: duplicate id")
            seen.add(rid)
            if r.get("equipment") not in self.equipment:
                problems.append(f"{rid}: unknown equipment category '{r.get('equipment')}'")
            if r.get("document") not in self.doc_types:
                problems.append(f"{rid}: unknown document type '{r.get('document')}'")
            if r.get("status", "draft") not in RULE_STATUSES:
                problems.append(f"{rid}: invalid status '{r.get('status')}'")
            if r.get("status") == "approved" and (r.get("source") or {}).get("document") in (None, "", "PLACEHOLDER"):
                problems.append(f"{rid}: approved but no requirement source given")
        return problems
