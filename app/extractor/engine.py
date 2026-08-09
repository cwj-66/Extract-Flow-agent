"""LLM 提取引擎：结构化 Markdown → 固定 ExtractionResult。"""

from __future__ import annotations

import json
import logging
import time

from openai import OpenAI

from app.config import settings
from app.extractor.schemas import ExtractionResult, build_extraction_prompt

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "qwen3.7-plus"


def extract_fields(
    markdown: str,
    *,
    model: str = _DEFAULT_MODEL,
    show_raw: bool = False,
) -> ExtractionResult:
    """从结构化 Markdown 中提取固定研报字段。"""
    client = OpenAI(
        api_key=settings.DASHSCOPE_API_KEY,
        base_url=settings.DASHSCOPE_BASE_URL,
    )

    prompt = build_extraction_prompt(markdown)

    t0 = time.perf_counter()
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        extra_body={"enable_thinking": False},
    )
    elapsed = time.perf_counter() - t0

    raw = (resp.choices[0].message.content or "").strip()
    logger.info("LLM 提取完成 (%.1fs)", elapsed)

    if show_raw:
        print(f"[DEBUG] 原始返回:\n{raw}\n")

    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        raw = raw.rsplit("\n```", 1)[0]
        raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM 返回无法解析为 JSON: {e}\n返回内容:\n{raw[:500]}") from e

    if not isinstance(data, dict):
        raise ValueError(f"LLM 返回不是 JSON 对象: {type(data).__name__}")

    return ExtractionResult.model_validate(data)
