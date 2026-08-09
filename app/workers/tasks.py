"""Celery 任务：管线执行 + 并发演示。"""

from __future__ import annotations

import os
import time
from typing import Any

from app.celery_app import celery_app


@celery_app.task(name="pipeline.run", bind=True)
def run_pipeline_task(self, task_id: str) -> dict[str, Any]:
    """执行解析+提取管线（与进程内 TaskQueue 同一条业务路径）。"""
    from app.services.db_store import DbTaskStore
    from app.services.pipeline_service import PipelineService

    store = DbTaskStore()
    PipelineService(store).run(task_id)
    return {"task_id": task_id, "worker_pid": os.getpid()}


@celery_app.task(name="demo.sleep")
def demo_sleep(seconds: float, label: str) -> dict[str, Any]:
    """轻量演示任务：睡一会并回报 worker pid，用于验证 Redis 并发。"""
    started = time.perf_counter()
    time.sleep(seconds)
    return {
        "label": label,
        "seconds": seconds,
        "worker_pid": os.getpid(),
        "elapsed": round(time.perf_counter() - started, 3),
    }
