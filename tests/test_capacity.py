"""验证队列容量、整批拒绝、失败回收以及同步管线退出行为。"""

import asyncio
import io
import threading
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI, UploadFile
from fastapi.testclient import TestClient

from app.api.deps import get_task_service
from app.api.routers import upload
from app.services.exceptions import QueueCapacityError
from app.services.store import InMemoryTaskStore
from app.services.task_queue import TaskQueue
from app.services.task_service import TaskService


def test_atomic_capacity_and_reservation_release():
    async def scenario():
        queue = TaskQueue(MagicMock(), max_workers=0, max_pending=2)
        async with queue.reserve(2):
            with pytest.raises(QueueCapacityError):
                await queue.enqueue("overflow")
        async with queue.reserve(2) as admission:
            await admission.enqueue("one")
        assert queue._admitted == 1
        with pytest.raises(QueueCapacityError):
            async with queue.reserve(2):
                pass
        await queue.enqueue("two")
        assert queue._queue.qsize() == 2
    asyncio.run(scenario())


def test_full_queue_rejects_before_persistence(tmp_path):
    store = InMemoryTaskStore()
    queue = TaskQueue(MagicMock(), max_workers=0, max_pending=1)
    service = TaskService(store, MagicMock(), queue, upload_dir=tmp_path / "uploads")
    app = FastAPI()
    app.include_router(upload.router)
    app.dependency_overrides[get_task_service] = lambda: service
    with TestClient(app) as api:
        response = api.post("/upload/batch", files=[
            ("files", ("one.pdf", b"pdf", "application/pdf")),
            ("files", ("two.pdf", b"pdf", "application/pdf")),
        ])
        assert response.status_code == 503
        assert response.headers["retry-after"] == "30"
        assert not store._batches
        assert store.list_all()[1] == 0
        assert not service._upload_dir.exists()
        assert api.post("/upload", files={"file": ("one.pdf", b"pdf")}).status_code == 200
        assert api.post("/upload", files={"file": ("two.pdf", b"pdf")}).status_code == 503
        assert store.list_all()[1] == 1
        assert len(list(service._upload_dir.iterdir())) == 1


def test_upload_failure_releases_capacity_and_files(tmp_path):
    async def scenario():
        store = InMemoryTaskStore()
        queue = TaskQueue(MagicMock(), max_workers=0, max_pending=1)
        service = TaskService(store, MagicMock(), queue, upload_dir=tmp_path)
        service._audit = MagicMock()
        broken = UploadFile(filename="broken.pdf", file=io.BytesIO(b"pdf"))
        await broken.close()
        with pytest.raises(ValueError):
            await service.create_from_upload(broken)
        assert queue._admitted == 0
        assert store.list_all()[1] == 0
        assert not list(tmp_path.iterdir())
        good = UploadFile(filename="good.pdf", file=io.BytesIO(b"pdf"))
        await service.create_from_upload(good)
        assert queue._admitted == 1
    asyncio.run(scenario())


def test_fifo_and_shutdown_waits_for_running_thread():
    async def scenario():
        started = threading.Event()
        release = threading.Event()
        calls = []

        def run(task_id):
            calls.append(task_id)
            if task_id == "first":
                started.set()
                assert release.wait(timeout=3)
            if task_id == "second":
                raise RuntimeError("pipeline failed")

        queue = TaskQueue(MagicMock(run=run), max_workers=1, max_pending=2)
        queue.start()
        try:
            await queue.enqueue("first")
            await queue.enqueue("second")
            assert await asyncio.to_thread(started.wait, 2)
            stop = asyncio.create_task(queue.stop())
            await asyncio.sleep(0.02)
            assert not stop.done()
            assert queue._admitted == 2
            release.set()
            await asyncio.wait_for(stop, 2)
            assert queue._admitted == 1
            queue.start()
            await asyncio.wait_for(queue._queue.join(), 2)
            assert calls == ["first", "second"]
            assert queue._admitted == 0
        finally:
            release.set()
            await queue.stop()
    asyncio.run(scenario())
