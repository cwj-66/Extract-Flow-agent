"""总览统计：状态、校验、费用和人工修改比例。"""

from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.schemas.task import TaskStatus
from app.db.models import Base, SendLogRow
from app.extractor.meta import attach_meta
from app.services.dashboard import build_overview
from app.services.db_store import DbTaskStore
from app.services.demo_seed import seed_demo_tasks
from app.services.store import utcnow


def _factory(tmp_path: Path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'dash.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False)


def test_overview_counts_validation_cost_and_edits(tmp_path: Path) -> None:
    factory = _factory(tmp_path)
    store = DbTaskStore(session_factory=factory)
    created = seed_demo_tasks(store, demo_dir=tmp_path / "demo")
    sent = next(item for item in created if item.source_file.startswith("示例科技"))
    fields = dict(sent.extraction)
    meta = fields.pop("_meta")
    meta["metrics"] = {"model": "demo", "elapsed_ms": 2000, "estimated_cny": 0.05}
    ai_fields = dict(fields)
    final_fields = dict(fields)
    final_fields["rating"] = "买入"
    sent.extraction = attach_meta(final_fields, meta)
    sent.touch(status=TaskStatus.SENT, error="")
    store.save(sent)

    with factory() as session:
        session.add(
            SendLogRow(
                id=str(uuid4()),
                task_id=sent.id,
                group_id="g1",
                user_id="u1",
                status="sent",
                ai_fields=ai_fields,
                final_fields=final_fields,
                created_at=utcnow(),
            )
        )
        session.commit()

    overview = build_overview(factory)
    assert overview.total == 3
    assert overview.pending_confirm == 2
    assert overview.sent == 1
    assert overview.validation["valid"] >= 1
    assert overview.validation["warning"] >= 1
    assert overview.validation["failed"] == 0
    assert overview.avg_elapsed_ms == 2000
    assert overview.total_estimated_cny == 0.05
    assert overview.edit_rate == 1.0
    assert overview.review_queue
