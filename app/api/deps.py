"""FastAPI 共享依赖。"""

from __future__ import annotations

from pathlib import Path
from typing import Annotated, Any
from urllib.parse import unquote

from fastapi import Depends, Header

from app.config import settings
from app.services.db_store import DbTaskStore
from app.services.group_service import GroupService
from app.services.pipeline_service import PipelineService
from app.services.task_queue import TaskQueue
from app.services.task_service import TaskService

Path("data").mkdir(parents=True, exist_ok=True)

_store = DbTaskStore()
_pipeline = PipelineService(_store)

if settings.USE_CELERY:
    from app.services.celery_queue import CeleryTaskQueue

    _task_queue: Any = CeleryTaskQueue(max_workers=settings.PIPELINE_CONCURRENCY)
else:
    _task_queue = TaskQueue(_pipeline, max_workers=settings.PIPELINE_CONCURRENCY)

_group_service = GroupService()
_task_service = TaskService(_store, _pipeline, _task_queue, group_service=_group_service)


def get_task_service() -> TaskService:
    return _task_service


def get_task_queue() -> Any:
    return _task_queue


def get_group_service() -> GroupService:
    return _group_service


def get_user_id(
    x_user_id: Annotated[str | None, Header(alias="X-User-Id")] = None,
) -> str:
    """过渡身份：请求头 X-User-Id（前端对非 ASCII 做 URL 编码）；缺省为 anonymous。"""
    raw = (x_user_id or "").strip()
    if not raw:
        return "anonymous"
    uid = unquote(raw)
    return uid or "anonymous"


TaskServiceDep = Annotated[TaskService, Depends(get_task_service)]
GroupServiceDep = Annotated[GroupService, Depends(get_group_service)]
UserIdDep = Annotated[str, Depends(get_user_id)]
