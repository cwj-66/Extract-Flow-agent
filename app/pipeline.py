"""研报处理主流程：清洗 → 提取 → 卡片 →（可选）飞书发送。

CLI、FastAPI、Celery 共用此模块，避免在入口层重复编排逻辑。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.cleaners.types import ParsedDoc
from app.extractor.engine import extract_fields
from app.feishu.card_builder import build_report_card
from app.feishu.client import FeishuCardMessage, FeishuClient

logger = logging.getLogger(__name__)


class PipelineError(ValueError):
    """主流程业务错误。"""


@dataclass
class PipelineResult:
    """一次完整研报处理的结果。"""

    doc: ParsedDoc
    fields: dict | None = None
    card: FeishuCardMessage | None = None
    feishu_response: dict[str, Any] | None = None


def parse_document(file_path: Path) -> ParsedDoc:
    """文档接入 → 分类 → 清洗 → 合并。"""
    if not file_path.exists():
        raise PipelineError(f"文件不存在: {file_path}")

    ext = file_path.suffix.lower()
    logger.info("[接入] 文件: %s, 类型: %s", file_path.name, ext)

    if ext != ".pdf":
        raise PipelineError(f"不支持的文件类型: {ext}（仅支持 PDF）")

    from app.cleaners.handlers.pdf import parse_pdf

    logger.info("[清洗] 解析中...")
    doc = parse_pdf(file_path)
    logger.info(
        "[合并] 完成 — %d 字符, 图片 %d 张, 结构化条目 %d 条",
        len(doc.content),
        doc.stats.get("total_images", 0),
        len(doc.structured_items),
    )

    for warning in doc.parse_warnings:
        logger.warning("  ⚠ %s", warning)

    return doc


def extract_report_fields(
    markdown: str,
    *,
    model: str | None = None,
) -> dict[str, Any]:
    """从清洗后的 Markdown 提取研报字段。"""
    logger.info("[提取] LLM 字段提取中...")
    kwargs: dict[str, Any] = {}
    if model:
        kwargs["model"] = model
    result = extract_fields(markdown, **kwargs)
    logger.info("[提取] 完成")
    return result.model_dump()


def build_feishu_card(
    fields: dict[str, Any],
    *,
    source_file: str = "",
) -> FeishuCardMessage:
    """用提取结果构建飞书交互卡片。"""
    logger.info("[卡片] 构建飞书 Card v2...")
    return build_report_card(fields, source_file=source_file)


def send_feishu_card(
    card: FeishuCardMessage,
    *,
    webhook_url: str,
) -> dict[str, Any]:
    """发送飞书卡片，返回 API 响应。"""
    url = webhook_url.strip()
    if not url:
        raise PipelineError("未提供飞书 Webhook URL，无法发送")

    logger.info("[发送] 飞书 Webhook...")
    client = FeishuClient(url)
    resp = client.send_card(card)

    if resp.get("code") != 0:
        raise PipelineError(f"飞书发送失败: {resp}")

    logger.info("[发送] 成功")
    return resp


def run_report_pipeline(
    file_path: Path,
    *,
    source_file: str | None = None,
    model: str | None = None,
    send: bool = False,
    webhook_url: str | None = None,
) -> PipelineResult:
    """完整研报主流程：清洗 → 提取 → 卡片 →（可选）发送。"""
    doc = parse_document(file_path)
    fields = extract_report_fields(doc.content, model=model)
    card = build_feishu_card(fields, source_file=source_file or file_path.name)

    feishu_response = None
    if send:
        if not webhook_url:
            raise PipelineError("使用 --send 时请同时传入 --webhook")
        feishu_response = send_feishu_card(card, webhook_url=webhook_url)

    return PipelineResult(
        doc=doc,
        fields=fields,
        card=card,
        feishu_response=feishu_response,
    )
