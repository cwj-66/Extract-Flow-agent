# graft: github.com/SAHARIARSHOWMIK/ai-document-processing-automation@ddb4085:app/routers/dashboard.py — do not edit, re-sync via code-graft
# License: MIT. Copyright (c) 2026 Your Name.
"""样例引导。上游把发票推进批准、拒绝和导出；这里只改研报任务状态，不调用模型。"""

from __future__ import annotations

from copy import deepcopy
from uuid import uuid4

from app.api.schemas.task import TaskStatus
from app.db.models import SendLogRow
from app.extractor.meta import attach_meta, split_meta
from app.services.audit import log_event
from app.services.demo_reports import DEMO_SCENARIOS
from app.services.demo_seed import seed_demo_tasks
from app.services.store import TaskRecord, TaskStore, utcnow

_SENT_KEY = "report_clean"
_FAILED_KEY = "report_unit"


def bootstrap_demo_tasks(
    store: TaskStore,
    session_factory,
    *,
    demo_dir=None,
) -> list[TaskRecord]:
    """保证三份样例分别处于待确认、已发送、失败可重试。"""
    created = seed_demo_tasks(store, demo_dir=demo_dir)
    for record in created:
        log_event(
            "demo_seeded",
            f"已载入样例 {record.source_file}",
            task_id=record.id,
            actor="system",
            session_factory=session_factory,
        )
    records: list[TaskRecord] = []
    for key, scenario in DEMO_SCENARIOS.items():
        record = _find(store, str(scenario["filename"]))
        if record is None:
            continue
        if key == _SENT_KEY:
            _mark_sent(store, record, session_factory)
        elif key == _FAILED_KEY:
            _mark_failed(store, record, session_factory)
        records.append(store.get(record.id) or record)
    return records


def _find(store: TaskStore, filename: str) -> TaskRecord | None:
    items, _total = store.list_all(q=filename, offset=0, limit=50)
    return next((item for item in items if item.source_file == filename), None)


def _mark_sent(store: TaskStore, record: TaskRecord, session_factory) -> None:
    if record.status == TaskStatus.SENT or record.extraction is None:
        return
    fields, meta = split_meta(record.extraction)
    ai_fields = deepcopy(fields)
    final_fields = deepcopy(fields)
    if final_fields.get("rating") == "增持":
        final_fields["rating"] = "买入"
    metrics = meta.get("metrics") if isinstance(meta.get("metrics"), dict) else {}
    metrics = {**metrics, "model": metrics.get("model") or "demo", "elapsed_ms": 1800, "estimated_cny": 0.03}
    meta = {**meta, "metrics": metrics}
    record.extraction = attach_meta(final_fields, meta)
    record.confirmed_group_id = "demo"
    record.touch(status=TaskStatus.SENT, error="")
    store.save(record)
    with session_factory() as session:
        session.add(
            SendLogRow(
                id=str(uuid4()),
                task_id=record.id,
                group_id="demo",
                user_id="demo",
                status="sent",
                ai_fields=ai_fields,
                final_fields=final_fields,
                created_at=utcnow(),
            )
        )
        session.commit()
    log_event(
        "task_sent",
        "样例已标记为发送完成",
        task_id=record.id,
        actor="system",
        session_factory=session_factory,
    )


def _mark_failed(store: TaskStore, record: TaskRecord, session_factory) -> None:
    if record.status != TaskStatus.PENDING_CONFIRM:
        return
    record.touch(status=TaskStatus.FAILED, error="飞书发送失败: 演示用超时，可再次确认")
    store.save(record)
    log_event(
        "send_failed",
        "样例发送失败，可重试",
        task_id=record.id,
        actor="system",
        session_factory=session_factory,
    )
