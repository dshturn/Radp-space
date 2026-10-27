"""The "reader": extracts facts from the documents in a package.

Providers are interchangeable and all return the same fields (CERT_FIELDS):
  mock    - no AI, reads labelled text; understands only the fake certificates from generate-sample
  claude  - Claude API (cloud). Fake / anonymised documents only!
  openai  - any OpenAI-compatible endpoint (local Ollama/vLLM, internal gateway).
            The Aramco model plugs in here if its API is compatible; otherwise add one more adapter.
"""
from __future__ import annotations

import base64
import json
import os
import re
import urllib.request
from pathlib import Path

from .ingest import pdf_pages_text
from .knowledge import Knowledge
from .util import file_hash, parse_date

CERT_FIELDS = ("doc_type", "certificate_number", "serial_numbers", "equipment_description",
               "issue_date", "expiry_date", "issuer", "page", "notes")

_NULLABLE_STR = {"type": ["string", "null"]}
CERT_SCHEMA = {
    "type": "object",
    "properties": {
        "certificates": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "doc_type": {"type": "string"},
                    "certificate_number": _NULLABLE_STR,
                    "serial_numbers": {"type": "array", "items": {"type": "string"}},
                    "equipment_description": _NULLABLE_STR,
                    "issue_date": _NULLABLE_STR,
                    "expiry_date": _NULLABLE_STR,
                    "issuer": _NULLABLE_STR,
                    "page": {"type": ["integer", "null"]},
                    "notes": _NULLABLE_STR,
                },
                "required": list(CERT_FIELDS),
                "additionalProperties": False,
            },
        }
    },
    "required": ["certificates"],
    "additionalProperties": False,
}


def build_prompt(kn: Knowledge) -> str:
    types = "\n".join(f"- {k}: {v.get('name', k)}" for k, v in kn.doc_types.items())
    return f"""You review integrity documents for well intervention equipment (pressure control equipment
such as wireline BOPs, lubricators, crossovers, tool traps) submitted by a service provider.
A file may be a bundle: a certificate followed by attachments (mill certificates, NDE reports, test charts).
Return one entry per distinct certificate, report or chart.

For each entry extract:
- doc_type: exactly one of the keys below, or "unknown" if none fits
{types}
- certificate_number: certificate / report / reference number as printed, or null
- serial_numbers: EVERY equipment serial number the document covers, exactly as printed. Serials may be in a
  table (one row per item), in an "Identification" column, or listed in a comments field of a test chart as
  other items tested in the same string - include all of them
- equipment_description: the equipment named on the document
- issue_date: date of the test / inspection (for a COC: the certificate date), ISO YYYY-MM-DD
- expiry_date: only if a validity / expiry date is explicitly printed, ISO YYYY-MM-DD; do not compute it
- issuer: the organisation that performed or witnessed the test or inspection (a third-party inspection body
  if it witnessed the test; otherwise the company whose name and stamp appear)
- page: 1-based page where the entry starts
- notes: anything an assessor should know, else null: unsigned, witness or verification fields left blank,
  illegible, altered, missing stamp, and any date whose day/month order is ambiguous (state how you read it)

Numeric dates on documents from the Middle East and Europe are usually day-first (DD-MM-YYYY); use the
document's own context to decide, and mention it in notes when it is not certain.
Copy values exactly as printed. Never guess: use null when a value is absent or unreadable."""


def _normalize(certs: list[dict], kn: Knowledge, file: Path) -> list[dict]:
    out = []
    for c in certs:
        c = {k: c.get(k) for k in CERT_FIELDS}
        if c["doc_type"] not in kn.doc_types:
            c["doc_type"] = kn.match_doc_type(c["doc_type"] or "") or "unknown"
        for k in ("issue_date", "expiry_date"):
            d = parse_date(c[k])
            c[k] = d.isoformat() if d else None
        c["serial_numbers"] = [s for s in (c["serial_numbers"] or []) if s]
        c["file"] = str(file)
        out.append(c)
    return out


class MockExtractor:
    name = "mock"
    LABELS = {
        "doc_type": r"Certificate Type:\s*(.+)",
        "certificate_number": r"Certificate No\.?:\s*(\S+)",
        "serial_numbers": r"Serial No\.?:\s*(.+)",
        "equipment_description": r"Equipment:\s*(.+)",
        "issue_date": r"Date of Issue:\s*(.+)",
        "expiry_date": r"Valid Until:\s*(.+)",
        "issuer": r"Issued by:\s*(.+)",
    }

    def extract(self, path: Path, kn: Knowledge) -> list[dict]:
        if path.suffix.lower() != ".pdf":
            return [{"doc_type": "unknown", "notes": "mock mode cannot read images", "page": 1}]
        certs = []
        for i, text in enumerate(pdf_pages_text(path), start=1):
            found = {k: (m.group(1).strip() if (m := re.search(rx, text)) else None) for k, rx in self.LABELS.items()}
            if not found["certificate_number"] and not found["doc_type"]:
                continue
            found["serial_numbers"] = [s.strip() for s in (found["serial_numbers"] or "").split(",") if s.strip()]
            found["page"], found["notes"] = i, None
            certs.append(found)
        return certs or [{"doc_type": "unknown", "notes": "Does not look like a certificate", "page": 1,
                          "serial_numbers": []}]


