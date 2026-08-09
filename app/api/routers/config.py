"""群聊配置接口（提取字段已固定，不再提供配置端点）。"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import GroupServiceDep
from app.api.schemas.config import GroupsConfigResponse, GroupsConfigUpdate

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/groups", response_model=GroupsConfigResponse)
async def get_groups(group_service: GroupServiceDep) -> GroupsConfigResponse:
    """读取群聊目标配置。"""
    return group_service.list_groups()


@router.put("/groups", response_model=GroupsConfigResponse)
async def update_groups(
    body: GroupsConfigUpdate,
    group_service: GroupServiceDep,
) -> GroupsConfigResponse:
    """全量替换群聊目标配置（群 ID、Webhook、默认群）。"""
    return group_service.replace_groups(body.groups)
