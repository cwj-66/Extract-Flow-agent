# graft: github.com/SAHARIARSHOWMIK/ai-document-processing-automation@ddb4085:app/services/demo_documents.py — do not edit, re-sync via code-graft
# License: MIT. Copyright (c) 2026 Your Name.
"""可公开展示的虚构业绩点评。上游是发票样例文本，这里只保留场景目录。"""

from __future__ import annotations

from typing import Any

_CLEAN = """\
# 示例科技 2026年一季度业绩点评

证券代码：000001.SZ
公司名称：示例科技
报告期：2026Q1
投资评级：增持

## 财务摘要

营业收入 12.60亿元，同比+18.5%。
归母净利润 1.80亿元，同比+12.0%。
加权平均ROE 8.2%，同比+0.4个百分点。
总资产 86.00亿元，较年初+5.1%。
归母净资产 41.20亿元，较年初+3.6%。

## 业务板块

云计算 8.40亿元，同比+22%。
行业解决方案 4.20亿元，同比+11%。

## 盈利预测

2026E 营业收入 52000 百万元，归母净利润 6200 百万元。
2027E 营业收入 61000 百万元，归母净利润 7400 百万元。
2028E 营业收入 70000 百万元，归母净利润 8600 百万元。

## 核心观点

云计算收入占比提升，盈利能力保持稳定。

## 风险提示

下游资本开支不及预期；行业竞争加剧。
"""

_MISSING = """\
# 示例能源 2026年一季度业绩点评

证券代码：000002.SZ
公司名称：示例能源
报告期：2026Q1

## 财务摘要

营业收入 9.10亿元，同比+6.2%。
归母净利润 0.74亿元，同比-3.1%。
总资产 120.00亿元，较年初+1.8%。
归母净资产 55.40亿元，较年初+0.9%。

## 业务板块

火电 6.20亿元，同比+2%。
新能源 2.90亿元，同比+19%。

## 盈利预测

2026E 营业收入 38000 百万元，归母净利润 3100 百万元。
2027E 营业收入 40000 百万元，归母净利润 3400 百万元。
2028E 营业收入 42000 百万元，归母净利润 3600 百万元。

## 核心观点

电量保持增长，燃料成本仍压制利润。

## 风险提示

煤价上涨；新能源消纳不及预期。
"""

_UNIT = """\
# 示例医药 2026年一季度业绩点评

证券代码：000003.SZ
公司名称：示例医药
报告期：2026Q1
投资评级：优于大市

## 财务摘要

营业收入 12.60亿元，同比+9.4%。
正文表格另记营业收入 1260万元。
归母净利润 2.15亿元，同比+7.1%。
加权平均ROE 11.0%，同比+0.3个百分点。
总资产 64.30亿元，较年初+4.2%。
归母净资产 33.10亿元，较年初+2.5%。

## 业务板块

制剂 9.10亿元，同比+8%。
原料药 3.50亿元，同比+13%。

## 盈利预测

2026E 营业收入 54000 百万元，归母净利润 9000 百万元。
2027E 营业收入 60000 百万元，归母净利润 10200 百万元。
2028E 营业收入 66000 百万元，归母净利润 11400 百万元。

## 核心观点

制剂放量带动收入，需核对正文与表格的收入单位。

## 风险提示

集采降价；研发进度不及预期。
"""

