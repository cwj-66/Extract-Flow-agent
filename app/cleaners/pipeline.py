"""清洗管线入口：串联文档解析与多模态处理。"""

from __future__ import annotations

import logging
from pathlib import Path

from app.cleaners.types import ParsedDoc

logger = logging.getLogger(__name__)


def process_pdf(pdf_path: Path) -> ParsedDoc:
    """解析 PDF 并返回清洗后的 ParsedDoc。"""
    from app.cleaners.handlers.pdf import parse_pdf

    logger.info("开始处理: %s", pdf_path.name)
    doc = parse_pdf(pdf_path)
    logger.info("处理完成: %s (%d 字符)", pdf_path.name, len(doc.content))
    return doc
