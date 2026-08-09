"""PostgreSQL/SQLite 任务存储。"""

from __future__ import annotations

from pathlib import Path
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.schemas.task import TaskStatus
from app.db.models import BatchRow, ExtractionResultRow, TaskRow
from app.db.session import get_session_factory
from app.services.store import BatchRecord, TaskRecord, as_utc, utcnow


class DbTaskStore:
    """线程安全：每次读写使用独立 Session。"""

    def __init__(self, session_factory=None) -> None:
        self._session_factory = session_factory or get_session_factory()

    def create(
        self,
        source_file: str,
        file_path: Path,
        *,
        user_id: str = "anonymous",
        document_type: str = "broker_report_review",
        batch_id: str | None = None,
        relative_path: str | None = None,
    ) -> TaskRecord:
        now = utcnow()
        record = TaskRecord(
            id=str(uuid4()),
            status=TaskStatus.QUEUED,
            source_file=source_file,
            file_path=file_path,
            user_id=user_id,
            document_type=document_type,
            batch_id=batch_id,
            relative_path=relative_path,
            created_at=now,
            updated_at=now,
        )
        with self._session() as session:
            session.add(_to_task_row(record))
            session.commit()
        return record

    def create_batch(
        self,
        *,
        name: str,
        user_id: str,
        total: int,
    ) -> BatchRecord:
        now = utcnow()
        record = BatchRecord(
            id=str(uuid4()),
            name=name,
            user_id=user_id,
            total=total,
            created_at=now,
        )
        with self._session() as session:
            session.add(
                BatchRow(
                    id=record.id,
                    name=record.name,
                    user_id=record.user_id,
                    total=record.total,
                    created_at=record.created_at,
                )
            )
            session.commit()
        return record

    def get(self, task_id: str) -> TaskRecord | None:
        with self._session() as session:
            row = session.scalars(
                select(TaskRow)
                .where(TaskRow.id == task_id)
                .options(selectinload(TaskRow.extraction_row))
            ).first()
            return _from_task_row(row) if row else None

    def get_batch(self, batch_id: str) -> BatchRecord | None:
        with self._session() as session:
            row = session.get(BatchRow, batch_id)
            if row is None:
                return None
            return BatchRecord(
                id=row.id,
                name=row.name,
                user_id=row.user_id,
                total=row.total,
                created_at=as_utc(row.created_at) or row.created_at,
            )

    def list_by_batch(self, batch_id: str) -> list[TaskRecord]:
        with self._session() as session:
            rows = session.scalars(
                select(TaskRow)
                .where(TaskRow.batch_id == batch_id)
                .options(selectinload(TaskRow.extraction_row))
                .order_by(TaskRow.created_at.asc())
            ).all()
            return [_from_task_row(r) for r in rows]

    def save(self, record: TaskRecord) -> None:
        with self._session() as session:
            row = session.scalars(
                select(TaskRow)
                .where(TaskRow.id == record.id)
                .options(selectinload(TaskRow.extraction_row))
            ).first()
            if row is None:
                row = _to_task_row(record)
                session.add(row)
            else:
                _apply_record(row, record)

            if record.extraction is not None:
                if row.extraction_row is None:
                    row.extraction_row = ExtractionResultRow(
                        task_id=record.id,
                        fields=record.extraction,
                        created_at=record.extracted_at or utcnow(),
                        updated_at=utcnow(),
                    )
                else:
                    row.extraction_row.fields = record.extraction
                    row.extraction_row.updated_at = utcnow()
            session.commit()

    def list_all(
        self,
        *,
        status: TaskStatus | None = None,
        q: str | None = None,
        batch_id: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[TaskRecord], int]:
        with self._session() as session:
            stmt = select(TaskRow).options(selectinload(TaskRow.extraction_row))
            if status is not None:
                stmt = stmt.where(TaskRow.status == status.value)
            if batch_id is not None:
                stmt = stmt.where(TaskRow.batch_id == batch_id)
            rows = list(session.scalars(stmt.order_by(TaskRow.created_at.desc())).all())
            records = [_from_task_row(r) for r in rows]
            if q:
                needle = q.strip().lower()
                records = [r for r in records if _match_query(r, needle)]
            total = len(records)
            return records[offset : offset + limit], total

    def delete(self, task_id: str) -> bool:
        with self._session() as session:
            row = session.get(TaskRow, task_id)
            if row is None:
                return False
            session.delete(row)
            session.commit()
            return True

    def _session(self) -> Session:
        return self._session_factory()


def _to_task_row(record: TaskRecord) -> TaskRow:
    row = TaskRow(
        id=record.id,
        status=record.status.value,
        source_file=record.source_file,
        file_path=str(record.file_path) if record.file_path else "",
        document_type=record.document_type,
        user_id=record.user_id,
        batch_id=record.batch_id,
        relative_path=record.relative_path,
        created_at=record.created_at,
        updated_at=record.updated_at,
        error_message=record.error_message,
        parsed_markdown=record.parsed_markdown,
        extracted_at=record.extracted_at,
        confirmed_group_id=record.confirmed_group_id,
    )
    if record.extraction is not None:
        row.extraction_row = ExtractionResultRow(
            task_id=record.id,
            fields=record.extraction,
            created_at=record.extracted_at or record.created_at,
            updated_at=record.updated_at,
        )
    return row


def _apply_record(row: TaskRow, record: TaskRecord) -> None:
    row.status = record.status.value
    row.source_file = record.source_file
    row.file_path = str(record.file_path) if record.file_path else ""
    row.document_type = record.document_type
    row.user_id = record.user_id
    row.batch_id = record.batch_id
    row.relative_path = record.relative_path
    row.updated_at = record.updated_at
    row.error_message = record.error_message
    row.parsed_markdown = record.parsed_markdown
    row.extracted_at = record.extracted_at
    row.confirmed_group_id = record.confirmed_group_id


def _from_task_row(row: TaskRow) -> TaskRecord:
    extraction: dict[str, Any] | None = None
    if row.extraction_row is not None:
        extraction = row.extraction_row.fields
    return TaskRecord(
        id=row.id,
        status=TaskStatus(row.status),
        source_file=row.source_file,
        file_path=Path(row.file_path) if row.file_path else Path(),
        document_type=row.document_type,
        user_id=row.user_id,
        batch_id=row.batch_id,
        relative_path=row.relative_path,
        created_at=as_utc(row.created_at) or row.created_at,
        updated_at=as_utc(row.updated_at) or row.updated_at,
        error_message=row.error_message,
        parsed_markdown=row.parsed_markdown,
        extraction=extraction,
        extracted_at=as_utc(row.extracted_at),
        confirmed_group_id=row.confirmed_group_id,
    )


def _match_query(record: TaskRecord, needle: str) -> bool:
    if needle in record.source_file.lower():
        return True
    if record.relative_path and needle in record.relative_path.lower():
        return True
    if record.extraction:
        company = (record.extraction.get("company_name") or "").lower()
        code = (record.extraction.get("stock_code") or "").lower()
        if needle in company or needle in code:
            return True
    return False
