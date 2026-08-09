"""图片类型分类：根据上下文关键词判断图表或普通图片。"""

import logging
import re

from app.cleaners.decomposer.schemas import ImageType

logger = logging.getLogger(__name__)

_TYPE_RULES: list[tuple[re.Pattern, ImageType]] = [
    (re.compile(r"(?:图|Figure|Fig\.?|chart|graph|走势|趋势|曲线)", re.I), ImageType.CHART),
]


def classify_image(surrounding_text: str) -> ImageType:
    """按上下文关键词区分图表与普通图片。"""
    for pattern, img_type in _TYPE_RULES:
        if pattern.search(surrounding_text):
            return img_type
    return ImageType.UNKNOWN
