"""已发送结果导出：未发送整批拒绝，成功时写出确认字段。"""

from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.schemas.task import TaskStatus
from app.config import settings
from app.db.models import Base, SendLogRow
from app.services.db_store import DbTaskStore
from app.services.export import ExportError, export_file, export_tasks
from app.services.store import utcnow


def _factory(tmp_path: Path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'export.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False)


def _sent(store: DbTaskStore, factory, tmp_path: Path, name: str, company: str) -> str:
    record = store.create(source_file=name, file_path=tmp_path / name)
    record.extraction = {"company_name": company}
    record.touch(status=TaskStatus.SENT, error="")
    store.save(record)
    with factory() as session:
        session.add(
            SendLogRow(
                id=str(uuid4()),
                task_id=record.id,
                group_id="g1",
                user_id="u1",
                status="sent",
                ai_fields={"company_name": company},
                final_fields={"company_name": company, "rating": "增持"},
                created_at=utcnow(),
            )
        )
        session.commit()
    return record.id


def test_export_rejects_unsent_without_writing_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    factory = _factory(tmp_path)
    export_dir = tmp_path / "exports"
    monkeypatch.setattr(settings, "EXPORT_DIR", str(export_dir))
    store = DbTaskStore(session_factory=factory)
    pending = store.create(source_file="p.pdf", file_path=tmp_path / "p.pdf")
    pending.touch(status=TaskStatus.PENDING_CONFIRM)
    store.save(pending)

    with pytest.raises(ExportError, match="尚未发送"):
        export_tasks(factory, [pending.id], "csv")
    assert not export_dir.exists() or not any(export_dir.glob("export_*.csv"))


def test_export_csv_uses_confirmed_fields(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    factory = _factory(tmp_path)
    export_dir = tmp_path / "exports"
    monkeypatch.setattr(settings, "EXPORT_DIR", str(export_dir))
    store = DbTaskStore(session_factory=factory)
    task_id = _sent(store, factory, tmp_path, "r.pdf", "示例科技")

    record = export_tasks(factory, [task_id], "csv", actor="u1")
    path, filename = export_file(factory, record.id)
    text = path.read_text(encoding="utf-8-sig")
    assert filename.endswith(".csv")
    assert "示例科技" in text
    assert "增持" in text
    assert store.get(task_id).status == TaskStatus.SENT
