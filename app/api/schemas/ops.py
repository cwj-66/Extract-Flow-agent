"""审计、总览与导出的 API 模型。"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.api.schemas.task import TaskSummary


class AuditEvent(BaseModel):
    id: str
    task_id: str | None = None
    event_type: str
    message: str
    details: dict | None = None
    actor: str
    created_at: datetime


class AuditListResponse(BaseModel):
    items: list[AuditEvent]
    total: int


class DashboardOverview(BaseModel):
    total: int
    pending_confirm: int
    processing: int
    sent: int
    failed: int
    by_status: dict[str, int]
    validation: dict[str, int]
    avg_elapsed_ms: int | None = None
    total_estimated_cny: float = 0.0
    edited_send_count: int = 0
    sent_with_log_count: int = 0
    edit_rate: float | None = None
    review_queue: list[TaskSummary]
    recent_tasks: list[TaskSummary]
    recent_events: list[AuditEvent]


class ExportRequest(BaseModel):
    task_ids: list[str] = Field(min_length=1)


class ExportRecord(BaseModel):
    id: str
    export_type: str
    task_count: int
    created_at: datetime
    download_url: str
