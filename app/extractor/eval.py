"""抽取评测：按字段类型打分（精确 / 数值容差 / 模糊包含）。"""

from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, Field

from app.extractor.schemas import ExtractionResult

_MISSING = "无"


class FieldScore(BaseModel):
    """单个字段的评测结果。"""

    field: str
    metric: str
    score: float
    passed: bool
    gold: str
    predicted: str


class EvalReport(BaseModel):
    """一份研报的字段级评测汇总。"""

    scores: list[FieldScore]
    pass_rate: float
    mean_score: float
    passed_fields: int
    total_fields: int


def _norm(value: str) -> str:
    return re.sub(r"\s+", "", (value or "").strip().lower())


def _first_number(text: str) -> float | None:
    cleaned = (text or "").replace(",", "").replace("，", "").replace("%", "")
    match = re.search(r"-?\d+(?:\.\d+)?", cleaned)
    if not match:
        return None
    try:
        return float(match.group())
    except ValueError:
        return None


def _exact(pred: str, gold: str) -> tuple[float, str]:
    if _norm(pred) == _norm(gold):
        return 1.0, "string_exact"
    return 0.0, "string_exact"


def _contains(pred: str, gold: str) -> tuple[float, str]:
    pn, gn = _norm(pred), _norm(gold)
    if not gn or gn == _MISSING:
        return (1.0 if not pn or pn == _MISSING else 0.5), "string_fuzzy"
    if pn == gn:
        return 1.0, "string_fuzzy"
    if gn in pn or pn in gn:
        return 0.8, "string_fuzzy"
    return 0.0, "string_fuzzy"


def _number(pred: str, gold: str, *, rel_tol: float = 0.02) -> tuple[float, str]:
    gp, pp = _first_number(gold), _first_number(pred)
    if gp is None and pp is None:
        return _exact(pred, gold)[0], "number_tolerance"
    if gp is None or pp is None:
        return 0.0, "number_tolerance"
    denom = max(abs(gp), 1e-9)
    if abs(pp - gp) / denom <= rel_tol or abs(pp - gp) < 0.01:
        return 1.0, "number_tolerance"
    return 0.0, "number_tolerance"


def _pair_text(pair: Any) -> str:
    return f"{pair.value}|{pair.change}"


def score_extraction(predicted: ExtractionResult, gold: ExtractionResult) -> EvalReport:
    """对照黄金标注打分；valid JSON 不计入，只看字段语义。"""
    checks: list[tuple[str, str, str, str]] = [
        ("company_name", "string_exact", predicted.company_name, gold.company_name),
        ("stock_code", "string_exact", predicted.stock_code, gold.stock_code),
        ("report_period", "string_exact", predicted.report_period, gold.report_period),
        ("rating", "string_fuzzy", predicted.rating, gold.rating),
        ("revenue", "number_tolerance", _pair_text(predicted.revenue), _pair_text(gold.revenue)),
        ("net_profit", "number_tolerance", _pair_text(predicted.net_profit), _pair_text(gold.net_profit)),
        ("roe", "number_tolerance", _pair_text(predicted.roe), _pair_text(gold.roe)),
        ("total_assets", "number_tolerance", _pair_text(predicted.total_assets), _pair_text(gold.total_assets)),
        ("net_assets", "number_tolerance", _pair_text(predicted.net_assets), _pair_text(gold.net_assets)),
        ("core_view", "string_fuzzy", predicted.core_view, gold.core_view),
        ("risks", "string_fuzzy", predicted.risks, gold.risks),
    ]

    scores: list[FieldScore] = []
    for field, metric, pred, gold_v in checks:
        if metric == "string_exact":
            score, used = _exact(pred, gold_v)
        elif metric == "number_tolerance":
            score, used = _number(pred, gold_v)
        else:
            score, used = _contains(pred, gold_v)
        scores.append(
            FieldScore(
                field=field,
                metric=used,
                score=score,
                passed=score >= 0.8,
                gold=gold_v,
                predicted=pred,
            )
        )

    total = len(scores)
    passed = sum(1 for s in scores if s.passed)
    mean = sum(s.score for s in scores) / total if total else 0.0
    return EvalReport(
        scores=scores,
        pass_rate=passed / total if total else 0.0,
        mean_score=mean,
        passed_fields=passed,
        total_fields=total,
    )


def score_dict(predicted: dict[str, Any], gold: dict[str, Any]) -> EvalReport:
    return score_extraction(
        ExtractionResult.model_validate(predicted),
        ExtractionResult.model_validate(gold),
    )
