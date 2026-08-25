"""把提取值 / LLM 摘录定位回清洗后 Markdown，供工作台高亮。"""

from __future__ import annotations

import re

from app.extractor.schemas import ExtractionResult, FieldEvidence

_MISSING = "无"
_SCALAR_FIELDS = (
    "company_name",
    "stock_code",
    "report_period",
    "rating",
    "core_view",
    "risks",
)
_METRIC_FIELDS = ("revenue", "net_profit", "roe", "total_assets", "net_assets")


def locate_quote(markdown: str, quote: str) -> tuple[int, int, float] | None:
    """在原文中定位摘录。精确命中 confidence=1.0，截断命中 0.6。"""
    q = (quote or "").strip()
    if not q or q == _MISSING:
        return None
    idx = markdown.find(q)
    if idx >= 0:
        return idx, idx + len(q), 1.0

    compact_q = re.sub(r"\s+", "", q)
    if len(compact_q) >= 8:
        mapped = _locate_collapsed(markdown, compact_q)
        if mapped is not None:
            return mapped[0], mapped[1], 0.85

    if len(q) > 12:
        stem = q[:12]
        idx = markdown.find(stem)
        if idx >= 0:
            end = min(len(markdown), idx + min(len(q), 80))
            return idx, end, 0.6
    return None


def _locate_collapsed(markdown: str, compact_q: str) -> tuple[int, int] | None:
    """忽略空白后匹配，再映射回原文下标。"""
    compact_chars: list[int] = []
    compact_buf: list[str] = []
    for i, ch in enumerate(markdown):
        if ch.isspace():
            continue
        compact_chars.append(i)
        compact_buf.append(ch)
    collapsed = "".join(compact_buf)
    idx = collapsed.find(compact_q)
    if idx < 0:
        return None
    start = compact_chars[idx]
    end_idx = idx + len(compact_q) - 1
    end = compact_chars[end_idx] + 1
    return start, end


def _metric_needles(value: str, change: str) -> list[str]:
    needles = [value, change]
    for part in (value, change):
        m = re.search(r"-?\d+(?:\.\d+)?", (part or "").replace(",", "").replace("，", ""))
        if m and len(m.group()) >= 3:
            needles.append(m.group())
    return [n.strip() for n in needles if n and n.strip() and n.strip() != _MISSING]


def ground_fields(
    markdown: str,
    result: ExtractionResult,
    quotes: dict[str, str] | None = None,
) -> list[FieldEvidence]:
    """为标量 / 指标字段生成出处。优先 LLM quote，否则用提取值回搜。"""
    quotes = quotes or {}
    items: list[FieldEvidence] = []
    for field in _SCALAR_FIELDS:
        value = str(getattr(result, field) or "")
        quote = quotes.get(field) or value
        items.append(_evidence_for(field, markdown, quote, value))

    for field in _METRIC_FIELDS:
        pair = getattr(result, field)
        quote = quotes.get(field) or ""
        needles = [quote, *(_metric_needles(pair.value, pair.change))]
        located = None
        used = quote
        for needle in needles:
            located = locate_quote(markdown, needle)
            if located:
                used = markdown[located[0] : located[1]]
                break
        if located:
            start, end, conf = located
            items.append(
                FieldEvidence(
                    field=field, quote=used, start=start, end=end, confidence=conf
                )
            )
        else:
            items.append(FieldEvidence(field=field, quote=quote, start=-1, end=-1, confidence=0.0))
    return items


def _evidence_for(field: str, markdown: str, quote: str, value: str) -> FieldEvidence:
    located = locate_quote(markdown, quote) or locate_quote(markdown, value)
    if located is None:
        return FieldEvidence(field=field, quote=quote, start=-1, end=-1, confidence=0.0)
    start, end, conf = located
    return FieldEvidence(
        field=field,
        quote=markdown[start:end],
        start=start,
        end=end,
        confidence=conf,
    )
