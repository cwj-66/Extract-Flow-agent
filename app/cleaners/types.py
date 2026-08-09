"""清洗模块公共数据类型。"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ParsedDoc:
    """单文件清洗合并后的结果。"""

    source: str
    file_type: str
    content: str                 # 合并后的完整 Markdown（表格 HTML + 公式 LaTeX + 图片描述已嵌入）
    structured_items: list[dict] = field(default_factory=list)  # MinerU content_list 原始结构化数据
    parse_warnings: list[str] = field(default_factory=list)
    stats: dict = field(default_factory=dict)
