"""有界任务队列：限制同时执行的管线数量。"""

from __future__ import annotations

import asyncio
import logging

from app.services.pipeline_service import PipelineService

logger = logging.getLogger(__name__)


class TaskQueue:
    """进程内 asyncio 队列 + 固定数量 worker。"""

    def __init__(
        self,
        pipeline: PipelineService,
        *,
        max_workers: int = 3,
    ) -> None:
        if max_workers < 0:
            raise ValueError("max_workers must be >= 0")
        self._pipeline = pipeline
        self._max_workers = max_workers
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._workers: list[asyncio.Task[None]] = []
        self._started = False

    @property
    def max_workers(self) -> int:
        return self._max_workers

    def start(self) -> None:
        """启动 worker（可在 FastAPI lifespan 中调用；幂等）。"""
        if self._started:
            return
        self._started = True
        for i in range(self._max_workers):
            task = asyncio.create_task(self._worker_loop(i), name=f"pipeline-worker-{i}")
            self._workers.append(task)
        logger.info("TaskQueue 已启动，并发=%d", self._max_workers)

    async def stop(self) -> None:
        """取消所有 worker（应用关闭时调用）。"""
        for worker in self._workers:
            worker.cancel()
        if self._workers:
            await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers.clear()
        self._started = False

    async def enqueue(self, task_id: str) -> None:
        """将任务 ID 放入队列；worker 取出后执行管线。"""
        await self._queue.put(task_id)
        logger.debug("任务 %s 已入队（队列长度≈%d）", task_id, self._queue.qsize())

    async def _worker_loop(self, worker_id: int) -> None:
        while True:
            task_id = await self._queue.get()
            try:
                logger.info("worker-%d 开始处理任务 %s", worker_id, task_id)
                await asyncio.to_thread(self._pipeline.run, task_id)
            except asyncio.CancelledError:
                self._queue.task_done()
                raise
            except Exception:
                logger.exception("worker-%d 处理任务 %s 异常", worker_id, task_id)
            finally:
                self._queue.task_done()
