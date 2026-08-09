"""TaskService.confirm 发送飞书。"""

from __future__ import annotations

from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.api.schemas.config import GroupConfig
from app.api.schemas.task import TaskConfirmRequest, TaskStatus
from app.db.models import Base, SendLogRow
from app.extractor.schemas import ExtractionResult
from app.services.db_store import DbTaskStore
from app.services.exceptions import TaskStateError
from app.services.group_service import GroupService
from app.services.task_service import TaskService


def _session_factory(tmp_path: Path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'confirm.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False)


@pytest.fixture
def svc(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    factory = _session_factory(tmp_path)
    store = DbTaskStore(session_factory=factory)
    groups = GroupService(session_factory=factory)
    groups.replace_groups(
        [
            GroupConfig(
                id="g1",
                name="测试群",
                webhook_url="https://open.feishu.cn/open-apis/bot/v2/hook/test",
                is_default=True,
            )
        ]
    )
    queue = MagicMock()
    pipeline = MagicMock()
    service = TaskService(store, pipeline, queue, group_service=groups)

    record = store.create(source_file="r.pdf", file_path=tmp_path / "r.pdf")
    record.extraction = ExtractionResult(company_name="测试公司").model_dump()
    record.touch(status=TaskStatus.PENDING_CONFIRM)
    store.save(record)

    monkeypatch.setattr(
        "app.services.task_service.build_report_card",
        lambda fields, source_file="": MagicMock(name="card"),
    )

    class _FakeClient:
        def __init__(self, webhook: str) -> None:
            self.webhook = webhook

        def send_card(self, card: Any) -> dict[str, Any]:
            return {"code": 0, "msg": "success"}

    monkeypatch.setattr("app.services.task_service.FeishuClient", _FakeClient)
    monkeypatch.setattr(
        "app.services.task_service.get_session_factory",
        lambda: factory,
    )

    return service, store, record.id, factory


def test_confirm_sends_and_marks_sent(svc) -> None:
    service, store, task_id, factory = svc
    resp = service.confirm(
        task_id,
        TaskConfirmRequest(group_id="g1"),
        user_id="u1",
    )
    assert resp.status == TaskStatus.SENT
    assert resp.message == "sent"

    loaded = store.get(task_id)
    assert loaded is not None
    assert loaded.status == TaskStatus.SENT
    assert loaded.confirmed_group_id == "g1"

    with factory() as session:
        logs = session.scalars(select(SendLogRow)).all()
        assert len(logs) == 1
        assert logs[0].status == "sent"
        assert logs[0].user_id == "u1"


def test_confirm_failure_marks_failed(svc, monkeypatch: pytest.MonkeyPatch) -> None:
    service, store, task_id, _factory = svc

    class _BoomClient:
        def __init__(self, webhook: str) -> None:
            self.webhook = webhook

        def send_card(self, card: Any) -> dict[str, Any]:
            raise RuntimeError("webhook down")

    monkeypatch.setattr("app.services.task_service.FeishuClient", _BoomClient)

    with pytest.raises(TaskStateError, match="飞书发送失败"):
        service.confirm(task_id, TaskConfirmRequest(group_id="g1"))

    loaded = store.get(task_id)
    assert loaded is not None
    assert loaded.status == TaskStatus.FAILED
    assert "webhook down" in (loaded.error_message or "")
