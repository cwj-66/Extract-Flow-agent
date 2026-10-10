"""任务业务：上传、查询、确认 — router 只调这一层。"""

from __future__ import annotations

import logging
from copy import deepcopy
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import UploadFile

from app.api.schemas.task import (
    BatchResponse,
    BatchStatusCounts,
    BatchUploadResponse,
    RejectedUpload,
    TaskConfirmRequest,
    TaskConfirmResponse,
    TaskContentResponse,
    TaskListResponse,
    TaskResultResponse,
    TaskStatus,
    TaskSummary,
    UploadResponse,
)
from app.db.models import SendLogRow
from app.db.session import get_session_factory
from app.extractor.meta import attach_meta, split_meta
from app.extractor.schemas import ExtractionMeta, ExtractionResult
from app.extractor.validation import check_report
from app.feishu.card_builder import build_report_card
from app.feishu.client import FeishuClient
from app.services.audit import log_event
from app.services.exceptions import (
    BatchNotFoundError,
    TaskNotFoundError,
    TaskStateError,
    UploadValidationError,
)
from app.services.group_service import GroupService
from app.services.pipeline_service import ALLOWED_EXTENSIONS, PipelineService
from app.services.store import TaskRecord, TaskStore, utcnow
from app.services.task_queue import TaskQueue

logger = logging.getLogger(__name__)

DEFAULT_UPLOAD_DIR = Path("data/uploads")
MAX_BATCH_FILES = 100
_CONFIRMABLE = frozenset({TaskStatus.PENDING_CONFIRM, TaskStatus.FAILED})


