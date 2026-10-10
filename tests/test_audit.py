"""审计写入与筛选。"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.api.schemas.task import TaskStatus
from app.db.models import AuditLogRow, Base
from app.services.audit import list_events, log_event
from app.services.db_store import DbTaskStore
from app.services.pipeline_service import PipelineService


def _factory(tmp_path: Path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'audit.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False)


def test_list_filters_by_task_and_search(tmp_path: Path) -> None:
    factory = _factory(tmp_path)
    log_event("task_uploaded", "已上传 a.pdf", task_id="t1", actor="u1", session_factory=factory)
    log_event("fields_extracted", "字段提取完成", task_id="t1", actor="system", session_factory=factory)
    log_event("task_uploaded", "已上传 b.pdf", task_id="t2", actor="u1", session_factory=factory)

    rows, total = list_events(factory, task_id="t1", search="提取")
    assert total == 1
    assert rows[0].event_type == "fields_extracted"

    uploaded, uploaded_total = list_events(factory, event_type="task_uploaded", actor="u1")
    assert uploaded_total == 2
    assert {row.task_id for row in uploaded} == {"t1", "t2"}


def test_pipeline_records_extract_and_parse_failure(tmp_path: Path) -> None:
    factory = _factory(tmp_path)
    store = DbTaskStore(session_factory=factory)
    pipeline = PipelineService(store)

    ok = store.create(source_file="ok.pdf", file_path=tmp_path / "ok.pdf")
    pipeline._parse = lambda _path: "# 正文"  # type: ignore[method-assign]
    pipeline._extract = lambda _md: {"company_name": "甲"}  # type: ignore[method-assign]
    pipeline.run(ok.id)

    bad = store.create(source_file="bad.pdf", file_path=tmp_path / "bad.pdf")

    def _boom(_path: Path) -> str:
        raise RuntimeError("无法解析")

    pipeline._parse = _boom  # type: ignore[method-assign]
    pipeline.run(bad.id)

    with factory() as session:
        events = list(session.scalars(select(AuditLogRow).order_by(AuditLogRow.created_at.asc())).all())
    kinds = [(event.task_id, event.event_type) for event in events]
    assert (ok.id, "fields_extracted") in kinds
    assert (bad.id, "parse_failed") in kinds
    assert store.get(bad.id).status == TaskStatus.FAILED
