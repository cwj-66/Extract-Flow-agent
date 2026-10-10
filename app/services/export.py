# graft: github.com/SAHARIARSHOWMIK/ai-document-processing-automation@ddb4085:app/services/export.py — do not edit, re-sync via code-graft
# License: MIT. Copyright (c) 2026 Your Name.
"""导出已发送研报。上游只导出已批准快照；这里只导出 sent 任务的确认字段，且不改任务状态。"""

from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select

from app.api.schemas.ops import ExportRecord
from app.api.schemas.task import TaskStatus
from app.config import settings
from app.db.models import ExportLogRow, SendLogRow, TaskRow
from app.extractor.schemas import ExtractionResult
from app.services.audit import log_event
from app.services.store import as_utc, utcnow

_ENVELOPE = ("task_id", "filename", "sent_at")


class ExportError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


def export_tasks(
    session_factory,
    task_ids: list[str],
    export_type: str,
    *,
    actor: str = "user",
) -> ExportRecord:
    """整批必须都是已发送，否则不写文件。"""
    if export_type not in {"csv", "json"}:
        raise ExportError(f"不支持的导出类型: {export_type}")

    unique_ids = list(dict.fromkeys(task_ids))
    with session_factory() as session:
        rows = list(session.scalars(select(TaskRow).where(TaskRow.id.in_(unique_ids))).all())
        found = {row.id: row for row in rows}
        missing = [task_id for task_id in unique_ids if task_id not in found]
        if missing:
            _fail(session_factory, missing[0], f"任务不存在: {missing[0]}", export_type, actor)
        blocked = [row for row in rows if row.status != TaskStatus.SENT.value]
        if blocked:
            _fail(
                session_factory,
                blocked[0].id,
                f"任务 {blocked[0].id} 尚未发送，不能导出",
                export_type,
                actor,
            )

        payloads: list[tuple[str, str, dict, datetime | None]] = []
        for task_id in unique_ids:
            row = found[task_id]
            log = session.scalars(
                select(SendLogRow)
                .where(SendLogRow.task_id == task_id, SendLogRow.status == "sent")
                .order_by(SendLogRow.created_at.desc())
            ).first()
            if log is None or not isinstance(log.final_fields, dict):
                _fail(session_factory, task_id, f"任务 {task_id} 没有已发送字段快照", export_type, actor)
            payloads.append((row.id, row.source_file, dict(log.final_fields), log.created_at))

    directory = Path(settings.EXPORT_DIR)
    directory.mkdir(parents=True, exist_ok=True)
    record_id = str(uuid4())
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    filename = f"export_{stamp}_{record_id[:8]}.{export_type}"
    path = directory / filename
    if export_type == "csv":
        _write_csv(path, payloads)
    else:
        _write_json(path, payloads)

    with session_factory() as session:
        session.add(
            ExportLogRow(
                id=record_id,
                export_type=export_type,
                file_path=filename,
                task_ids=unique_ids,
                task_count=len(unique_ids),
                created_at=utcnow(),
            )
        )
        session.commit()
        saved = session.get(ExportLogRow, record_id)
        result = _to_record(saved)

    for task_id in unique_ids:
        log_event(
            "export_completed",
            f"已导出 {len(unique_ids)} 份已发送研报",
            task_id=task_id,
            actor=actor,
            details={"export_type": export_type, "export_id": record_id},
            session_factory=session_factory,
        )
    return result


def list_exports(session_factory, *, limit: int = 50) -> list[ExportRecord]:
    with session_factory() as session:
        rows = session.scalars(
            select(ExportLogRow).order_by(ExportLogRow.created_at.desc()).limit(limit)
        ).all()
        return [_to_record(row) for row in rows]


def export_file(session_factory, export_id: str) -> tuple[Path, str]:
    with session_factory() as session:
        row = session.get(ExportLogRow, export_id)
        if row is None:
            raise ExportError("导出记录不存在")
        filename = Path(row.file_path).name
    root = Path(settings.EXPORT_DIR).resolve()
    resolved = (root / filename).resolve()
    if root not in resolved.parents:
        raise ExportError("导出文件不在允许目录内")
    if not resolved.is_file():
        raise ExportError("导出文件不存在")
    return resolved, resolved.name


def _fail(session_factory, task_id: str, message: str, export_type: str, actor: str) -> None:
    log_event(
        "export_failed",
        message,
        task_id=task_id,
        actor=actor,
        details={"export_type": export_type},
        session_factory=session_factory,
    )
    raise ExportError(message)


def _write_csv(path: Path, payloads: list[tuple[str, str, dict, datetime | None]]) -> None:
    field_order = list(ExtractionResult.model_fields)
    extra: list[str] = []
    table: list[dict[str, str]] = []
    for task_id, filename, fields, sent_at in payloads:
        flat = {
            "task_id": task_id,
            "filename": filename,
            "sent_at": _iso(sent_at),
        }
        for key in field_order:
            value = fields.get(key, "")
            if isinstance(value, (dict, list)):
                flat[key] = json.dumps(value, ensure_ascii=False)
            else:
                flat[key] = "" if value is None else str(value)
            if key not in extra:
                extra.append(key)
        table.append(flat)
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(_ENVELOPE) + extra)
        writer.writeheader()
        writer.writerows(table)


def _write_json(path: Path, payloads: list[tuple[str, str, dict, datetime | None]]) -> None:
    records = [
        {
            "task_id": task_id,
            "filename": filename,
            "sent_at": _iso(sent_at),
            "fields": fields,
        }
        for task_id, filename, fields, sent_at in payloads
    ]
    path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")


def _iso(value: datetime | None) -> str:
    if value is None:
        return ""
    current = as_utc(value) or value
    return current.isoformat()


def _to_record(row: ExportLogRow) -> ExportRecord:
    return ExportRecord(
        id=row.id,
        export_type=row.export_type,
        task_count=row.task_count,
        created_at=as_utc(row.created_at) or row.created_at,
        download_url=f"/export/download/{row.id}",
    )
