"""出处定位与评测。"""

from __future__ import annotations

from app.extractor.eval import score_dict
from app.extractor.grounding import ground_fields, locate_quote
from app.extractor.meta import attach_meta, split_meta
from app.extractor.schemas import ExtractionResult, parse_llm_payload


def test_locate_quote_exact_and_collapsed() -> None:
    md = "营业收入 231.55 亿元，同比增长 40.91%。"
    hit = locate_quote(md, "231.55 亿元")
    assert hit is not None
    start, end, conf = hit
    assert md[start:end] == "231.55 亿元"
    assert conf == 1.0

    collapsed = locate_quote(md, "营业收入231.55亿元")
    assert collapsed is not None
    assert collapsed[2] >= 0.85


def test_ground_fields_uses_value_when_quote_missing() -> None:
    md = "# 中信证券（600030.SH）\n营业收入 231.55 亿元"
    result = ExtractionResult(
        company_name="中信证券",
        stock_code="600030.SH",
        revenue={"value": "231.55亿元", "change": "同比+40.91%"},
    )
    evidence = {item.field: item for item in ground_fields(md, result, {})}
    assert evidence["company_name"].confidence == 1.0
    assert evidence["stock_code"].start >= 0
    assert evidence["revenue"].confidence > 0


def test_parse_llm_payload_wrapped_and_flat() -> None:
    fields, quotes = parse_llm_payload(
        {
            "fields": {"company_name": "茅台"},
            "evidence": {"company_name": {"quote": "贵州茅台"}},
        }
    )
    assert fields["company_name"] == "茅台"
    assert quotes["company_name"] == "贵州茅台"

    flat, empty = parse_llm_payload({"company_name": "茅台"})
    assert flat["company_name"] == "茅台"
    assert empty == {}


def test_split_and_attach_meta() -> None:
    packed = attach_meta({"company_name": "茅台"}, {"metrics": {"model": "x"}})
    fields, meta = split_meta(packed)
    assert fields == {"company_name": "茅台"}
    assert meta["metrics"]["model"] == "x"
    assert split_meta(fields)[1] == {}


def test_eval_exact_and_number_tolerance() -> None:
    gold = {
        "company_name": "中信证券",
        "stock_code": "600030.SH",
        "report_period": "2026Q1",
        "rating": "优于大市",
        "revenue": {"value": "231.55亿元", "change": "同比+40.91%"},
        "net_profit": {"value": "102.16亿元", "change": "同比+54.60%"},
        "core_view": "作为行业龙头，市占率持续提升",
        "risks": "市场大幅波动",
    }
    pred = dict(gold)
    pred["revenue"] = {"value": "231.6亿元", "change": "同比+40.91%"}
    pred["core_view"] = "作为行业龙头，市占率持续提升，受益于注册制改革"
    report = score_dict(pred, gold)
    by_field = {s.field: s for s in report.scores}
    assert by_field["stock_code"].passed
    assert by_field["revenue"].passed
    assert by_field["core_view"].passed
    assert report.pass_rate >= 0.8
