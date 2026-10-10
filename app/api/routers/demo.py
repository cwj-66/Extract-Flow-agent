"""样例研报播种。"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import TaskServiceDep
from app.api.schemas.task import TaskSummary

router = APIRouter()


@router.post("/demo/seed", response_model=list[TaskSummary])
def seed_demo(service: TaskServiceDep) -> list[TaskSummary]:
    """写入预计算样例。已存在的文件名会跳过。"""
    return service.seed_demo()
