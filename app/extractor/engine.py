"""LLM 提取引擎：结构化 Markdown → ExtractionResult + 出处 + 用量。"""

from __future__ import annotations

import json
import logging
import time

from openai import OpenAI

from app.config import settings
from app.extractor.grounding import ground_fields
from app.extractor.schemas import (
    ExtractedDocument,
    ExtractionMeta,
    ExtractionMetrics,
    ExtractionResult,
    build_extraction_prompt,
    parse_llm_payload,
)

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "qwen3.7-plus"
_REPAIR_PROMPT = "上一次输出不是合法 JSON。请只输出 JSON 对象，不要 Markdown 代码块。"


def _strip_fence(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        text = text.rsplit("\n```", 1)[0]
        text = text.strip()
    return text


def _parse_json_object(raw: str) -> dict:
    data = json.loads(_strip_fence(raw))
    if not isinstance(data, dict):
        raise ValueError(f"LLM 返回不是 JSON 对象: {type(data).__name__}")
    return data


def _estimate_cny(prompt_tokens: int, completion_tokens: int) -> float:
    input_cny = prompt_tokens / 1_000_000 * settings.LLM_INPUT_CNY_PER_MILLION
    output_cny = completion_tokens / 1_000_000 * settings.LLM_OUTPUT_CNY_PER_MILLION
    return round(input_cny + output_cny, 6)


def extract_document(
    markdown: str,
    *,
    model: str = _DEFAULT_MODEL,
    show_raw: bool = False,
) -> ExtractedDocument:
    """提取字段，并回填原文出处与 token 用量。"""
    client = OpenAI(
        api_key=settings.DASHSCOPE_API_KEY,
        base_url=settings.DASHSCOPE_BASE_URL,
    )
    messages: list[dict[str, str]] = [
        {"role": "user", "content": build_extraction_prompt(markdown)},
    ]

    t0 = time.perf_counter()
    prompt_tokens = 0
    completion_tokens = 0
    retries = 0
    data: dict | None = None
    last_raw = ""

    for _attempt in range(2):
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.1,
            response_format={"type": "json_object"},
            extra_body={"enable_thinking": False},
        )
        usage = resp.usage
        if usage is not None:
            prompt_tokens += int(usage.prompt_tokens or 0)
            completion_tokens += int(usage.completion_tokens or 0)
        last_raw = (resp.choices[0].message.content or "").strip()
        if show_raw:
            print(f"[DEBUG] 原始返回:\n{last_raw}\n")
        try:
            data = _parse_json_object(last_raw)
            break
        except (json.JSONDecodeError, ValueError) as exc:
            retries += 1
            logger.warning("LLM JSON 解析失败，准备重试 (%s)", exc)
            messages.append({"role": "assistant", "content": last_raw})
            messages.append({"role": "user", "content": _REPAIR_PROMPT})

    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    if data is None:
        raise ValueError(f"LLM 返回无法解析为 JSON\n返回内容:\n{last_raw[:500]}")

    fields, quotes = parse_llm_payload(data)
    result = ExtractionResult.model_validate(fields)
    evidence = ground_fields(markdown, result, quotes)
    metrics = ExtractionMetrics(
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        elapsed_ms=elapsed_ms,
        estimated_cny=_estimate_cny(prompt_tokens, completion_tokens),
        retries=retries,
    )
    logger.info(
        "LLM 提取完成 (%.0fms, tokens=%d, cny=%.4f, grounded=%d)",
        elapsed_ms,
        metrics.total_tokens,
        metrics.estimated_cny,
        sum(1 for item in evidence if item.confidence > 0),
    )
    return ExtractedDocument(
        result=result,
        meta=ExtractionMeta(evidence=evidence, metrics=metrics),
    )


def extract_fields(
    markdown: str,
    *,
    model: str = _DEFAULT_MODEL,
    show_raw: bool = False,
) -> ExtractionResult:
    """从结构化 Markdown 中提取固定研报字段。"""
    return extract_document(markdown, model=model, show_raw=show_raw).result
