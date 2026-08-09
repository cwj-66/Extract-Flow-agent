"""提取结果 → 固定结构化表格块（与飞书 Card v2 布局对齐）。"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.extractor.schemas import ExtractionResult, MetricPair

_PH = "​"  # 零宽空格，避免空单元格被渲染吞掉


@dataclass
class TableBlock:
    """一个表格块，会被渲染为 Card v2 原生 table 组件。"""

    title: str = ""
    headers: list[str] = field(default_factory=list)
    rows: list[list[str]] = field(default_factory=list)
    weights: list[int] = field(default_factory=lambda: [1, 1])


@dataclass
class TextBlock:
    """一个纯文本块，渲染为普通 markdown。"""

    content: str = ""


Block = TableBlock | TextBlock


def _metric_row(label: str, pair: MetricPair) -> list[str]:
    value = (pair.value or "").strip() or _PH
    change = (pair.change or "").strip() or _PH
    return [label, value, change]


def format_to_blocks(result: ExtractionResult) -> list[Block]:
    """固定布局：评级 → 核心财务 → 资产负债 → 业务板块 → 盈利预测 → 观点/风险。"""
    blocks: list[Block] = []

    rating = (result.rating or "").strip()
    if rating and rating != "无":
        blocks.append(TextBlock(content=f"**评级**: {rating}"))

    blocks.append(
        TableBlock(
            title="核心财务指标",
            headers=["指标", "数值", "变动"],
            rows=[
                _metric_row("营业收入", result.revenue),
                _metric_row("归母净利润", result.net_profit),
                _metric_row("加权平均 ROE", result.roe),
            ],
            weights=[30, 45, 25],
        )
    )

    blocks.append(
        TableBlock(
            title="资产负债",
            headers=["指标", "数值", "变动"],
            rows=[
                _metric_row("总资产", result.total_assets),
                _metric_row("归母净资产", result.net_assets),
            ],
            weights=[30, 45, 25],
        )
    )

    if result.business_segments:
        rows = [
            [
                (s.name or "").strip() or _PH,
                (s.value or "").strip() or _PH,
                (s.growth or "").strip() or _PH,
            ]
            for s in result.business_segments
            if (s.name or "").strip() and (s.name or "").strip() != "无"
        ]
        if rows:
            blocks.append(
                TableBlock(
                    title="业务板块表现",
                    headers=["业务", "收入/规模", "增速"],
                    rows=rows,
                    weights=[30, 40, 30],
                )
            )

    forecast_rows: list[list[str]] = []
    for row in result.profit_forecast:
        year = (row.year or "").strip()
        if not year or year == "无":
            continue
        rev = (row.revenue or "").strip() or _PH
        profit = (row.net_profit or "").strip() or _PH
        if rev == "无" and profit == "无":
            continue
        forecast_rows.append([year, rev if rev != "无" else _PH, profit if profit != "无" else _PH])
    if forecast_rows:
        blocks.append(
            TableBlock(
                title="盈利预测(百万元)",
                headers=["年份", "营业收入", "净利润"],
                rows=forecast_rows,
                weights=[20, 40, 40],
            )
        )

    core = (result.core_view or "").strip()
    if core and core != "无":
        blocks.append(TextBlock(content=f"**核心观点**\n{core}"))

    risks = (result.risks or "").strip()
    if risks and risks != "无":
        blocks.append(TextBlock(content=f"**风险提示**\n{risks}"))

    return blocks
