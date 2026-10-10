"""样例研报播种：待确认、可重复调用、出处能对上原文。"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.schemas.task import TaskStatus
from app.db.models import Base
from app.extractor.meta import split_meta
from app.services.db_store import DbTaskStore
from app.services.demo_reports import DEMO_SCENARIOS
from app.services.demo_seed import seed_demo_tasks


def _store(tmp_path: Path) -> DbTaskStore:
    engine = create_engine(
        f"sqlite:///{tmp_path / 't.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    return DbTaskStore(session_factory=sessionmaker(bind=engine, autoflush=False))


def test_seed_creates_pending_samples_once(tmp_path: Path) -> None:
    store = _store(tmp_path)
    created = seed_demo_tasks(store, demo_dir=tmp_path / "demo")
    assert len(created) == len(DEMO_SCENARIOS)
    assert {item.status for item in created} == {TaskStatus.PENDING_CONFIRM}
    assert seed_demo_tasks(store, demo_dir=tmp_path / "demo") == []

    clean = next(item for item in created if item.source_file.startswith("示例科技"))
    loaded = store.get(clean.id)
    assert loaded is not None
    assert loaded.parsed_markdown
    assert loaded.file_path.is_file()
    _fields, meta = split_meta(loaded.extraction)
    company = next(item for item in meta["evidence"] if item["field"] == "company_name")
    assert company["start"] >= 0
    assert "示例科技" in loaded.parsed_markdown[company["start"] : company["end"]]


def test_missing_rating_has_no_false_source(tmp_path: Path) -> None:
    store = _store(tmp_path)
    created = seed_demo_tasks(store, scenario_keys=["report_missing"], demo_dir=tmp_path / "demo")
    loaded = store.get(created[0].id)
    assert loaded is not None
    assert loaded.extraction["rating"] == "无"
    _fields, meta = split_meta(loaded.extraction)
    rating = next(item for item in meta["evidence"] if item["field"] == "rating")
    assert rating["start"] == -1
