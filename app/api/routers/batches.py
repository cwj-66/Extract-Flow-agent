"""批次查询接口。"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.api.deps import TaskServiceDep
from app.api.schemas.task import BatchResponse
from app.services.exceptions import BatchNotFoundError

router = APIRouter(prefix="/batches", tags=["batches"])


@router.get("/{batch_id}", response_model=BatchResponse)
async def get_batch(service: TaskServiceDep, batch_id: str) -> BatchResponse:
    """查询批次进度与子任务列表。"""
    try:
        return service.get_batch(batch_id)
    except BatchNotFoundError as exc:
        raise HTTPException(status_code=404, detail="batch not found") from exc