DEMO_SCENARIOS: dict[str, dict[str, Any]] = {
    "report_clean": {
        "filename": "示例科技-2026Q1业绩点评.pdf",
        "markdown": _CLEAN,
        "fields": {
            "company_name": "示例科技",
            "stock_code": "000001.SZ",
            "report_period": "2026Q1",
            "rating": "增持",
            "revenue": {"value": "12.60亿元", "change": "同比+18.5%"},
            "net_profit": {"value": "1.80亿元", "change": "同比+12.0%"},
            "roe": {"value": "8.2%", "change": "同比+0.4个百分点"},
            "total_assets": {"value": "86.00亿元", "change": "较年初+5.1%"},
            "net_assets": {"value": "41.20亿元", "change": "较年初+3.6%"},
            "business_segments": [
                {"name": "云计算", "value": "8.40亿元", "growth": "同比+22%"},
                {"name": "行业解决方案", "value": "4.20亿元", "growth": "同比+11%"},
            ],
            "profit_forecast": [
                {"year": "2026E", "revenue": "52000", "net_profit": "6200"},
                {"year": "2027E", "revenue": "61000", "net_profit": "7400"},
                {"year": "2028E", "revenue": "70000", "net_profit": "8600"},
            ],
            "core_view": "云计算收入占比提升，盈利能力保持稳定。",
            "risks": "下游资本开支不及预期；行业竞争加剧。",
        },
    },
    "report_missing": {
        "filename": "示例能源-2026Q1业绩点评.pdf",
        "markdown": _MISSING,
        "fields": {
            "company_name": "示例能源",
            "stock_code": "000002.SZ",
            "report_period": "2026Q1",
            "rating": "无",
            "revenue": {"value": "9.10亿元", "change": "同比+6.2%"},
            "net_profit": {"value": "0.74亿元", "change": "同比-3.1%"},
            "roe": {"value": "无", "change": ""},
            "total_assets": {"value": "120.00亿元", "change": "较年初+1.8%"},
            "net_assets": {"value": "55.40亿元", "change": "较年初+0.9%"},
            "business_segments": [
                {"name": "火电", "value": "6.20亿元", "growth": "同比+2%"},
                {"name": "新能源", "value": "2.90亿元", "growth": "同比+19%"},
            ],
            "profit_forecast": [
                {"year": "2026E", "revenue": "38000", "net_profit": "3100"},
                {"year": "2027E", "revenue": "40000", "net_profit": "3400"},
                {"year": "2028E", "revenue": "42000", "net_profit": "3600"},
            ],
            "core_view": "电量保持增长，燃料成本仍压制利润。",
            "risks": "煤价上涨；新能源消纳不及预期。",
        },
    },
    "report_unit": {
        "filename": "示例医药-2026Q1业绩点评.pdf",
        "markdown": _UNIT,
        "fields": {
            "company_name": "示例医药",
            "stock_code": "000003.SZ",
            "report_period": "2026Q1",
            "rating": "优于大市",
            "revenue": {"value": "1260万元", "change": "同比+9.4%"},
            "net_profit": {"value": "2.15亿元", "change": "同比+7.1%"},
            "roe": {"value": "11.0%", "change": "同比+0.3个百分点"},
            "total_assets": {"value": "64.30亿元", "change": "较年初+4.2%"},
            "net_assets": {"value": "33.10亿元", "change": "较年初+2.5%"},
            "business_segments": [
                {"name": "制剂", "value": "9.10亿元", "growth": "同比+8%"},
                {"name": "原料药", "value": "3.50亿元", "growth": "同比+13%"},
            ],
            "profit_forecast": [
                {"year": "2026E", "revenue": "54000", "net_profit": "9000"},
                {"year": "2027E", "revenue": "60000", "net_profit": "10200"},
                {"year": "2028E", "revenue": "66000", "net_profit": "11400"},
            ],
            "core_view": "制剂放量带动收入，需核对正文与表格的收入单位。",
            "risks": "集采降价；研发进度不及预期。",
        },
    },
}

DEFAULT_SCENARIO = "report_clean"
SCENARIO_NOTE_PREFIX = "demo_scenario:"


def get_scenario_text(scenario_key: str) -> str:
    """返回场景的预置 Markdown；未知 key 回落到完整样例。"""
    scenario = DEMO_SCENARIOS.get(scenario_key, DEMO_SCENARIOS[DEFAULT_SCENARIO])
    return str(scenario["markdown"])
