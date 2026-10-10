# graft: github.com/SAHARIARSHOWMIK/ai-document-processing-automation@ddb4085:app/routers/dashboard.py — do not edit, re-sync via code-graft
# License: MIT. Copyright (c) 2026 Your Name.
"""运营总览。上游按发票状态计数；这里统计研报任务、校验、耗时费用和人工改字段比例。"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.schemas.ops import AuditEvent, DashboardOverview
from app.api.schemas.task import TaskStatus, TaskSummary
from app.db.models import AuditLogRow, SendLogRow, TaskRow
from app.extractor.meta import split_meta
from app.extractor.schemas import ExtractionResult
from app.extractor.validation import check_report
from app.services.store import as_utc

_PROCESSING = {
    TaskStatus.QUEUED.value,
    TaskStatus.PARSING.value,
    TaskStatus.EXTRACTING.value,
    TaskStatus.SENDING.value,
}


def build_overview(session_factory) -> DashboardOverview:
    """一次读出总览。校验在读取时计算，不落库。"""
    with session_factory() as session:
        rows = list(
            session.scalars(
                select(TaskRow)
                .options(selectinload(TaskRow.extraction_row))
                .order_by(TaskRow.created_at.desc())
            ).all()
        )
        send_logs = list(
            session.scalars(
                select(SendLogRow)
                .where(SendLogRow.status == "sent")
                .order_by(SendLogRow.created_at.asc())
            ).all()
        )
        events = list(
            session.scalars(
                select(AuditLogRow).order_by(AuditLogRow.created_at.desc()).limit(10)
            ).all()
        )

    by_status = {status.value: 0 for status in TaskStatus}
    validation = {"valid": 0, "warning": 0, "failed": 0}
    elapsed: list[int] = []
    total_cny = 0.0
    for row in rows:
        by_status[row.status] = by_status.get(row.status, 0) + 1
        if row.extraction_row is None:
            continue
        fields, meta = split_meta(row.extraction_row.fields)
        metrics = meta.get("metrics") if isinstance(meta.get("metrics"), dict) else None
        if metrics:
            elapsed_ms = int(metrics.get("elapsed_ms") or 0)
            if elapsed_ms > 0:
                elapsed.append(elapsed_ms)
            total_cny += float(metrics.get("estimated_cny") or 0)
        try:
            result = ExtractionResult.model_validate(fields)
        except Exception:
            continue
        status, _issues = check_report(result, row.parsed_markdown or "")
        validation[status.value] = validation.get(status.value, 0) + 1

    latest: dict[str, SendLogRow] = {}
    for log in send_logs:
        latest[log.task_id] = log
    edited = sum(1 for log in latest.values() if (log.ai_fields or {}) != (log.final_fields or {}))
    sent_logs = len(latest)

    pending_rows = sorted(
        (row for row in rows if row.status == TaskStatus.PENDING_CONFIRM.value),
        key=lambda row: row.created_at,
    )
    return DashboardOverview(
        total=len(rows),
        pending_confirm=by_status[TaskStatus.PENDING_CONFIRM.value],
        processing=sum(by_status[name] for name in _PROCESSING),
        sent=by_status[TaskStatus.SENT.value],
        failed=by_status[TaskStatus.FAILED.value],
        by_status=by_status,
        validation=validation,
        avg_elapsed_ms=round(sum(elapsed) / len(elapsed)) if elapsed else None,
        total_estimated_cny=round(total_cny, 4),
        edited_send_count=edited,
        sent_with_log_count=sent_logs,
        edit_rate=round(edited / sent_logs, 4) if sent_logs else None,
        review_queue=[_summary(row) for row in pending_rows[:8]],
        recent_tasks=[_summary(row) for row in rows[:6]],
        recent_events=[_event(row) for row in events],
    )


def _summary(row: TaskRow) -> TaskSummary:
    fields = row.extraction_row.fields if row.extraction_row is not None else {}
    company = fields.get("company_name") if isinstance(fields, dict) else None
    code = fields.get("stock_code") if isinstance(fields, dict) else None
    created = as_utc(row.created_at) or row.created_at
    updated = as_utc(row.updated_at) or row.updated_at
    return TaskSummary(
        id=row.id,
        status=TaskStatus(row.status),
        source_file=row.source_file,
        document_type=row.document_type,
        batch_id=row.batch_id,
        relative_path=row.relative_path,
        company_name=company if isinstance(company, str) else None,
        stock_code=code if isinstance(code, str) else None,
        created_at=created,
        updated_at=updated,
        error_message=row.error_message,
    )


def _event(row: AuditLogRow) -> AuditEvent:
    return AuditEvent(
        id=row.id,
        task_id=row.task_id,
        event_type=row.event_type,
        message=row.message,
        details=row.details,
        actor=row.actor,
        created_at=as_utc(row.created_at) or row.created_at,
    )
