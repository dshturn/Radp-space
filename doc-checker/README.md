# RADP doc-checker — прототип предварительной проверки пакетов readiness

Папка с пакетом (как скачан из EFT) → Excel-отчёт: чего не хватает, что просрочено, где не совпадают серийники.

> **Только фейковые документы.** Прототип работает вне периметра Aramco. Реальные пакеты подрядчиков,
> мануалы и стандарты Aramco сюда не загружаются. Все правила в `knowledge/rules.yaml` — примеры (`draft`, `PLACEHOLDER`).

## Как устроено

```
 knowledge/  ← СВОД ПРАВИЛ (то, что «обучается» и переносится в Aramco)
   rules.yaml            оборудование → обязательный документ → критерии → источник (мануал/пункт/ревизия)
   equipment.yaml        категории оборудования + синонимы для распознавания в LoR
   document_types.yaml   типы документов + синонимы
   issuers.yaml          одобренные сторонние организации
   history.jsonl         журнал: кто, когда, что изменил в базе знаний
   feedback.jsonl        несогласия ассессора с результатами проверки

 radp_check/
   ingest.py    папка пакета: распаковка zip, поиск LoR, список документов
   lor.py       чтение LoR (Excel): оборудование, серийники, заявленные документы
   extract.py   ЧТЕЦ — ИИ извлекает из каждого документа тип, №, серийники, даты, выдавшую организацию
   checker.py   ПРОВЕРЯЮЩИЙ — детерминированное сравнение (без ИИ, результат воспроизводим)
   report.py    Excel-отчёт
```

ИИ используется только в `extract.py`. Решение «соответствует / не соответствует» принимает код по правилам,
а окончательное решение — ассессор.

## Установка (Windows)

Нужен Python 3.10+ (https://www.python.org, при установке отметить «Add to PATH»).

```powershell
cd doc-checker
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Быстрый старт

```powershell
# 1. Создать фейковый пакет с 9 заложенными дефектами
python -m radp_check generate-sample demo

# 2. Проверить его (без ИИ, mock-режим понимает только сгенерированные сертификаты)
python -m radp_check check demo\package

# 3. Открыть отчёт: demo\package\_radp\report_*.xlsx
```

## Проверка пакета

```powershell
python -m radp_check check <папка> [--provider mock|claude|openai]
    --service-line slickline --work-start 2026-11-10 --work-end 2026-11-30 --flag h2s_service=true
```

Контекст заявки (номер, сервисная линия, даты работ, условия) берётся из флагов или из файла `request.yaml`
в папке пакета. Сроки действия проверяются **на даты работ**, а не на сегодня.

Отчёт (`<папка>\_radp\report_*.xlsx`):

| Лист | Что там |
|---|---|
| Сводка | итоги и предварительный статус |
| Проверка | строка = оборудование × требование: заявлено в LoR? найдено? до какой даты действует? причина |
| Нераспознанное | что система не поняла: неизвестное оборудование, нераспознанные файлы, неподдерживаемые форматы |
| Извлечено | сырые данные, которые ИИ извлёк из каждого документа, — для контроля чтеца |

Результаты извлечения кэшируются по содержимому файла (`_radp\cache`): после правки правил повторная проверка
не вызывает модель повторно.

### Провайдеры чтения документов

| `--provider` | Что это | Настройка |
|---|---|---|
| `mock` | Без ИИ, по меткам в тексте. Только для сгенерированных сертификатов | — |
| `claude` | Claude API, читает PDF и сканы (vision). Облако — **только фейковые документы** | `ANTHROPIC_API_KEY`; модель: `RADP_CLAUDE_MODEL` |
| `openai` | Любой OpenAI-совместимый endpoint: локальный Ollama / vLLM, внутренний шлюз. Текстовый режим (сканы без текстового слоя не читает) | `RADP_LLM_BASE_URL`, `RADP_LLM_MODEL`, `RADP_LLM_API_KEY` |

Модель Aramco подключается через `openai`, если её API совместим, иначе — ещё одним классом в `extract.py`
(~40 строк, остальной код не меняется).

## Обучение = пополнение базы знаний

Каждая команда пишет запись в `knowledge/history.jsonl`.

```powershell
# Свод правил
python -m radp_check rules list
python -m radp_check rules add --id SL-BOP-003 --service-line slickline --equipment wireline_bop `
    --document load_test_certificate --max-age 12 --third-party `
    --source-doc "Slickline Manual" --clause "7.3.2" --revision "Rev 4"
python -m radp_check rules add ... --when h2s_service=true      # условное правило
python -m radp_check rules status SL-BOP-003 approved            # без источника утвердить нельзя
python -m radp_check rules status SL-BOP-001 disabled --reason "заменено SL-BOP-003"

# Система не узнала оборудование или документ — научить синониму
python -m radp_check alias add equipment lubricator "lub. section"
python -m radp_check alias add document pressure_test_certificate "hydro test report"

# Новая категория оборудования / новый тип документа
python -m radp_check category add equipment tool_string "Tool string" --alias "tool string"

# Одобренная инспекционная организация
python -m radp_check issuer add "Gulf Inspection Services"

# Целостность базы
python -m radp_check validate
```

### Цикл обратной связи

1. Ассессор заполняет в отчёте колонки «Ассессор: согласен?» (Да/Нет) и «Комментарий».
2. `python -m radp_check feedback <отчёт.xlsx>` — показывает точность и правила, с которыми чаще всего не согласны;
   несогласия сохраняются в `knowledge/feedback.jsonl`.
3. По ним правятся правила и синонимы. Так система «учится» — прозрачно и с журналом изменений.

## Перенос в среду Aramco

Переносится **папка `knowledge/`**, а не код:

```powershell
python -m radp_check export knowledge_export.xlsx
```

Листы `Rules`, `EquipmentCategories`, `DocumentTypes`, `ApprovedIssuers` готовы к импорту в SharePoint Lists.
Код (~1200 строк Python) можно запустить внутри периметра как есть, поменяв провайдера на модель Aramco,
или переписать на одобренной платформе — логика проверки описана в `checker.py` и тестах.

## Тесты

```powershell
pip install pytest
python -m pytest tests
```

`test_sample_package_defects_found` сверяет отчёт с эталоном `expected.json`; `test_learning_loop` проверяет,
что новые правила, синонимы и организации сразу меняют результат.

## Ограничения прототипа

- LoR — только Excel (`.xlsx`) с колонками описания, серийного номера и документов (заголовки распознаются по синонимам в `lor.py`).
- `.docx`, `.msg`, `.tif` пока не читаются — попадают в «Нераспознанное».
- Сопоставление документа с оборудованием — по серийному номеру. Сертификаты без серийника не привяжутся.
- Нет проверки подписей и печатей; модель лишь отмечает явные сомнения в `notes`.
