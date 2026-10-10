"""有界任务队列：限制同时执行的管线数量。"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from app.services.exceptions import QueueCapacityError

from app.services.pipeline_service import PipelineService

logger = logging.getLogger(__name__)


class TaskQueue:
    """进程内 asyncio 队列 + 固定数量 worker。"""

    def __init__(
        self,
        pipeline: PipelineService,
        *,
        max_workers: int = 3,
        max_pending: int = 10,
    ) -> None:
        if max_workers < 0:
            raise ValueError("max_workers must be >= 0")
        if max_pending < 0 or max_workers + max_pending < 1:
            raise ValueError("queue capacity must be positive")
        self._pipeline = pipeline
        self._max_workers = max_workers
        self._capacity = max_workers + max_pending
        self._admitted = 0
        self._closing = False
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
        self._closing = False
        for i in range(self._max_workers):
            task = asyncio.create_task(self._worker_loop(i), name=f"pipeline-worker-{i}")
            self._workers.append(task)
        logger.info("TaskQueue 已启动，并发=%d", self._max_workers)

    async def stop(self) -> None:
        """停止接收任务，等待正在执行的同步管线结束后回收名额。"""
        self._closing = True
        for worker in self._workers:
            worker.cancel()
        if self._workers:
            await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers.clear()
        self._started = False

    async def enqueue(self, task_id: str) -> None:
        """直接调用也必须先取得容量名额。"""
        async with self.reserve(1) as admission:
            await admission.enqueue(task_id)

    @asynccontextmanager
    async def reserve(self, count: int):
        """单事件循环内无 await 地原子预留整批容量，失败立即拒绝。"""
        if count < 1:
            raise ValueError("count must be positive")
        if self._closing or self._admitted + count > self._capacity:
            raise QueueCapacityError(f"处理队列繁忙，剩余容量 {max(0, self._capacity - self._admitted)} 份，请稍后重试")
        self._admitted += count
        admission = _Admission(self, count)
        try:
            yield admission
        finally:
            self._admitted -= admission.remaining
            admission.remaining = 0

    async def _worker_loop(self, worker_id: int) -> None:
        while True:
            task_id = await self._queue.get()
            try:
                logger.info("worker-%d 开始处理任务 %s", worker_id, task_id)
                execution = asyncio.create_task(asyncio.to_thread(self._pipeline.run, task_id))
                try:
                    # 取消协程不会停止同步线程，必须等实际执行结束再释放名额。
                    await asyncio.shield(execution)
                except asyncio.CancelledError:
                    await asyncio.gather(execution, return_exceptions=True)
                    raise
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("worker-%d 处理任务 %s 异常", worker_id, task_id)
            finally:
                self._admitted -= 1
                self._queue.task_done()


class _Admission:
    """一次上传预留的容量；入队后将名额所有权转交给 worker。"""

    def __init__(self, queue: TaskQueue, count: int) -> None:
        self.queue = queue
        self.remaining = count

    async def enqueue(self, task_id: str) -> None:
        if self.remaining < 1:
            raise RuntimeError("no reserved capacity")
        if self.queue._closing:
            raise QueueCapacityError("服务正在关闭，请稍后重试")
        self.queue._queue.put_nowait(task_id)
        self.remaining -= 1
