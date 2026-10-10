# graft: github.com/SAHARIARSHOWMIK/ai-document-processing-automation@ddb4085:app/services/validation_engine.py — do not edit, re-sync via code-graft
# License: MIT. Copyright (c) 2026 Your Name.
"""字段质量提示。上游校验发票金额与日期；这里只保留问题等级，规则改成研报字段。"""

from __future__ import annotations

import enum
import re
from typing import Optional

from pydantic import BaseModel

from app.extractor.schemas import ExtractionResult

_MISSING = "无"
_MONEY_UNITS = ("百万元", "亿元", "万元")
_CODE = re.compile(r"^\d{6}\.(SH|SZ|BJ)$")
_YEAR = re.compile(r"20\d{2}")


class ValidationLevel(str, enum.Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class ValidationStatus(str, enum.Enum):
    VALID = "valid"
    WARNING = "warning"
    FAILED = "failed"


class ValidationIssue(BaseModel):
    level: ValidationLevel
    rule: str
    field: Optional[str] = None
    message: str


def _issue(
    level: ValidationLevel,
    rule: str,
    message: str,
    field: Optional[str] = None,
) -> ValidationIssue:
    return ValidationIssue(level=level, rule=rule, field=field, message=message)


def _missing(value: object) -> bool:
    text = "" if value is None else str(value).strip()
    return not text or text == _MISSING


def _require(value: object, field: str, label: str, *, warning: bool = False) -> ValidationIssue | None:
    if not _missing(value):
        return None
    level = ValidationLevel.WARNING if warning else ValidationLevel.ERROR
    return _issue(level, "required_field_validation", f"{label}缺失。", field=field)


def _determine_status(issues: list[ValidationIssue]) -> ValidationStatus:
    if any(item.level == ValidationLevel.ERROR for item in issues):
        return ValidationStatus.FAILED
    if any(item.level == ValidationLevel.WARNING for item in issues):
        return ValidationStatus.WARNING
    return ValidationStatus.VALID


def _money_scales(text: str) -> set[str]:
    found: set[str] = set()
    if "百万元" in text:
        found.add("百万元")
    if "亿元" in text:
        found.add("亿元")
    if "万元" in text and "百万元" not in text:
        found.add("万元")
    return found


def _narrative_lines(markdown: str) -> list[str]:
    """盈利预测用百万元，不参与当期金额的单位对照。"""
    lines: list[str] = []
    in_forecast = False
    for line in markdown.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            in_forecast = "预测" in stripped
            continue
        if not in_forecast and not re.search(r"20\d{2}E", stripped):
            lines.append(stripped)
    return lines


def _unit_conflict(markdown: str, markers: tuple[str, ...], value: str) -> set[str]:
    scales = _money_scales(value)
    for line in _narrative_lines(markdown):
        if any(marker in line for marker in markers):
            scales |= _money_scales(line)
    return scales


def check_report(result: ExtractionResult, markdown: str = "") -> tuple[ValidationStatus, list[ValidationIssue]]:
    """检查缺失、代码/报告期格式，以及金额单位是否和原文冲突。"""
    issues: list[ValidationIssue] = []

    for field, label, warning in (
        ("company_name", "公司名称", False),
        ("stock_code", "证券代码", False),
        ("report_period", "报告期", False),
        ("rating", "投资评级", True),
        ("core_view", "核心观点", False),
        ("risks", "风险提示", False),
    ):
        item = _require(getattr(result, field), field, label, warning=warning)
        if item:
            issues.append(item)

    code = result.stock_code.strip()
    if not _missing(code) and _CODE.fullmatch(code) is None:
        issues.append(
            _issue(
                ValidationLevel.WARNING,
                "format_validation",
                "证券代码格式异常，应为 6 位数字加 .SH、.SZ 或 .BJ。",
                field="stock_code",
            )
        )

    period = result.report_period.strip()
    if not _missing(period) and _YEAR.search(period) is None:
        issues.append(
            _issue(
                ValidationLevel.WARNING,
                "format_validation",
                "报告期里没有年份。",
                field="report_period",
            )
        )

    metrics = (
        ("revenue", "营业收入", ("营业收入",), False),
        ("net_profit", "归母净利润", ("归母净利润", "净利润"), False),
        ("roe", "加权平均 ROE", ("ROE",), True),
        ("total_assets", "总资产", ("总资产",), True),
        ("net_assets", "归母净资产", ("归母净资产",), True),
    )
    for field, label, markers, warning in metrics:
        pair = getattr(result, field)
        item = _require(pair.value, field, label, warning=warning)
        if item:
            issues.append(item)
            continue
        value = pair.value.strip()
        if field == "roe":
            if "%" not in value:
                issues.append(
                    _issue(
                        ValidationLevel.WARNING,
                        "format_validation",
                        f"{label}没有百分号。",
                        field=field,
                    )
                )
            continue
        scales = _unit_conflict(markdown, markers, value)
        value_scales = _money_scales(value)
        if not value_scales:
            issues.append(
                _issue(
                    ValidationLevel.WARNING,
                    "amount_validation",
                    f"{label}的数字没有单位。",
                    field=field,
                )
            )
        elif len(scales) > 1:
            shown = "、".join(unit for unit in _MONEY_UNITS if unit in scales)
            issues.append(
                _issue(
                    ValidationLevel.WARNING,
                    "amount_validation",
                    f"{label}在原文中同时出现{shown}，当前提取值是{value}。",
                    field=field,
                )
            )

    return _determine_status(issues), issues
