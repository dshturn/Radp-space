import json
import shutil
from pathlib import Path

from openpyxl import load_workbook

from radp_check.cli import main
from radp_check.knowledge import DEFAULT_DIR, Knowledge

STATUS = {"OK": "OK", "WARN": "ВНИМАНИЕ", "FAIL": "НЕ СООТВ."}


def _setup(tmp_path):
    kn_dir = tmp_path / "knowledge"
    shutil.copytree(DEFAULT_DIR, kn_dir)
    main(["--knowledge", str(kn_dir), "generate-sample", str(tmp_path / "demo")])
    return kn_dir, tmp_path / "demo" / "package"


def _check(kn_dir, pkg, out):
    assert main(["--knowledge", str(kn_dir), "check", str(pkg), "--out", str(out)]) == 0
    wb = load_workbook(out)
    rows = list(wb["Проверка"].iter_rows(values_only=True))
    idx = {n: i for i, n in enumerate(rows[0])}
    findings = {r[idx["Правило"]]: (r[idx["Результат"]], r[idx["Причина"]] or "") for r in rows[1:]}
    unrecognized = [r[1] for r in list(wb["Нераспознанное"].iter_rows(values_only=True))[1:]]
    return wb, findings, unrecognized


def test_sample_package_defects_found(tmp_path):
    kn_dir, pkg = _setup(tmp_path)
    expected = json.loads((tmp_path / "demo" / "expected.json").read_text(encoding="utf-8"))
    _, findings, unrecognized = _check(kn_dir, pkg, tmp_path / "r.xlsx")

    assert set(findings) == set(expected["findings"])
    for rule_id, (status, reason_part) in expected["findings"].items():
        got_status, got_reason = findings[rule_id]
        assert got_status == STATUS[status], rule_id
        assert reason_part in got_reason, (rule_id, got_reason)
    for name in expected["unrecognized_contains"]:
        assert any(name in u for u in unrecognized), name


def test_learning_loop(tmp_path):
    kn_dir, pkg = _setup(tmp_path)
    run = lambda *a: main(["--knowledge", str(kn_dir), *a])

    # Новая категория + правило -> бывшее «нераспознанное» оборудование начинает проверяться
    assert run("category", "add", "equipment", "tool_string", "Tool string", "--alias", "tool string") == 0
    assert run("rules", "add", "--id", "SL-TS-001", "--service-line", "slickline", "--equipment", "tool_string",
               "--document", "third_party_inspection", "--max-age", "12", "--third-party") == 0
    _, findings, unrecognized = _check(kn_dir, pkg, tmp_path / "r2.xlsx")
    assert findings["SL-TS-001"][0] == "НЕ СООТВ."
    assert not any("Tool string" in u for u in unrecognized)

    # Одобрили организацию -> предупреждение ушло
    assert run("issuer", "add", "Falcon Inspection Co") == 0
    _, findings, _ = _check(kn_dir, pkg, tmp_path / "r3.xlsx")
    assert findings["SL-UNT-001"][0] == "OK"

    # Без источника требования правило утвердить нельзя
    assert run("rules", "status", "SL-TS-001", "approved") == 1

    # Каждое изменение записано в историю
    actions = [json.loads(l)["action"] for l in (kn_dir / "history.jsonl").read_text(encoding="utf-8").splitlines()]
    assert actions == ["category_add", "rule_add", "issuer_add"]
    assert Knowledge.load(kn_dir).validate() == []


def test_feedback_collected(tmp_path):
    kn_dir, pkg = _setup(tmp_path)
    wb, _, _ = _check(kn_dir, pkg, tmp_path / "r.xlsx")
    ws = wb["Проверка"]
    header = [c.value for c in ws[1]]
    col = header.index("Ассессор: согласен?") + 1
    comment = header.index("Комментарий ассессора") + 1
    ws.cell(2, col, "Да")
    ws.cell(3, col, "Нет")
    ws.cell(3, comment, "Подрядчик прислал исправленный сертификат")
    wb.save(tmp_path / "r.xlsx")

    assert main(["--knowledge", str(kn_dir), "feedback", str(tmp_path / "r.xlsx")]) == 0
    lines = (kn_dir / "feedback.jsonl").read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1 and "исправленный" in lines[0]
