"""LLM 字段提取。"""

from __future__ import annotations

from typing import Any

__all__ = ["extract_fields", "extract_document", "ExtractionResult"]


def __getattr__(name: str) -> Any:
    if name == "extract_fields":
        from app.extractor.engine import extract_fields

        return extract_fields
    if name == "extract_document":
        from app.extractor.engine import extract_document

        return extract_document
    if name == "ExtractionResult":
        from app.extractor.schemas import ExtractionResult

        return ExtractionResult
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
