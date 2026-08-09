"""PDF 清洗：官方 MinerU CLI（pipeline）解析 + 多模态分解。"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from app.cleaners.decomposer.engine import enrich_mineru_markdown
from app.cleaners.types import ParsedDoc

logger = logging.getLogger(__name__)

_MINERU_TIMEOUT_SEC = int(os.getenv("MINERU_TIMEOUT_SEC", "1200"))


def _parse_with_mineru_subprocess(pdf_path: Path) -> dict | None:
    """调用官方 mineru CLI（子进程隔离）。"""
    with tempfile.TemporaryDirectory(prefix="mineru_out_") as tmp:
        out_path = Path(tmp) / "result.json"
        cmd = [
            sys.executable,
            "-m",
            "app.cleaners.handlers.mineru_worker",
            str(pdf_path),
            str(out_path),
        ]
        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=_MINERU_TIMEOUT_SEC,
                cwd=str(Path(__file__).resolve().parents[3]),
                env={
                    **os.environ,
                    "PYTHONUTF8": "1",
                    "MINERU_MODEL_SOURCE": os.environ.get(
                        "MINERU_MODEL_SOURCE", "local"
                    ),
                    "MINERU_PDF_RENDER_THREADS": os.environ.get(
                        "MINERU_PDF_RENDER_THREADS", "1"
                    ),
                    "MINERU_PROCESSING_WINDOW_SIZE": os.environ.get(
                        "MINERU_PROCESSING_WINDOW_SIZE", "16"
                    ),
                    "OPENBLAS_NUM_THREADS": "1",
                    "OMP_NUM_THREADS": "1",
                    "MKL_NUM_THREADS": "1",
                    "TOKENIZERS_PARALLELISM": "false",
                },
            )
        except subprocess.TimeoutExpired:
            logger.error("MinerU 超时（>%ss）", _MINERU_TIMEOUT_SEC)
            return None
        except Exception as e:
            logger.warning("MinerU 子进程启动失败: %s", e)
            return None

        if not out_path.exists():
            logger.warning(
                "MinerU 无输出 (code=%s): %s",
                proc.returncode,
                (proc.stderr or proc.stdout or "")[-2000:],
            )
            return None

        payload = json.loads(out_path.read_text(encoding="utf-8"))
        if proc.returncode != 0 or payload.get("error"):
            logger.warning(
                "MinerU 失败 (code=%s): %s",
                proc.returncode,
                payload.get("error") or (proc.stderr or "")[-2000:],
            )
            return None
        return payload


def _enrich(md_content: str, pdf_path: Path, structured_items: list) -> ParsedDoc:
    result = enrich_mineru_markdown(md_content, pdf_path)
    if result.stats.get("total_images", 0) > 0:
        logger.info(
            "图片分解: %d 张已处理, %d 张失败, %.1fs",
            result.stats.get("processed", 0),
            result.stats.get("failed", 0),
            result.stats.get("elapsed_seconds", 0),
        )

    doc = ParsedDoc(
        source=pdf_path.name,
        file_type="pdf",
        content=result.enriched,
        structured_items=structured_items,
        stats=result.stats,
    )
    if result.stats.get("total_images", 0) > 0:
        doc.parse_warnings.append(
            f"多模态分解: {result.stats.get('processed', 0)}/"
            f"{result.stats.get('total_images', 0)} 张图片处理成功"
        )
    return doc


def parse_pdf(pdf_path: Path) -> ParsedDoc:
    """PDF 解析入口：官方 MinerU pipeline。"""
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF 文件不存在: {pdf_path}")

    payload = _parse_with_mineru_subprocess(pdf_path)
    if payload is None:
        raise RuntimeError(f"MinerU 解析失败: {pdf_path.name}")

    md_content = str(payload.get("markdown") or "").strip()
    if not md_content:
        raise RuntimeError(f"MinerU 解析失败: {pdf_path.name}（空输出）")

    structured_items = payload.get("structured_items") or []
    try:
        return _enrich(md_content, pdf_path, structured_items)
    except Exception as e:
        logger.warning("多模态分解失败，返回 MinerU 原始 Markdown: %s", e)
        return ParsedDoc(
            source=pdf_path.name,
            file_type="pdf",
            content=md_content,
            structured_items=structured_items,
            stats={},
            parse_warnings=[f"多模态分解失败: {e}"],
        )
