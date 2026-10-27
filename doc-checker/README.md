# RADP doc-checker — readiness package pre-screening prototype

Package folder (as downloaded from EFT) → Excel report: every integrity check the service provider declared in the
List of Readiness is verified against the documents in the package — right serial number, right check type, same
dates, still valid for the job — and the LoR itself is checked against the rules (required checks not listed).

Current focus: **engineering items (pressure control equipment: BOP, lubricators, crossovers, tool traps…)**.
Lifting equipment (safety items) is recognised and set aside on the Scope sheet.

> **Fake documents only.** This prototype runs outside the Aramco network. Real contractor packages and Aramco
> manuals or standards must not be loaded here. All rules in `knowledge/rules.yaml` are examples (`draft`, `PLACEHOLDER`).

## How it works

```
 knowledge/  ← RULE BASE (the part that "learns" and is transferred to Aramco)
   rules.yaml            equipment → required check → criteria → source (manual / clause / revision)
   equipment.yaml        equipment categories, their discipline (engineering / safety) + aliases
   units.yaml            LoR "Responsible unit" codes → discipline
   document_types.yaml   document types + aliases
   issuers.yaml          approved third-party inspection bodies
   history.jsonl         change log: who changed what in the knowledge base, and when
   feedback.jsonl        assessor disagreements with check results

 radp_check/
   ingest.py    package folder: unzip archives, locate the LoR, list documents
   lor.py       LoR reader (Excel): header block, equipment table (one row per serial × check), mixed date formats
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
# 1. Create a fake package with seeded defects (modelled on issues found in real packages)
python -m radp_check generate-sample demo

# 2. Check it (no AI; mock mode only understands the generated certificates)
python -m radp_check check demo\package

# 3. Open the report: demo\package\_radp\report_*.xlsx
```

## Checking a package

```powershell
python -m radp_check check <folder> [--provider mock|claude|openai] --discipline engineering
    --work-start 2026-11-10 --work-end 2026-11-30
```

Request context (request number, discipline, work dates, conditions) comes from the flags or from a `request.yaml`
file in the package folder. Validity is checked **against the work dates**; without them, as of today.

### What is checked (per in-scope equipment item)

| Check | Result |
|---|---|
| Every check required by the rules is listed in the LoR | FAIL if missing (with a hint if the document is in the package anyway) |
| Every listed check has a document for the same serial and check type | FAIL if none; WARNING if the serial differs by one character (probable typo) |
| LoR inspection date = document date | FAIL if different; specific message when day and month are swapped |
| LoR inspection date not in the future | FAIL |
| LoR expiry not later than the document supports | FAIL |
| Document valid for the work period | FAIL if expired before start, WARNING if it expires during the job |
| Third-party witness where the rule requires it | WARNING if issued by a non-approved organisation |

### LoR format

The reader expects the usual service-provider layout: header block (SP, date of issue, field / well, type of job),
then sections; in the **Equipment** table each row is one declared check: S/N, description, type of integrity check
(MPI, HT, COC, LOAD TEST…), date of inspection, date of expiry, responsible unit. Column headers are matched by
aliases in `lor.py`. Dates may be Excel dates, Excel serial numbers stored as numbers, or text; ambiguous text dates
are flagged. The Manpower section is ignored.

### Disciplines and scope

Each LoR line gets a discipline from its equipment category (`equipment.yaml`), or from the responsible unit
(`units.yaml`) when the category is unknown. Map your unit codes once:

```powershell
python -m radp_check alias add unit engineering "<your engineering unit code>"
python -m radp_check alias add unit safety "<your safety unit code>"
```

The **Scope** sheet lists every LoR line with its discipline and flags lines whose assignment looks wrong
(e.g. lifting equipment assigned to the engineering unit) — useful when distributing the LoR.

Report (`<folder>\_radp\report_*.xlsx`):

| Sheet | Contents |
|---|---|
| Summary | totals and preliminary status |
| Check | one row per in-scope LoR check (plus required checks missing from the LoR): result and reason |
| Scope | every LoR line with discipline, in-scope flag and assignment remarks |
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
python -m radp_check rules add --id PCE-BOP-010 --service-line any --equipment wireline_bop `
    --document hydrostatic_test --max-age 12 --third-party `
    --source-doc "<standard / manual>" --clause "<clause>" --revision "<rev>"
python -m radp_check rules add ... --when h2s_service=true      # conditional rule
python -m radp_check rules status PCE-BOP-010 approved           # cannot approve without a source
python -m radp_check rules status PCE-BOP-002 disabled --reason "superseded by PCE-BOP-010"

# The system did not recognise equipment or a document — teach it an alias
python -m radp_check alias add equipment lubricator "lub. section"
python -m radp_check alias add document hydrostatic_test "hydro test report"

# New equipment category / new document type
python -m radp_check category add equipment tool_string "Tool string" --alias "tool string" --discipline engineering

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

Sheets `Rules`, `EquipmentCategories`, `DocumentTypes`, `ResponsibleUnits`, `ApprovedIssuers` are ready for import into SharePoint Lists.
The code (~1,200 lines of Python) can run inside the network as is, with the reader switched to the Aramco model,
or be rebuilt on an approved platform — the check logic is defined in `checker.py` and the tests.

## Tests

```powershell
pip install pytest
python -m pytest tests
```

`test_sample_package_defects_found` compares every line of the report with the `expected.json` answer key;
`test_learning_loop` verifies that knowledge changes take effect immediately; `test_lor_dates_and_serials` covers
date formats and typo detection.

## Prototype limitations

- LoR must be Excel (`.xlsx`); only the equipment table is read.
- Most real certificates are scans: the reader must be a vision model. The `openai` text mode cannot read them.
- Rules are drafts inferred from a contractor LoR pattern (pressure equipment → MPI + HT + COC); confirm intervals
  and whether in-house test charts without a third-party witness are acceptable.
- `.docx`, `.msg`, `.tif` are not read yet — they appear under "Unrecognised".
- Documents are linked to equipment by serial number. Certificates without a serial number will not be linked.
- No signature or stamp verification; the reader only flags obvious doubts in `notes`.
