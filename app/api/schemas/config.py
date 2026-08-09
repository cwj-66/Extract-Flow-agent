"""配置相关 API 模型（飞书群；提取字段已固定，不再可配置）。"""

from __future__ import annotations

from pydantic import BaseModel, Field


class GroupConfig(BaseModel):
    """单个群聊目标配置。"""

    id: str
    name: str
    webhook_url: str
    document_type: str = "broker_report_review"
    is_default: bool = False


class GroupsConfigUpdate(BaseModel):
    """PUT /config/groups 请求体。"""

    groups: list[GroupConfig]


class GroupsConfigResponse(BaseModel):
    """群配置响应。"""

    groups: list[GroupConfig] = Field(default_factory=list)
