"""飞书自定义机器人 Webhook 客户端：卡片数据结构 + HTTP 发送。"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import requests

FEISHU_BASE_URL = "https://open.feishu.cn/open-apis/bot/v2/hook"


@dataclass
class FeishuCardHeader:
    """飞书卡片头部：标题与颜色模板。"""
    title: str
    template: str = "blue"


@dataclass
class FeishuCardMessage:
    """飞书交互卡片消息（Card JSON 2.0），可序列化为 Webhook 请求体。"""
    header: FeishuCardHeader
    elements: list[dict[str, Any]] = field(default_factory=list)
    wide_screen_mode: bool = True

    def to_dict(self) -> dict[str, Any]:
        config: dict[str, Any] = {"update_multi": True}
        if self.wide_screen_mode:
            config["wide_screen_mode"] = True
        card: dict[str, Any] = {
            "schema": "2.0",
            "config": config,
            "header": {
                "title": {"tag": "plain_text", "content": self.header.title},
                "template": self.header.template,
            },
            "body": {"elements": self.elements},
        }
        return {"msg_type": "interactive", "card": card}


class FeishuClient:
    """飞书自定义机器人 Webhook 客户端。"""

    def __init__(self, webhook: str, timeout: int = 10):
        self.webhook = webhook
        self.timeout = timeout

    def send_card(self, card: FeishuCardMessage) -> dict[str, Any]:
        """发送卡片消息，返回飞书 API 响应 JSON。"""
        payload = card.to_dict()
        resp = requests.post(self.webhook, json=payload, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def send_text(self, text: str) -> dict[str, Any]:
        """发送纯文本消息（用于快速测试）。"""
        payload = {"msg_type": "text", "content": {"text": text}}
        resp = requests.post(self.webhook, json=payload, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()
