"""API 请求/响应 Pydantic 模型。"""

from app.api.schemas.config import (
    GroupConfig,
    GroupsConfigResponse,
    GroupsConfigUpdate,
)
from app.api.schemas.task import (
    BatchResponse,
    BatchUploadResponse,
    TaskConfirmRequest,
    TaskConfirmResponse,
    TaskListResponse,
    TaskResultResponse,
    TaskStatus,
    TaskSummary,
    UploadResponse,
)
from app.extractor.schemas import ExtractionResult

__all__ = [
    "BatchResponse",
    "BatchUploadResponse",
    "ExtractionResult",
    "GroupConfig",
    "GroupsConfigResponse",
    "GroupsConfigUpdate",
    "TaskConfirmRequest",
    "TaskConfirmResponse",
    "TaskListResponse",
    "TaskResultResponse",
    "TaskStatus",
    "TaskSummary",
    "UploadResponse",
]
