"""提取结果与可观测元数据的拆装（存入库 JSON，不污染 15 字段）。"""

from __future__ import annotations

from typing import Any

META_KEY = "_meta"


def attach_meta(fields: dict[str, Any], meta: dict[str, Any] | None) -> dict[str, Any]:
    """把 evidence / metrics 挂到字段字典上，供持久化。"""
    out = dict(fields)
    if meta:
        out[META_KEY] = meta
    else:
        out.pop(META_KEY, None)
    return out


def split_meta(data: dict[str, Any] | None) -> tuple[dict[str, Any], dict[str, Any]]:
    """拆出业务字段与 _meta；缺省时 meta 为空字典。"""
    if not data:
        return {}, {}
    out = dict(data)
    meta = out.pop(META_KEY, None)
    if not isinstance(meta, dict):
        meta = {}
    return out, meta
