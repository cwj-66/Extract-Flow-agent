"""研报字段质量提示：缺失、格式、单位冲突。"""

from __future__ import annotations

from app.extractor.schemas import ExtractionResult
from app.extractor.validation import ValidationStatus, check_report
from app.services.demo_reports import DEMO_SCENARIOS


def _check(key: str) -> tuple[ValidationStatus, list[str]]:
    scenario = DEMO_SCENARIOS[key]
    result = ExtractionResult.model_validate(scenario["fields"])
    status, issues = check_report(result, str(scenario["markdown"]))
    return status, [item.field or "" for item in issues]


def test_clean_sample_is_valid() -> None:
    status, fields = _check("report_clean")
    assert status == ValidationStatus.VALID
    assert fields == []


def test_missing_rating_and_roe_warn() -> None:
    status, fields = _check("report_missing")
    assert status == ValidationStatus.WARNING
    assert "rating" in fields
    assert "roe" in fields
    assert "company_name" not in fields


def test_unit_conflict_on_revenue() -> None:
    scenario = DEMO_SCENARIOS["report_unit"]
    result = ExtractionResult.model_validate(scenario["fields"])
    status, issues = check_report(result, str(scenario["markdown"]))
    assert status == ValidationStatus.WARNING
    revenue = next(item for item in issues if item.field == "revenue")
    assert revenue.rule == "amount_validation"
    assert "亿元" in revenue.message
    assert "万元" in revenue.message


def test_blank_company_fails() -> None:
    status, issues = check_report(ExtractionResult(company_name="无"))
    assert status == ValidationStatus.FAILED
    assert any(item.field == "company_name" and item.level.value == "error" for item in issues)
