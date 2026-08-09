"""文件上传接口（单文件 + 批量）。"""

from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.api.deps import TaskServiceDep, UserIdDep
from app.api.schemas.task import BatchUploadResponse, UploadResponse
from app.services.exceptions import UploadValidationError

router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
async def upload_documents(
    service: TaskServiceDep,
    user_id: UserIdDep,
    file: UploadFile = File(..., description="PDF 研报；其他类型返回 400"),
) -> UploadResponse:
    """上传一份 PDF 研报，创建异步提取任务。"""
    try:
        return await service.create_from_upload(file, user_id=user_id)
    except UploadValidationError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc


@router.post("/upload/batch", response_model=BatchUploadResponse)
async def upload_batch(
    service: TaskServiceDep,
    user_id: UserIdDep,
    files: list[UploadFile] = File(..., description="多个 PDF；非 PDF 记入 rejected"),
    batch_name: str | None = Form(default=None, description="批次显示名；省略则用文件夹名或文件数"),
) -> BatchUploadResponse:
    """批量上传 PDF，创建批次任务。"""
    try:
        return await service.create_from_batch(
            files,
            user_id=user_id,
            batch_name=batch_name,
        )
    except UploadValidationError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
