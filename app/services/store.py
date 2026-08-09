"""任务存储：领域记录 + 内存实现（测试/兜底）；生产用 DbTaskStore。"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol
from uuid import uuid4

from app.api.schemas.task import TaskStatus


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(dt: datetime | None) -> datetime | None:
    """SQLite 读回可能丢失 tzinfo；按 UTC 补齐，避免前端按本地时间解析偏 8 小时。"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@dataclass
class TaskRecord:
    id: str
    status: TaskStatus
    source_file: str
    file_path: Path
    document_type: str = "broker_report_review"
    user_id: str = "anonymous"
    batch_id: str | None = None
    relative_path: str | None = None
    created_at: datetime = field(default_factory=utcnow)
    updated_at: datetime = field(default_factory=utcnow)
    error_message: str | None = None
    parsed_markdown: str | None = None
    extraction: dict[str, Any] | None = None
    extracted_at: datetime | None = None
    confirmed_group_id: str | None = None

    def touch(self, *, status: TaskStatus | None = None, error: str | None = None) -> None:
        self.updated_at = utcnow()
        if status is not None:
            self.status = status
        if error is not None:
            self.error_message = error


@dataclass
class BatchRecord:
    """一次批量上传（文件夹）聚合。"""

    id: str
    name: str
    user_id: str
    total: int
    created_at: datetime = field(default_factory=utcnow)


class TaskStore(Protocol):
    def create(
        self,
        source_file: str,
        file_path: Path,
        *,
        user_id: str = "anonymous",
        document_type: str = "broker_report_review",
        batch_id: str | None = None,
        relative_path: str | None = None,
    ) -> TaskRecord: ...

    def create_batch(
        self, *, name: str, user_id: str, total: int
    ) -> BatchRecord: ...

    def get(self, task_id: str) -> TaskRecord | None: ...

    def get_batch(self, batch_id: str) -> BatchRecord | None: ...

    def list_by_batch(self, batch_id: str) -> list[TaskRecord]: ...

    def save(self, record: TaskRecord) -> None: ...

    def list_all(
        self,
        *,
        status: TaskStatus | None = None,
        q: str | None = None,
        batch_id: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[TaskRecord], int]: ...

    def delete(self, task_id: str) -> bool: ...


class InMemoryTaskStore:
    """线程安全的内存任务表。"""

    def __init__(self) -> None:
        self._tasks: dict[str, TaskRecord] = {}
        self._batches: dict[str, BatchRecord] = {}
        self._lock = threading.Lock()

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
        record = TaskRecord(
            id=str(uuid4()),
            status=TaskStatus.QUEUED,
            source_file=source_file,
            file_path=file_path,
            user_id=user_id,
            document_type=document_type,
            batch_id=batch_id,
            relative_path=relative_path,
        )
        with self._lock:
            self._tasks[record.id] = record
        return record

    def create_batch(
        self,
        *,
        name: str,
        user_id: str,
        total: int,
    ) -> BatchRecord:
        record = BatchRecord(
            id=str(uuid4()),
            name=name,
            user_id=user_id,
            total=total,
        )
        with self._lock:
            self._batches[record.id] = record
        return record

    def get(self, task_id: str) -> TaskRecord | None:
        with self._lock:
            return self._tasks.get(task_id)

    def get_batch(self, batch_id: str) -> BatchRecord | None:
        with self._lock:
            return self._batches.get(batch_id)

    def list_by_batch(self, batch_id: str) -> list[TaskRecord]:
        with self._lock:
            items = [t for t in self._tasks.values() if t.batch_id == batch_id]
        items.sort(key=lambda t: t.created_at)
        return items

    def save(self, record: TaskRecord) -> None:
        with self._lock:
            self._tasks[record.id] = record

    def list_all(
        self,
        *,
        status: TaskStatus | None = None,
        q: str | None = None,
        batch_id: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[TaskRecord], int]:
        with self._lock:
            items = list(self._tasks.values())
        if status is not None:
            items = [t for t in items if t.status == status]
        if batch_id is not None:
            items = [t for t in items if t.batch_id == batch_id]
        if q:
            items = [t for t in items if _match_query(t, q)]
        items.sort(key=lambda t: t.created_at, reverse=True)
        total = len(items)
        return items[offset : offset + limit], total

    def delete(self, task_id: str) -> bool:
        with self._lock:
            return self._tasks.pop(task_id, None) is not None


def _match_query(record: TaskRecord, q: str) -> bool:
    """按文件名或提取出的公司名/代码模糊匹配。"""
    needle = q.strip().lower()
    if not needle:
        return True
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
