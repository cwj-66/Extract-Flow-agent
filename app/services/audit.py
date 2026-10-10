# graft: github.com/SAHARIARSHOWMIK/ai-document-processing-automation@ddb4085:app/services/audit.py — do not edit, re-sync via code-graft
# License: MIT. Copyright (c) 2026 Your Name.
"""追加审计。上游按文档 ID 记事件；这里按研报任务 ID 记，失败不影响主流程。"""

from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

from sqlalchemy import func, or_, select

from app.db.models import AuditLogRow
from app.db.session import get_session_factory
from app.services.store import utcnow

logger = logging.getLogger(__name__)


def log_event(
    event_type: str,
    message: str,
    *,
    task_id: str | None = None,
    details: dict[str, Any] | None = None,
    actor: str = "system",
    session_factory=None,
) -> None:
    """写入一条审计。数据库不可用时只记日志。"""
    maker = session_factory if session_factory is not None else get_session_factory()
    try:
        with maker() as session:
            session.add(
                AuditLogRow(
                    id=str(uuid4()),
                    task_id=task_id,
                    event_type=event_type,
                    message=message,
                    details=details,
                    actor=actor or "system",
                    created_at=utcnow(),
                )
            )
            session.commit()
    except Exception:
        logger.exception("写入审计失败（event=%s task=%s）", event_type, task_id)


def list_events(
    session_factory,
    *,
    task_id: str | None = None,
    event_type: str | None = None,
    actor: str | None = None,
    search: str | None = None,
    limit: int = 200,
    offset: int = 0,
) -> tuple[list[AuditLogRow], int]:
    """按任务、事件类型、操作者和关键字筛选，新的在前。"""
    with session_factory() as session:
        stmt = select(AuditLogRow)
        if task_id:
            stmt = stmt.where(AuditLogRow.task_id == task_id)
        if event_type:
            stmt = stmt.where(AuditLogRow.event_type == event_type)
        if actor:
            stmt = stmt.where(AuditLogRow.actor == actor)
        if search and search.strip():
            term = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(AuditLogRow.message).like(term),
                    func.lower(AuditLogRow.event_type).like(term),
                    func.lower(AuditLogRow.actor).like(term),
                )
            )
        total = session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        rows = session.scalars(
            stmt.order_by(AuditLogRow.created_at.desc()).offset(offset).limit(limit)
        ).all()
        return list(rows), int(total)
