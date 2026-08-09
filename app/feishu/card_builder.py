"""构建飞书交互卡片：用 Card JSON 2.0 原生 table 展示研报摘要。"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from app.extractor.schemas import ExtractionResult
from app.feishu.client import FeishuCardHeader, FeishuCardMessage
from app.feishu.table_formatter import TableBlock, TextBlock, format_to_blocks

_EMPTY_CELL = "​"
_TABLE_BASE_WIDTH_PX = 480


def _column_widths(weights: list[int], count: int) -> list[str]:
    if not weights or len(weights) < count:
        weights = [1] * count
    total = sum(weights[:count]) or count
    return [
        f"{max(16, min(600, int(_TABLE_BASE_WIDTH_PX * w / total)))}px"
        for w in weights[:count]
    ]


def _render_table(block: TableBlock) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    widths = _column_widths(block.weights, len(block.headers))

    if block.title:
        out.append({"tag": "markdown", "content": f"**{block.title}**"})

    columns = [
        {
            "name": f"col_{i}",
            "display_name": header,
            "data_type": "text",
            "width": width,
        }
        for i, (header, width) in enumerate(zip(block.headers, widths))
    ]

    rows: list[dict[str, str]] = []
    for row in block.rows:
        row_obj: dict[str, str] = {}
        for i in range(len(block.headers)):
            cell = row[i] if i < len(row) else ""
            row_obj[f"col_{i}"] = cell if cell else _EMPTY_CELL
        rows.append(row_obj)

    out.append({
        "tag": "table",
        "page_size": min(max(len(rows), 1), 10),
        "row_height": "low",
        "header_style": {
            "bold": True,
            "text_align": "left",
            "text_size": "normal",
            "background_style": "grey",
            "text_color": "default",
            "lines": 1,
        },
        "columns": columns,
        "rows": rows,
    })
    return out


def _render_text(block: TextBlock) -> list[dict[str, Any]]:
    return [{"tag": "markdown", "content": block.content}]


def _render_footnote(source_file: str) -> dict[str, Any]:
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    content = f"数据来源: {source_file}  |  提取时间: {now_str}"
    return {
        "tag": "div",
        "text": {
            "tag": "plain_text",
            "content": content,
            "text_color": "grey",
            "text_size": "notation",
        },
    }


def build_report_card(
    fields: ExtractionResult | dict[str, Any],
    *,
    source_file: str = "",
) -> FeishuCardMessage:
    """用固定 ExtractionResult 构建飞书卡片(Card v2 table 布局)。"""
    result = (
        fields
        if isinstance(fields, ExtractionResult)
        else ExtractionResult.model_validate(fields)
    )

    company = result.company_name if result.company_name != "无" else ""
    code = result.stock_code if result.stock_code != "无" else ""
    period = result.report_period if result.report_period != "无" else ""

    header_title = f"【研报摘要】{company}({code})" if code else f"【研报摘要】{company}"
    if period:
        header_title += f" | {period}点评"

    header = FeishuCardHeader(title=header_title, template="blue")

    elements: list[dict[str, Any]] = []
    blocks = format_to_blocks(result)

    for i, block in enumerate(blocks):
        if isinstance(block, TableBlock):
            elements.extend(_render_table(block))
        elif isinstance(block, TextBlock):
            elements.extend(_render_text(block))

        if i < len(blocks) - 1:
            elements.append({"tag": "hr"})

    elements.append(_render_footnote(source_file))
    return FeishuCardMessage(header=header, elements=elements)
