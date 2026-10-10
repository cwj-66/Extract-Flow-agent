"""文档处理管线编排：cleaners → extractor。"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from app.api.schemas.task import TaskStatus
from app.services.audit import log_event
from app.services.store import TaskStore

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".pdf"}


class PipelineService:
    """同步执行已有 CLI 管线，更新任务状态。"""

    def __init__(self, store: TaskStore) -> None:
        self._store = store

    def run(self, task_id: str) -> None:
        """解析 → 固定字段提取 → 写入 extraction，供确认页使用。"""
        record = self._store.get(task_id)
        if record is None:
            return

        try:
            record.touch(status=TaskStatus.PARSING)
            self._store.save(record)

            markdown = self._parse(record.file_path)
            record.parsed_markdown = markdown
            self._store.save(record)

            record.touch(status=TaskStatus.EXTRACTING)
            self._store.save(record)

            fields = self._extract(markdown)
            record.extraction = fields
            record.extracted_at = record.updated_at
            record.touch(status=TaskStatus.PENDING_CONFIRM)
            self._store.save(record)
            self._audit("fields_extracted", "字段提取完成", task_id=task_id)
            logger.info("任务 %s 提取完成", task_id)

        except Exception as exc:
            logger.exception("任务 %s 管线失败", task_id)
            stage = record.status
            record.touch(status=TaskStatus.FAILED, error=str(exc))
            self._store.save(record)
            if stage == TaskStatus.PARSING:
                self._audit("parse_failed", f"解析失败: {exc}", task_id=task_id)
            else:
                self._audit("extraction_failed", f"提取失败: {exc}", task_id=task_id)

    def _parse(self, file_path: Path) -> str:
        ext = file_path.suffix.lower()
        if ext != ".pdf":
            raise ValueError(f"不支持的文件类型: {ext}（仅支持 PDF）")
        from app.cleaners.handlers.pdf import parse_pdf

        return parse_pdf(file_path).content

    def _extract(self, markdown: str) -> dict[str, Any]:
        from app.extractor.engine import extract_document
        from app.extractor.meta import attach_meta

        bundle = extract_document(markdown)
        return attach_meta(bundle.result.model_dump(), bundle.meta.model_dump())

    def _audit(self, event_type: str, message: str, *, task_id: str) -> None:
        from app.db.session import get_session_factory

        factory = getattr(self._store, "_session_factory", None) or get_session_factory()
        log_event(
            event_type,
            message,
            task_id=task_id,
            actor="system",
            session_factory=factory,
        )
