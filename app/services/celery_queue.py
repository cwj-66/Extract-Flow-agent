"""基于 Celery + Redis 的任务入队（与 TaskQueue 同接口）。"""

from __future__ import annotations

import logging

from app.config import settings

logger = logging.getLogger(__name__)


class CeleryTaskQueue:
    """入队到 Redis；真正执行在独立 celery worker 进程。"""

    def __init__(self, *, max_workers: int | None = None) -> None:
        self._max_workers = max_workers if max_workers is not None else settings.PIPELINE_CONCURRENCY

    @property
    def max_workers(self) -> int:
        return self._max_workers

    def start(self) -> None:
        logger.info(
            "CeleryTaskQueue 已启用（USE_CELERY=true），请另开 worker；期望并发≈%d",
            self._max_workers,
        )

    async def stop(self) -> None:
        return None

    async def enqueue(self, task_id: str) -> None:
        from app.workers.tasks import run_pipeline_task

        async_result = run_pipeline_task.delay(task_id)
        logger.info("任务 %s 已投递 Celery（id=%s）", task_id, async_result.id)
