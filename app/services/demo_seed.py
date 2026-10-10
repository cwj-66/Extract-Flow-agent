# graft: github.com/SAHARIARSHOWMIK/ai-document-processing-automation@ddb4085:app/services/demo_seed.py — do not edit, re-sync via code-graft
# License: MIT. Copyright (c) 2026 Your Name.
"""把样例研报种成待确认任务。上游写入 Document 行；这里写入任务存储，不跑模型。"""

from __future__ import annotations

from pathlib import Path

from app.api.schemas.task import TaskStatus
from app.extractor.grounding import ground_fields
from app.extractor.meta import attach_meta
from app.extractor.schemas import ExtractionMeta, ExtractionMetrics, ExtractionResult
from app.services.demo_reports import DEMO_SCENARIOS, SCENARIO_NOTE_PREFIX
from app.services.store import TaskRecord, TaskStore, utcnow

DEFAULT_DEMO_DIR = Path("data/demo")


def seed_demo_tasks(
    store: TaskStore,
    scenario_keys: list[str] | None = None,
    *,
    demo_dir: Path | None = None,
) -> list[TaskRecord]:
    """为尚未存在的样例创建待确认任务。按文件名去重，可重复调用。"""
    keys = scenario_keys or list(DEMO_SCENARIOS.keys())
    directory = demo_dir or DEFAULT_DEMO_DIR
    created: list[TaskRecord] = []

    for key in keys:
        scenario = DEMO_SCENARIOS.get(key)
        if not scenario:
            continue
        filename = str(scenario["filename"])
        if _already_seeded(store, filename):
            continue

        directory.mkdir(parents=True, exist_ok=True)
        pdf_path = directory / filename
        if not pdf_path.is_file():
            pdf_path.write_bytes(_placeholder_pdf(key))

        record = store.create(
            source_file=filename,
            file_path=pdf_path,
            user_id="demo",
            relative_path=f"{SCENARIO_NOTE_PREFIX}{key}",
        )
        markdown = str(scenario["markdown"])
        result = ExtractionResult.model_validate(scenario["fields"])
        evidence = ground_fields(markdown, result)
        meta = ExtractionMeta(
            evidence=evidence,
            metrics=ExtractionMetrics(model="demo"),
        )
        record.parsed_markdown = markdown
        record.extraction = attach_meta(result.model_dump(), meta.model_dump())
        record.extracted_at = utcnow()
        record.touch(status=TaskStatus.PENDING_CONFIRM)
        store.save(record)
        created.append(record)

    return created


def _already_seeded(store: TaskStore, filename: str) -> bool:
    items, _total = store.list_all(q=filename, offset=0, limit=200)
    return any(item.source_file == filename for item in items)


def _placeholder_pdf(label: str) -> bytes:
    safe = "".join(ch if 32 <= ord(ch) < 127 else "_" for ch in label) or "sample"
    stream = f"BT /F1 12 Tf 72 720 Td (Extract-Flow demo sample: {safe}) Tj ET\n".encode("ascii")
    content = (
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
        b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R"
        b"/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
        + f"4 0 obj<</Length {len(stream)}>>stream\n".encode("ascii")
        + stream
        + b"endstream\nendobj\n"
        b"5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"
    )
    return b"%PDF-1.4\n" + content + b"trailer<</Root 1 0 R>>\n%%EOF\n"
