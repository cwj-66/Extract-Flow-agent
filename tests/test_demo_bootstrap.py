"""样例引导覆盖待确认、已发送和失败可重试。"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.api.schemas.task import TaskStatus
from app.db.models import Base, SendLogRow
from app.services.db_store import DbTaskStore
from app.services.demo_bootstrap import bootstrap_demo_tasks


def test_bootstrap_sets_mixed_statuses(tmp_path: Path) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'boot.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False)
    store = DbTaskStore(session_factory=factory)

    first = bootstrap_demo_tasks(store, factory, demo_dir=tmp_path / "demo")
    again = bootstrap_demo_tasks(store, factory, demo_dir=tmp_path / "demo")
    assert len(first) == 3
    assert len(again) == 3

    by_name = {item.source_file: item.status for item in again}
    assert by_name["示例科技-2026Q1业绩点评.pdf"] == TaskStatus.SENT
    assert by_name["示例能源-2026Q1业绩点评.pdf"] == TaskStatus.PENDING_CONFIRM
    assert by_name["示例医药-2026Q1业绩点评.pdf"] == TaskStatus.FAILED

    sent = next(item for item in again if item.status == TaskStatus.SENT)
    assert sent.extraction["rating"] == "买入"
    with factory() as session:
        logs = list(session.scalars(select(SendLogRow)).all())
    assert len(logs) == 1
    assert logs[0].ai_fields["rating"] == "增持"
    assert logs[0].final_fields["rating"] == "买入"
