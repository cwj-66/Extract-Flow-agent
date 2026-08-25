"""任务查询与确认接口。"""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse

from app.api.deps import TaskServiceDep, UserIdDep
from app.api.schemas.task import (
    TaskConfirmRequest,
    TaskConfirmResponse,
    TaskContentResponse,
    TaskListResponse,
    TaskResultResponse,
    TaskStatus,
    TaskSummary,
)
from app.services.exceptions import TaskNotFoundError, TaskStateError

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    service: TaskServiceDep,
    q: str | None = Query(
        default=None,
        description="按报告名搜索：匹配文件名、公司名或证券代码（模糊）",
    ),
    status: TaskStatus | None = Query(default=None, description="按状态筛选"),
    batch_id: str | None = Query(default=None, description="按批次筛选"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> TaskListResponse:
    """历史报告列表：支持按名称搜索 + 状态 / 批次筛选。"""
    return await service.list_tasks(
        status=status, q=q, offset=offset, limit=limit, batch_id=batch_id
    )


@router.get("/{task_id}", response_model=TaskSummary)
async def get_task(service: TaskServiceDep, task_id: str) -> TaskSummary:
    """查询单个任务状态（便于轮询）。"""
    try:
        return service.get_task(task_id)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail="task not found") from exc


@router.delete("/{task_id}", status_code=204)
async def delete_task(service: TaskServiceDep, task_id: str) -> None:
    """删除任务及其上传文件。"""
    try:
        service.delete_task(task_id)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail="task not found") from exc


@router.get("/{task_id}/file")
async def download_original_file(service: TaskServiceDep, task_id: str) -> FileResponse:
    """下载上传的原始 PDF 文件。"""
    try:
        path, filename = service.get_original_file(task_id)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail="task not found") from exc
    except TaskStateError as exc:
        raise HTTPException(status_code=409, detail=exc.message) from exc
    return FileResponse(path, filename=filename, media_type="application/octet-stream")


_TERMINAL_STATUSES = {TaskStatus.SENT, TaskStatus.FAILED}


@router.get("/{task_id}/events")
async def stream_task_events(service: TaskServiceDep, task_id: str) -> StreamingResponse:
    """SSE：任务状态变化即推送，工作台用来展示管线步进。"""

    async def event_gen():
        last = ""
        try:
            while True:
                try:
                    summary = service.get_task(task_id)
                except TaskNotFoundError:
                    yield f"event: error\ndata: {json.dumps({'detail': 'task not found'})}\n\n"
                    return
                payload = summary.model_dump(mode="json")
                encoded = json.dumps(payload, ensure_ascii=False)
                if encoded != last:
                    yield f"data: {encoded}\n\n"
                    last = encoded
                if summary.status in _TERMINAL_STATUSES:
                    yield "event: done\ndata: {}\n\n"
                    return
                await asyncio.sleep(0.6)
        except asyncio.CancelledError:
            return

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{task_id}/content", response_model=TaskContentResponse)
async def get_task_content(service: TaskServiceDep, task_id: str) -> TaskContentResponse:
    """查看清洗后的结构化 Markdown（MinerU 产出，LLM 提取前的「原文」）。"""
    try:
        return service.get_content(task_id)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail="task not found") from exc
    except TaskStateError as exc:
        raise HTTPException(status_code=409, detail=exc.message) from exc


@router.get("/{task_id}/result", response_model=TaskResultResponse)
async def get_task_result(service: TaskServiceDep, task_id: str) -> TaskResultResponse:
    """查看 AI 提取后的结构化结果。"""
    try:
        return service.get_result(task_id)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail="task not found") from exc
    except TaskStateError as exc:
        raise HTTPException(status_code=409, detail=exc.message) from exc


@router.post("/{task_id}/confirm", response_model=TaskConfirmResponse)
async def confirm_task(
    service: TaskServiceDep,
    user_id: UserIdDep,
    task_id: str,
    body: TaskConfirmRequest,
) -> TaskConfirmResponse:
    """确认发送：可携带用户修改后的字段，触发飞书推送。"""
    try:
        return service.confirm(task_id, body, user_id=user_id)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail="task not found") from exc
    except TaskStateError as exc:
        raise HTTPException(status_code=409, detail=exc.message) from exc