class ClaudeExtractor:
    name = "claude"

    def __init__(self, model: str | None = None):
        import anthropic
        self.client = anthropic.Anthropic()
        self.model = model or os.environ.get("RADP_CLAUDE_MODEL", "claude-opus-5-5")

    def extract(self, path: Path, kn: Knowledge) -> list[dict]:
        data = base64.standard_b64encode(path.read_bytes()).decode()
        suffix = path.suffix.lower()
        if suffix == ".pdf":
            block = {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": data}}
        else:
            media = "image/png" if suffix == ".png" else "image/jpeg"
            block = {"type": "image", "source": {"type": "base64", "media_type": media, "data": data}}
        response = self.client.beta.messages.create(
            model=self.model,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "medium", "format": {"type": "json_schema", "schema": CERT_SCHEMA}},
            messages=[{"role": "user", "content": [block, {"type": "text", "text": build_prompt(kn)}]}],
        )
        if response.stop_reason == "refusal":
            return [{"doc_type": "unknown", "notes": "The model declined to process this file", "page": 1}]
        text = next(b.text for b in response.content if b.type == "text")
        return json.loads(text)["certificates"]


class OpenAICompatExtractor:
    """Text mode: PDF -> text (pypdf) -> chat model. Cannot read scans without a text layer."""
    name = "openai"

    def __init__(self):
        self.base_url = os.environ.get("RADP_LLM_BASE_URL", "http://localhost:11434/v1").rstrip("/")
        self.model = os.environ.get("RADP_LLM_MODEL", "qwen2.5:14b")
        self.api_key = os.environ.get("RADP_LLM_API_KEY", "")

    def extract(self, path: Path, kn: Knowledge) -> list[dict]:
        if path.suffix.lower() != ".pdf":
            return [{"doc_type": "unknown", "notes": "Text mode cannot read images - a vision model is required", "page": 1}]
        pages = pdf_pages_text(path)
        if not any(p.strip() for p in pages):
            return [{"doc_type": "unknown", "notes": "Scan without a text layer - a vision model or OCR is required", "page": 1}]
        doc = "\n\n".join(f"--- page {i} ---\n{t}" for i, t in enumerate(pages, start=1))
        prompt = (build_prompt(kn) + "\n\nRespond with JSON only, matching this schema:\n"
                  + json.dumps(CERT_SCHEMA) + "\n\nDocument text:\n" + doc)
        body = json.dumps({"model": self.model, "temperature": 0,
                           "messages": [{"role": "user", "content": prompt}]}).encode()
        req = urllib.request.Request(f"{self.base_url}/chat/completions", data=body, method="POST",
                                     headers={"Content-Type": "application/json",
                                              **({"Authorization": f"Bearer {self.api_key}"} if self.api_key else {})})
        with urllib.request.urlopen(req, timeout=300) as resp:
            content = json.loads(resp.read())["choices"][0]["message"]["content"]
        content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
        return json.loads(content)["certificates"]


def get_extractor(name: str):
    return {"mock": MockExtractor, "claude": ClaudeExtractor, "openai": OpenAICompatExtractor}[name]()


def extract_all(files: list[Path], extractor, kn: Knowledge, cache_dir: Path,
                progress=print) -> tuple[list[dict], list[tuple[Path, str]]]:
    """Extract certificates from all files. Results are cached by file hash, so a re-run
    (e.g. after editing rules) does not spend model calls again."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    certs, failures = [], []
    for i, f in enumerate(files, start=1):
        cache = cache_dir / f"{file_hash(f)}.{extractor.name}.json"
        try:
            if cache.exists():
                raw = json.loads(cache.read_text(encoding="utf-8"))
            else:
                progress(f"  [{i}/{len(files)}] {f.name}")
                raw = extractor.extract(f, kn)
                cache.write_text(json.dumps(raw, ensure_ascii=False, indent=1), encoding="utf-8")
        except Exception as e:  # one bad file must not stop the whole package check
            failures.append((f, f"Extraction error: {type(e).__name__}: {e}"))
            continue
        certs.extend(_normalize(raw, kn, f))
    for n, c in enumerate(certs, start=1):
        c["cert_id"] = n
    return certs, failures
