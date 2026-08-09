"""DbTaskStore 基本读写（SQLite）。"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.schemas.task import TaskStatus
from app.db.models import Base
from app.services.db_store import DbTaskStore


def _store(tmp_path: Path) -> DbTaskStore:
    engine = create_engine(
        f"sqlite:///{tmp_path / 't.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    return DbTaskStore(session_factory=sessionmaker(bind=engine, autoflush=False))


def test_create_save_get_and_list(tmp_path: Path) -> None:
    store = _store(tmp_path)
    record = store.create(source_file="a.pdf", file_path=tmp_path / "a.pdf")
    assert record.status == TaskStatus.QUEUED

    record.parsed_markdown = "# hi"
    record.extraction = {"company_name": "茅台", "stock_code": "600519.SH"}
    record.touch(status=TaskStatus.PENDING_CONFIRM)
    store.save(record)

    loaded = store.get(record.id)
    assert loaded is not None
    assert loaded.parsed_markdown == "# hi"
    assert loaded.extraction["company_name"] == "茅台"
    assert loaded.status == TaskStatus.PENDING_CONFIRM

    items, total = store.list_all(q="茅台", offset=0, limit=10)
    assert total == 1
    assert items[0].id == record.id


def test_delete_task(tmp_path: Path) -> None:
    store = _store(tmp_path)
    pdf = tmp_path / "del.pdf"
    pdf.write_bytes(b"%PDF")
    record = store.create(source_file="del.pdf", file_path=pdf)
    assert store.delete(record.id) is True
    assert store.get(record.id) is None
    assert store.delete(record.id) is False


def test_batch_flow(tmp_path: Path) -> None:
    store = _store(tmp_path)
    batch = store.create_batch(name="folder", user_id="u1", total=2)
    t1 = store.create(
        source_file="1.pdf",
        file_path=tmp_path / "1.pdf",
        batch_id=batch.id,
    )
    store.create(
        source_file="2.pdf",
        file_path=tmp_path / "2.pdf",
        batch_id=batch.id,
    )
    got = store.get_batch(batch.id)
    assert got is not None
    assert got.name == "folder"
    assert len(store.list_by_batch(batch.id)) == 2
    assert store.get(t1.id) is not None
