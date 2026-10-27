# RADP doc-checker — readiness package pre-screening prototype

Package folder (as downloaded from EFT) → Excel report: what is missing, what has expired, where serial numbers do not match.

> **Fake documents only.** This prototype runs outside the Aramco network. Real contractor packages and Aramco
> manuals or standards must not be loaded here. All rules in `knowledge/rules.yaml` are examples (`draft`, `PLACEHOLDER`).

## How it works

```
 knowledge/  ← RULE BASE (the part that "learns" and is transferred to Aramco)
   rules.yaml            equipment → required document → criteria → source (manual / clause / revision)
   equipment.yaml        equipment categories + aliases used to recognise them in the LoR
   document_types.yaml   document types + aliases
   issuers.yaml          approved third-party inspection bodies
   history.jsonl         change log: who changed what in the knowledge base, and when
   feedback.jsonl        assessor disagreements with check results

 radp_check/
   ingest.py    package folder: unzip archives, locate the LoR, list documents
   lor.py       LoR reader (Excel): equipment, serial numbers, declared documents
   extract.py   READER — AI extracts type, number, serials, dates and issuer from each document
   checker.py   CHECKER — deterministic comparison (no AI, reproducible results)
   report.py    Excel report
```

AI is used only in `extract.py`. Compliance is decided by code against the rules; the final decision is the assessor's.

## Installation (Windows)

Requires Python 3.10+ (https://www.python.org — tick "Add to PATH" during installation).

```powershell
cd doc-checker
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Quick start

```powershell
# 1. Create a fake package with 9 seeded defects
python -m radp_check generate-sample demo

# 2. Check it (no AI; mock mode only understands the generated certificates)
python -m radp_check check demo\package

# 3. Open the report: demo\package\_radp\report_*.xlsx
```

## Checking a package

```powershell
python -m radp_check check <folder> [--provider mock|claude|openai]
    --service-line slickline --work-start 2026-11-10 --work-end 2026-11-30 --flag h2s_service=true
```

Request context (request number, service line, work dates, conditions) comes from the flags or from a `request.yaml`
file in the package folder. Validity is checked **against the work dates**, not today's date.

Report (`<folder>\_radp\report_*.xlsx`):

| Sheet | Contents |
|---|---|
| Summary | totals and preliminary status |
| Check | one row per equipment × requirement: listed in LoR? found? valid until? reason |
| Unrecognised | what the system could not interpret: unknown equipment, unrecognised files, unsupported formats |
| Extracted | raw data the reader extracted from each document, for checking the reader itself |

Extraction results are cached by file content (`_radp\cache`), so re-checking after a rule change does not call the model again.

### Document readers

| `--provider` | What it is | Settings |
|---|---|---|
| `mock` | No AI, reads labelled text. Generated certificates only | — |
| `claude` | Claude API, reads PDFs and scans (vision). Cloud — **fake documents only** | `ANTHROPIC_API_KEY`; model: `RADP_CLAUDE_MODEL` |
| `openai` | Any OpenAI-compatible endpoint: local Ollama / vLLM, internal gateway. Text mode (cannot read scans without a text layer) | `RADP_LLM_BASE_URL`, `RADP_LLM_MODEL`, `RADP_LLM_API_KEY` |

The Aramco model plugs in through `openai` if its API is compatible; otherwise add one more class in `extract.py`
(~40 lines; nothing else changes).

## Learning = growing the knowledge base

Every command below writes an entry to `knowledge/history.jsonl`.

```powershell
# Rules
python -m radp_check rules list
python -m radp_check rules add --id SL-BOP-003 --service-line slickline --equipment wireline_bop `
    --document load_test_certificate --max-age 12 --third-party `
    --source-doc "Slickline Manual" --clause "7.3.2" --revision "Rev 4"
python -m radp_check rules add ... --when h2s_service=true      # conditional rule
python -m radp_check rules status SL-BOP-003 approved            # cannot approve without a source
python -m radp_check rules status SL-BOP-001 disabled --reason "superseded by SL-BOP-003"

# The system did not recognise equipment or a document — teach it an alias
python -m radp_check alias add equipment lubricator "lub. section"
python -m radp_check alias add document pressure_test_certificate "hydro test report"

# New equipment category / new document type
python -m radp_check category add equipment tool_string "Tool string" --alias "tool string"

# Approved inspection body
python -m radp_check issuer add "Gulf Inspection Services"

# Knowledge base integrity
python -m radp_check validate
```

### Feedback loop

1. The assessor fills in the "Assessor agrees?" (Yes/No) and "Assessor comment" columns in the report.
2. `python -m radp_check feedback <report.xlsx>` shows precision and the rules most often disputed;
   disagreements are saved to `knowledge/feedback.jsonl`.
3. Rules and aliases are corrected accordingly. This is how the system "learns": transparently, with a change log.

## Transfer to the Aramco environment

What transfers is **the `knowledge/` folder**, not the code:

```powershell
python -m radp_check export knowledge_export.xlsx
```

Sheets `Rules`, `EquipmentCategories`, `DocumentTypes`, `ApprovedIssuers` are ready for import into SharePoint Lists.
The code (~1,200 lines of Python) can run inside the network as is, with the reader switched to the Aramco model,
or be rebuilt on an approved platform — the check logic is defined in `checker.py` and the tests.

## Tests

```powershell
pip install pytest
python -m pytest tests
```

`test_sample_package_defects_found` compares the report with the `expected.json` answer key; `test_learning_loop`
verifies that new rules, aliases and issuers change the result immediately.

## Prototype limitations

- LoR must be Excel (`.xlsx`) with description, serial number and documents columns (headers are matched by aliases in `lor.py`).
- `.docx`, `.msg`, `.tif` are not read yet — they appear under "Unrecognised".
- Documents are linked to equipment by serial number. Certificates without a serial number will not be linked.
- No signature or stamp verification; the reader only flags obvious doubts in `notes`.
