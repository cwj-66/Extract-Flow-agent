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


@router.post("/demo/bootstrap", response_model=list[TaskSummary])
def bootstrap_demo(service: TaskServiceDep) -> list[TaskSummary]:
    """载入样例，并放到待确认、已发送、失败可重试。"""
    return service.bootstrap_demo()
