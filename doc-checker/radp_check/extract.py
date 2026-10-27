"""«Чтец»: извлечение фактов из документов пакета.

Провайдеры взаимозаменяемы, результат у всех одинаковый (CERT_FIELDS):
  mock    — без ИИ, по меткам в тексте; понимает только фейковые сертификаты из generate-sample
  claude  — Claude API (облако). Только для фейковых/обезличенных документов!
  openai  — любой OpenAI-совместимый endpoint (локальный Ollama/vLLM, внутренний шлюз).
            Сюда подключается модель Aramco, если её API совместим; иначе пишется ещё один адаптер.
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
    return f"""You review equipment certification documents submitted by an oilfield service contractor.
The attached file may contain one or several certificates. Return one entry per certificate.

For each certificate extract:
- doc_type: exactly one of the keys below, or "unknown" if none fits
{types}
- certificate_number: as printed, or null
- serial_numbers: every equipment serial number the certificate covers, exactly as printed
- equipment_description: the equipment named on the certificate
- issue_date, expiry_date: ISO format YYYY-MM-DD; expiry_date only if explicitly printed (do not compute it)
- issuer: the organisation that issued/performed the test or inspection
- page: 1-based page where the certificate starts
- notes: anything that makes the certificate doubtful (illegible, unsigned, altered, missing stamp), else null

Copy values exactly as printed. Never guess: use null when a value is absent or unreadable.
If the file is not a certificate at all, return it with doc_type "unknown" and describe it in notes."""


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
            return [{"doc_type": "unknown", "notes": "mock-режим не читает изображения", "page": 1}]
        certs = []
        for i, text in enumerate(pdf_pages_text(path), start=1):
            found = {k: (m.group(1).strip() if (m := re.search(rx, text)) else None) for k, rx in self.LABELS.items()}
            if not found["certificate_number"] and not found["doc_type"]:
                continue
            found["serial_numbers"] = [s.strip() for s in (found["serial_numbers"] or "").split(",") if s.strip()]
            found["page"], found["notes"] = i, None
            certs.append(found)
        return certs or [{"doc_type": "unknown", "notes": "Не похоже на сертификат", "page": 1,
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
            return [{"doc_type": "unknown", "notes": "Модель отказалась обрабатывать файл", "page": 1}]
        text = next(b.text for b in response.content if b.type == "text")
        return json.loads(text)["certificates"]


class OpenAICompatExtractor:
    """Текстовый режим: PDF -> текст (pypdf) -> чат-модель. Сканы без текстового слоя не читает."""
    name = "openai"

    def __init__(self):
        self.base_url = os.environ.get("RADP_LLM_BASE_URL", "http://localhost:11434/v1").rstrip("/")
        self.model = os.environ.get("RADP_LLM_MODEL", "qwen2.5:14b")
        self.api_key = os.environ.get("RADP_LLM_API_KEY", "")

    def extract(self, path: Path, kn: Knowledge) -> list[dict]:
        if path.suffix.lower() != ".pdf":
            return [{"doc_type": "unknown", "notes": "Текстовый режим не читает изображения — нужна vision-модель", "page": 1}]
        pages = pdf_pages_text(path)
        if not any(p.strip() for p in pages):
            return [{"doc_type": "unknown", "notes": "Скан без текстового слоя — нужна vision-модель или OCR", "page": 1}]
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
    """Извлекает сертификаты из всех файлов. Результаты кэшируются по хэшу файла,
    поэтому повторный прогон (например, после правки правил) не тратит вызовы модели."""
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
        except Exception as e:  # один плохой файл не должен останавливать проверку пакета
            failures.append((f, f"Ошибка извлечения: {type(e).__name__}: {e}"))
            continue
        certs.extend(_normalize(raw, kn, f))
    for n, c in enumerate(certs, start=1):
        c["cert_id"] = n
    return certs, failures
