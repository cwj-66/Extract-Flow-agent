"""get_result 返回 evidence / metrics。"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.schemas.task import TaskStatus
from app.db.models import Base
from app.extractor.meta import attach_meta
from app.extractor.schemas import ExtractionResult
from app.services.db_store import DbTaskStore
from app.services.task_service import TaskService


def test_get_result_exposes_evidence_and_metrics(tmp_path: Path) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'r.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    store = DbTaskStore(session_factory=sessionmaker(bind=engine, autoflush=False))
    service = TaskService(store, MagicMock(), MagicMock())

    record = store.create(source_file="a.pdf", file_path=tmp_path / "a.pdf")
    record.extraction = attach_meta(
        ExtractionResult(company_name="茅台", stock_code="600519.SH").model_dump(),
        {
            "evidence": [
                {
                    "field": "company_name",
                    "quote": "茅台",
                    "start": 2,
                    "end": 4,
                    "confidence": 1.0,
                }
            ],
            "metrics": {
                "model": "qwen3.7-plus",
                "prompt_tokens": 1000,
                "completion_tokens": 200,
                "total_tokens": 1200,
                "elapsed_ms": 1500,
                "estimated_cny": 0.0032,
                "retries": 0,
            },
        },
    )
    record.touch(status=TaskStatus.PENDING_CONFIRM)
    store.save(record)

    result = service.get_result(record.id)
    assert result.fields.company_name == "茅台"
    assert result.evidence[0].field == "company_name"
    assert result.evidence[0].start == 2
    assert result.metrics is not None
    assert result.metrics.total_tokens == 1200
    assert result.metrics.estimated_cny == 0.0032