class TaskService:
    def __init__(
        self,
        store: TaskStore,
        pipeline: PipelineService,
        queue,  # TaskQueue | CeleryTaskQueue：均提供 enqueue/start/stop
        group_service: GroupService | None = None,
        upload_dir: Path | None = None,
    ) -> None:
        self._store = store
        self._pipeline = pipeline
        self._queue = queue
        self._groups = group_service or GroupService()
        self._upload_dir = upload_dir or DEFAULT_UPLOAD_DIR

    async def create_from_upload(
        self,
        upload: UploadFile,
        *,
        user_id: str = "anonymous",
        document_type: str = "broker_report_review",
    ) -> UploadResponse:
        ext = Path((upload.filename or "unnamed").replace("\\", "/")).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise UploadValidationError(f"不支持的文件类型: {ext}（仅支持 PDF）")
        async with self._reserve_uploads(1) as admission:
            self._upload_dir.mkdir(parents=True, exist_ok=True)
            task_id = await self._save_and_enqueue(
                upload, user_id=user_id, document_type=document_type, admission=admission,
            )
        return UploadResponse(
            task_id=task_id,
            poll_url=f"/tasks/{task_id}",
        )

    async def create_from_batch(
        self,
        uploads: list[UploadFile],
        *,
        user_id: str = "anonymous",
        document_type: str = "broker_report_review",
        batch_name: str | None = None,
    ) -> BatchUploadResponse:
        """批量上传并入队。"""
        if not uploads:
            raise UploadValidationError("至少上传一个文件")
        if len(uploads) > MAX_BATCH_FILES:
            raise UploadValidationError(f"单次最多上传 {MAX_BATCH_FILES} 个文件")

        accepted_files: list[UploadFile] = []
        rejected: list[RejectedUpload] = []
        for upload in uploads:
            filename = upload.filename or "unnamed"
            ext = Path(filename).suffix.lower()
            if "/" in filename or "\\" in filename:
                ext = Path(filename.replace("\\", "/")).suffix.lower()
            if ext not in ALLOWED_EXTENSIONS:
                rejected.append(
                    RejectedUpload(filename=filename, reason=f"不支持的文件类型: {ext or '(无扩展名)'}")
                )
            else:
                accepted_files.append(upload)

        if not accepted_files:
            raise UploadValidationError("没有可接受的文件（仅支持 PDF）")

        # 先为整批预留名额，容量不足时不创建批次、任务或文件。
        async with self._reserve_uploads(len(accepted_files)) as admission:
            self._upload_dir.mkdir(parents=True, exist_ok=True)
            name = (batch_name or "").strip() or _default_batch_name(accepted_files)
            batch = self._store.create_batch(
                name=name, user_id=user_id, total=len(accepted_files),
            )
            task_ids: list[str] = []
            for upload in accepted_files:
                task_id = await self._save_and_enqueue(
                    upload, user_id=user_id, document_type=document_type,
                    batch_id=batch.id, admission=admission,
                )
                task_ids.append(task_id)

        return BatchUploadResponse(
            batch_id=batch.id,
            task_ids=task_ids,
            poll_url=f"/batches/{batch.id}",
            total=len(uploads),
            accepted=len(task_ids),
            rejected=rejected,
        )

    def seed_demo(self) -> list[TaskSummary]:
        """写入预计算样例任务，不入解析队列。"""
        from app.services.demo_seed import seed_demo_tasks

        created = seed_demo_tasks(self._store)
        for record in created:
            self._audit(
                "demo_seeded",
                f"已载入样例 {record.source_file}",
                task_id=record.id,
                actor="system",
            )
        return [self._to_summary(record) for record in created]

    def bootstrap_demo(self) -> list[TaskSummary]:
        """载入样例并放到待确认、已发送、失败可重试等状态。"""
        from app.services.demo_bootstrap import bootstrap_demo_tasks

        records = bootstrap_demo_tasks(self._store, session_factory=get_session_factory())
        return [self._to_summary(record) for record in records]

    def get_batch(self, batch_id: str) -> BatchResponse:
        batch = self._store.get_batch(batch_id)
        if batch is None:
            raise BatchNotFoundError(batch_id)

        records = self._store.list_by_batch(batch_id)
        counts = BatchStatusCounts()
        for record in records:
            attr = record.status.value
            setattr(counts, attr, getattr(counts, attr) + 1)

        return BatchResponse(
            batch_id=batch.id,
            name=batch.name,
            total=batch.total,
            created_at=batch.created_at,
            counts=counts,
            tasks=[self._to_summary(r) for r in records],
        )

    async def list_tasks(
        self,
        *,
        status: TaskStatus | None,
        q: str | None,
        offset: int,
        limit: int,
        batch_id: str | None = None,
    ) -> TaskListResponse:
        records, total = self._store.list_all(
            status=status, q=q, offset=offset, limit=limit, batch_id=batch_id
        )
        return TaskListResponse(
            items=[self._to_summary(r) for r in records],
            total=total,
        )

    def get_task(self, task_id: str) -> TaskSummary:
        record = self._require(task_id)
        return self._to_summary(record)

    def delete_task(self, task_id: str) -> None:
        """删除任务记录及本地上传文件。"""
        record = self._require(task_id)
        path = record.file_path
        if not self._store.delete(task_id):
            raise TaskNotFoundError(task_id)
        if path and path.exists() and path.is_file():
            try:
                path.unlink()
            except OSError:
                logger.warning("删除任务文件失败: %s", path)

    def get_result(self, task_id: str) -> TaskResultResponse:
        record = self._require(task_id)
        if record.extraction is None:
            raise TaskStateError(task_id, "提取结果尚未就绪")
        fields_dict, meta_dict = split_meta(record.extraction)
        meta = ExtractionMeta.model_validate(meta_dict) if meta_dict else ExtractionMeta()
        fields = ExtractionResult.model_validate(fields_dict)
        validation_status, issues = check_report(fields, record.parsed_markdown or "")
        return TaskResultResponse(
            task_id=record.id,
            status=record.status,
            source_file=record.source_file,
            fields=fields,
            evidence=meta.evidence,
            metrics=meta.metrics,
            validation_status=validation_status,
            issues=issues,
            extracted_at=record.extracted_at,
        )

    def get_content(self, task_id: str) -> TaskContentResponse:
        """返回清洗后的 Markdown（管线产出，即 LLM 所读的「原文」）。"""
        record = self._require(task_id)
        if not record.parsed_markdown:
            raise TaskStateError(task_id, "解析内容尚未就绪")
        return TaskContentResponse(
            task_id=record.id,
            source_file=record.source_file,
            content=record.parsed_markdown,
            char_count=len(record.parsed_markdown),
        )

    def get_original_file(self, task_id: str) -> tuple[Path, str]:
        """返回上传的原始文件路径与下载文件名。"""
        record = self._require(task_id)
        if not record.file_path or not record.file_path.is_file():
            raise TaskStateError(task_id, "原始文件不存在")
        return record.file_path, record.source_file

    def confirm(
        self,
        task_id: str,
        body: TaskConfirmRequest,
        *,
        user_id: str = "anonymous",
    ) -> TaskConfirmResponse:
        record = self._require(task_id)

        if record.status not in _CONFIRMABLE:
            raise TaskStateError(
                task_id,
                f"当前状态 {record.status.value} 不可确认，需为 pending_confirm 或 failed",
            )
        if record.extraction is None:
            raise TaskStateError(task_id, "缺少提取结果，无法确认发送")

        fields_dict, meta_dict = split_meta(record.extraction)
        ai_fields = deepcopy(fields_dict)
        if body.fields is not None:
            record.extraction = attach_meta(body.fields.model_dump(), meta_dict)
        final_fields, _ = split_meta(record.extraction)
        final_fields = deepcopy(final_fields)
        if final_fields != ai_fields:
            self._audit(
                "field_edited",
                "确认前修改了提取字段",
                task_id=task_id,
                actor=user_id,
                details={"changed": _changed_keys(ai_fields, final_fields)},
            )

        group_id = (body.group_id or "").strip()
        resolved = self._resolve_group(group_id)
        if resolved is None or not resolved.webhook_url.strip():
            raise TaskStateError(
                task_id,
                "未配置飞书 Webhook：请先在「飞书通知」中添加并保存",
            )
        webhook = resolved.webhook_url.strip()
        resolved_group_id = resolved.id

        record.confirmed_group_id = resolved_group_id
        record.touch(status=TaskStatus.SENDING, error="")
        self._store.save(record)

        try:
            card = build_report_card(final_fields, source_file=record.source_file)
            resp = FeishuClient(webhook).send_card(card)
            if resp.get("code") not in (0, None):
                raise RuntimeError(f"飞书 API 返回错误: {resp}")
        except Exception as exc:
            err = str(exc)
            record.touch(status=TaskStatus.FAILED, error=err)
            self._store.save(record)
            self._write_send_log(
                task_id=task_id,
                group_id=resolved_group_id,
                user_id=user_id,
                status="failed",
                ai_fields=ai_fields,
                final_fields=final_fields,
                error_message=err,
            )
            self._audit(
                "send_failed",
                f"飞书发送失败: {err}",
                task_id=task_id,
                actor=user_id,
            )
            logger.exception("任务 %s 飞书发送失败", task_id)
            raise TaskStateError(task_id, f"飞书发送失败: {err}") from exc

        record.touch(status=TaskStatus.SENT, error="")
        self._store.save(record)
        self._write_send_log(
            task_id=task_id,
            group_id=resolved_group_id,
            user_id=user_id,
            status="sent",
            ai_fields=ai_fields,
            final_fields=final_fields,
            error_message=None,
        )
        self._audit(
            "task_sent",
            f"已发送到飞书群 {resolved_group_id}",
            task_id=task_id,
            actor=user_id,
        )
        logger.info("任务 %s 已发送飞书（group=%s）", task_id, resolved_group_id)
        return TaskConfirmResponse(
            task_id=task_id,
            status=TaskStatus.SENT,
            message="sent",
        )

    def _resolve_group(self, group_id: str):
        if group_id:
            group = self._groups.get(group_id)
            if group is not None:
                return group
        return self._groups.get_default()

    @staticmethod
    def _write_send_log(
        *,
        task_id: str,
        group_id: str,
        user_id: str,
        status: str,
        ai_fields: dict[str, Any] | None,
        final_fields: dict[str, Any] | None,
        error_message: str | None,
    ) -> None:
        try:
            factory = get_session_factory()
            with factory() as session:
                session.add(
                    SendLogRow(
                        id=str(uuid4()),
                        task_id=task_id,
                        group_id=group_id,
                        user_id=user_id,
                        status=status,
                        ai_fields=ai_fields,
                        final_fields=final_fields,
                        error_message=error_message,
                        created_at=utcnow(),
                    )
                )
                session.commit()
        except Exception:
            logger.exception("写入 send_logs 失败（task=%s）", task_id)

    @asynccontextmanager
    async def _reserve_uploads(self, count: int):
        """生产单进程队列支持预留；可选 Celery 维持原有投递接口。"""
        if isinstance(self._queue, TaskQueue):
            async with self._queue.reserve(count) as admission:
                yield admission
        else:
            yield self._queue

    async def _save_and_enqueue(
        self,
        upload: UploadFile,
        *,
        user_id: str,
        document_type: str,
        batch_id: str | None = None,
        admission=None,
    ) -> str:
        raw_name = upload.filename or "unnamed"
        relative_path = raw_name.replace("\\", "/") if ("/" in raw_name or "\\" in raw_name) else None
        display_name = Path(raw_name.replace("\\", "/")).name
        ext = Path(display_name).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise UploadValidationError(f"不支持的文件类型: {ext}（仅支持 PDF）")

        record = self._store.create(
            source_file=display_name,
            file_path=Path(),
            user_id=user_id,
            document_type=document_type,
            batch_id=batch_id,
            relative_path=relative_path,
        )
        dest = self._upload_dir / f"{record.id}{ext}"

        try:
            # 分块落盘，避免并发上传时把整份 PDF 复制到内存。
            with dest.open("wb") as target:
                while chunk := await upload.read(1024 * 1024):
                    target.write(chunk)
            record.file_path = dest
            self._store.save(record)
            await (admission or self._queue).enqueue(record.id)
        except BaseException:
            self._store.delete(record.id)
            dest.unlink(missing_ok=True)
            raise
        self._audit(
            "task_uploaded",
            f"已上传 {display_name}",
            task_id=record.id,
            actor=user_id,
        )

        return record.id

    def _audit(
        self,
        event_type: str,
        message: str,
        *,
        task_id: str | None = None,
        actor: str = "system",
        details: dict[str, Any] | None = None,
    ) -> None:
        log_event(
            event_type,
            message,
            task_id=task_id,
            actor=actor,
            details=details,
            session_factory=get_session_factory(),
        )

    def _require(self, task_id: str) -> TaskRecord:
        record = self._store.get(task_id)
        if record is None:
            raise TaskNotFoundError(task_id)
        return record

    @staticmethod
    def _to_summary(record: TaskRecord) -> TaskSummary:
        company_name = None
        stock_code = None
        if record.extraction:
            company_name = record.extraction.get("company_name")
            stock_code = record.extraction.get("stock_code")
        return TaskSummary(
            id=record.id,
            status=record.status,
            source_file=record.source_file,
            document_type=record.document_type,
            batch_id=record.batch_id,
            relative_path=record.relative_path,
            company_name=company_name,
            stock_code=stock_code,
            created_at=record.created_at,
            updated_at=record.updated_at,
            error_message=record.error_message,
        )


def _changed_keys(before: dict[str, Any], after: dict[str, Any]) -> list[str]:
    keys = set(before) | set(after)
    return sorted(key for key in keys if before.get(key) != after.get(key))


def _default_batch_name(uploads: list[UploadFile]) -> str:
    first = uploads[0].filename or "batch"
    parent = Path(first.replace("\\", "/")).parts
    if len(parent) > 1:
        return parent[0]
    return f"batch-{len(uploads)}files"
