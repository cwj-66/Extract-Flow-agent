"""多模态分解的数据结构：图片引用、分解结果、富化后的 Markdown。"""

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path


class ImageType(str, Enum):
    CHART = "chart"        # 折线/柱状/饼图等数据可视化
    UNKNOWN = "unknown"    # 无法分类


@dataclass
class ImageRef:
    """解析后的 MinerU Markdown 图片引用。"""

    md_text: str            # 原始 "![](path)"
    raw_path: str           # MinerU 输出的相对路径
    resolved_path: Path     # 解析后的绝对路径
    byte_start: int         # 在原始 Markdown 中的起始偏移
    byte_end: int           # 在原始 Markdown 中的结束偏移
    surrounding_text: str   # 前后各 200 字符的上下文
    alt_text: str = ""      # Markdown 中的 alt 文本


@dataclass
class DecompositionResult:
    """单张图片的分解结果。"""

    ref: ImageRef
    image_type: ImageType
    description: str        # 生成的替换文本
    error: str | None = None


@dataclass
class EnrichedMarkdown:
    """分解器管道的输出。"""

    original: str                        # 原始 Markdown
    enriched: str                        # 所有 ![]() 被替换后的 Markdown
    results: list[DecompositionResult] = field(default_factory=list)
    stats: dict = field(default_factory=dict)  # 处理统计
