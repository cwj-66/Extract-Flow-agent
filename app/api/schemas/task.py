"""任务相关 API 模型。"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

from app.extractor.schemas import ExtractionMetrics, ExtractionResult, FieldEvidence


class TaskStatus(str, Enum):
    """任务状态机（排队 → 解析 → 提取 → 待确认 → 发送 → 终态）。"""

    QUEUED = "queued"
    PARSING = "parsing"
    EXTRACTING = "extracting"
    PENDING_CONFIRM = "pending_confirm"
    SENDING = "sending"
    SENT = "sent"
    FAILED = "failed"


class TaskSummary(BaseModel):
    """任务列表项。"""

    id: str
    status: TaskStatus
    source_file: str
    document_type: str = "broker_report_review"
    batch_id: str | None = Field(default=None, description="所属批次 ID；单文件上传为 null")
    relative_path: str | None = Field(default=None, description="文件夹内相对路径")
    company_name: str | None = Field(default=None, description="提取出的公司名，便于历史检索展示")
    stock_code: str | None = Field(default=None, description="提取出的证券代码")
    created_at: datetime
    updated_at: datetime
    error_message: str | None = None


class TaskListResponse(BaseModel):
    """GET /tasks 响应。"""

    items: list[TaskSummary]
    total: int


class UploadResponse(BaseModel):
    """POST /upload 响应。"""

    task_id: str = Field(description="本次上传创建的任务 ID")
    poll_url: str = Field(description="轮询任务状态的相对路径，如 GET /tasks/{task_id}")
    message: str = "upload accepted"


class RejectedUpload(BaseModel):
    """批量上传中被拒绝的文件。"""

    filename: str
    reason: str


class BatchUploadResponse(BaseModel):
    """POST /upload/batch 响应。"""

    batch_id: str
    task_ids: list[str]
    poll_url: str = Field(description="轮询批次进度，如 GET /batches/{batch_id}")
    total: int = Field(description="请求中的文件总数")
    accepted: int = Field(description="成功入队的任务数")
    rejected: list[RejectedUpload] = Field(default_factory=list)
    message: str = "batch upload accepted"


class BatchStatusCounts(BaseModel):
    """批次内各状态任务数量。"""

    queued: int = 0
    parsing: int = 0
    extracting: int = 0
    pending_confirm: int = 0
    sending: int = 0
    sent: int = 0
    failed: int = 0


class BatchResponse(BaseModel):
    """GET /batches/{batch_id} 响应。"""

    batch_id: str
    name: str
    total: int
    created_at: datetime
    counts: BatchStatusCounts
    tasks: list[TaskSummary]


class TaskResultResponse(BaseModel):
    """GET /tasks/{id}/result 响应。"""

    task_id: str
    status: TaskStatus
    source_file: str
    fields: ExtractionResult = Field(description="固定研报提取结果")
    evidence: list[FieldEvidence] = Field(
        default_factory=list,
        description="字段在清洗 Markdown 中的出处，供工作台高亮",
    )
    metrics: ExtractionMetrics | None = Field(
        default=None,
        description="本次 LLM 提取的 token / 耗时 / 估算成本",
    )
    extracted_at: datetime | None = None


class TaskConfirmRequest(BaseModel):
    """POST /tasks/{id}/confirm 请求体。"""

    fields: ExtractionResult | None = Field(
        default=None,
        description="用户修改后的完整字段；省略则使用 AI 原始结果",
    )
    group_id: str | None = Field(default=None, description="目标飞书群 ID")


class TaskConfirmResponse(BaseModel):
    """POST /tasks/{id}/confirm 响应。"""

    task_id: str
    status: TaskStatus
    message: str = "confirm accepted"


class TaskContentResponse(BaseModel):
    """GET /tasks/{id}/content — 清洗后的结构化 Markdown（LLM 输入原文）。"""

    task_id: str
    source_file: str
    content: str = Field(description="MinerU 清洗合并后的 Markdown")
    char_count: int
