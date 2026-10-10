"""云端解析接口联调：真实 HTTP 路由、SQLite 和解析管线，外部模型用模拟响应。"""

import io
import zipfile
from dataclasses import replace
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.deps import get_task_service
from app.api.routers import tasks, upload
from app.cleaners.handlers import mineru_cloud
from app.config import settings
from app.db.models import Base
from app.extractor.schemas import ExtractionResult
from app.services.db_store import DbTaskStore
from app.services.pipeline_service import PipelineService
from app.services.task_service import TaskService


@pytest.mark.parametrize("cloud_failed", [False, True])
def test_upload_through_cloud_to_task_result(tmp_path, monkeypatch, cloud_failed):
    engine = create_engine(f"sqlite:///{tmp_path / 'cloud.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    store = DbTaskStore(session_factory=sessionmaker(bind=engine, autoflush=False))
    pipeline = PipelineService(store)
    queue = MagicMock()
    queue.enqueue = AsyncMock()
    service = TaskService(store, pipeline, queue, group_service=MagicMock(), upload_dir=tmp_path / "uploads")
    app = FastAPI()
    app.include_router(upload.router)
    app.include_router(tasks.router)
    app.dependency_overrides[get_task_service] = lambda: service
    monkeypatch.setattr(settings, "MINERU_MODE", "cloud")
    monkeypatch.setattr(settings, "DECOMPOSER_ENABLED", False)
    markdown = "# 测试公司\n证券代码：600000.SH\n研报正文"
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("full.md", markdown)

    def handler(request):
        if request.method == "POST":
            return httpx.Response(200, json={"code": 0, "data": {
                "batch_id": "test-batch", "file_urls": ["https://storage.test/upload"]}})
        if request.method == "PUT":
            assert request.content.startswith(b"%PDF")
            return httpx.Response(200)
        if request.url.host == "mineru.net":
            return httpx.Response(200, json={"code": 0, "data": {"extract_result": [{
                "state": "failed" if cloud_failed else "done", "err_msg": "文件页数超过限制",
                "full_zip_url": "https://storage.test/result"}]}})
        return httpx.Response(200, content=buffer.getvalue())

    client = mineru_cloud.MinerUCloudClient(replace(settings, MINERU_API_TOKEN="test"),
                                          transport=httpx.MockTransport(handler))
    monkeypatch.setattr(mineru_cloud, "MinerUCloudClient", lambda: client)
    extraction = MagicMock(return_value=ExtractionResult(company_name="测试公司", stock_code="600000.SH").model_dump())
    monkeypatch.setattr(pipeline, "_extract", extraction)
    with TestClient(app) as api:
        response = api.post("/upload", files={"file": ("研报.pdf", b"%PDF-1.7\nmock", "application/pdf")})
        assert response.status_code == 200
        task_id = response.json()["task_id"]
        assert api.get(response.json()["poll_url"]).json()["status"] == "queued"
        queue.enqueue.assert_awaited_once_with(task_id)
        pipeline.run(task_id)
        summary = api.get(f"/tasks/{task_id}").json()
        if cloud_failed:
            assert summary["status"] == "failed"
            assert "页数超过限制" in summary["error_message"]
            extraction.assert_not_called()
            assert api.get(f"/tasks/{task_id}/result").status_code == 409
        else:
            assert summary["status"] == "pending_confirm"
            extraction.assert_called_once_with(markdown)
            assert api.get(f"/tasks/{task_id}/content").json()["content"] == markdown
            result = api.get(f"/tasks/{task_id}/result")
            assert result.status_code == 200
            assert result.json()["fields"]["company_name"] == "测试公司"
            assert api.get(f"/tasks/{task_id}/file").content.startswith(b"%PDF")
            assert api.get("/tasks?q=测试公司").json()["total"] == 1
    engine.dispose()
