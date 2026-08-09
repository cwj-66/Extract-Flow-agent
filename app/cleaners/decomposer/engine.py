"""分解引擎：扫描 Markdown 图片引用，分类后调用 VLM 生成描述并替换。"""

from __future__ import annotations

import concurrent.futures
import logging
import re
import time
from pathlib import Path

from app.config import settings
from app.cleaners.decomposer.schemas import (
    DecompositionResult,
    EnrichedMarkdown,
    ImageRef,
    ImageType,
)

logger = logging.getLogger(__name__)

_IMAGE_REF_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
_CONTEXT_WINDOW = 200


def _resolve_image_path(raw_path: str, pdf_path: Path) -> Path | None:
    """将 MinerU 输出的相对图片路径解析为绝对路径。"""
    candidates: list[Path] = []
    base = pdf_path.parent.resolve()
    raw_normalized = raw_path.replace("\\", "/")
    fname = Path(raw_path).name
    stem = pdf_path.stem

    candidates.append(base / raw_path)
    candidates.append(base / raw_normalized)

    stripped = re.sub(r"^\./", "", raw_normalized)
    if stripped != raw_normalized:
        candidates.append(base / stripped)

    img_dirs = [
        base / f".mineru_cache/{stem}",
        base / f".mineru_cache/{stem}/images",
        base / f"{stem}",
        base / f"{stem}/images",
    ]
    for d in img_dirs:
        candidates.append(d / fname)

    if ".mineru_cache/" not in raw_normalized:
        candidates.append(base / f".mineru_cache/{raw_normalized}")
    else:
        no_cache = raw_normalized.replace(".mineru_cache/", "")
        candidates.append(base / no_cache)

    seen = set()
    for c in candidates:
        try:
            norm = c.resolve()
            if norm.exists() and norm not in seen:
                seen.add(norm)
                return norm
        except (OSError, RuntimeError):
            continue

    logger.warning("图片文件未找到: %s (在 %s 下尝试了 %d 种路径)", raw_path, base, len(candidates))
    return None


def _extract_context(markdown: str, byte_start: int, byte_end: int) -> str:
    """提取图片引用前后的文本上下文（各约 200 字符）。"""
    start = max(0, byte_start - _CONTEXT_WINDOW)
    end = min(len(markdown), byte_end + _CONTEXT_WINDOW)
    return markdown[start:end].strip()


def _parse_image_refs(markdown: str, pdf_path: Path) -> list[ImageRef]:
    """从 Markdown 中提取所有图片引用并解析路径。"""
    refs: list[ImageRef] = []
    for match in _IMAGE_REF_RE.finditer(markdown):
        alt = match.group(1)
        raw = match.group(2)
        resolved = _resolve_image_path(raw, pdf_path)
        ctx = _extract_context(markdown, match.start(), match.end())
        refs.append(ImageRef(
            md_text=match.group(0),
            raw_path=raw,
            resolved_path=resolved,
            byte_start=match.start(),
            byte_end=match.end(),
            surrounding_text=ctx,
            alt_text=alt,
        ))
    return refs


def _process_single_image(ref: ImageRef) -> DecompositionResult:
    """处理单张图片：分类 → 专用处理器。"""
    from app.cleaners.decomposer.classifiers import classify_image
    from app.cleaners.decomposer.processors import dispatch_processor
    from openai import OpenAI

    client = OpenAI(
        api_key=settings.DASHSCOPE_API_KEY,
        base_url=settings.DASHSCOPE_BASE_URL,
    )

    if ref.resolved_path is None or not ref.resolved_path.exists():
        return DecompositionResult(
            ref=ref,
            image_type=ImageType.UNKNOWN,
            description=f"[图片: {Path(ref.raw_path).name}]",
        )

    img_type = classify_image(ref.surrounding_text)

    try:
        description = dispatch_processor(img_type, ref.resolved_path, client)
        return DecompositionResult(
            ref=ref,
            image_type=img_type,
            description=description,
        )
    except Exception as e:
        logger.warning("图片处理失败: %s — %s", ref.raw_path, e)
        return DecompositionResult(
            ref=ref,
            image_type=ImageType.UNKNOWN,
            description=f"[图片: {ref.resolved_path.name}]",
            error=str(e),
        )


def enrich_mineru_markdown(
    markdown: str,
    pdf_path: Path,
) -> EnrichedMarkdown:
    """用 VLM 描述替换 Markdown 中的图片引用（表格/公式已由 MinerU 嵌入，不在此处理）。"""
    t0 = time.perf_counter()

    if not settings.DECOMPOSER_ENABLED:
        return EnrichedMarkdown(
            original=markdown,
            enriched=markdown,
            stats={"skipped": True},
        )

    refs = _parse_image_refs(markdown, pdf_path)
    if not refs:
        return EnrichedMarkdown(
            original=markdown,
            enriched=markdown,
            stats={"total_images": 0, "elapsed_seconds": 0},
        )

    logger.info("发现 %d 张图片，开始多模态分解...", len(refs))

    max_workers = min(settings.DECOMPOSER_BATCH_SIZE, len(refs))
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_process_single_image, ref): ref for ref in refs}
        results: list[DecompositionResult] = []
        for future in concurrent.futures.as_completed(futures):
            results.append(future.result())

    ref_index = {id(r): i for i, r in enumerate(refs)}
    results.sort(key=lambda r: ref_index.get(id(r.ref), 0))

    enriched = markdown
    for result in results:
        ref = result.ref
        enriched = enriched[:ref.byte_start] + result.description + enriched[ref.byte_end:]

    elapsed = time.perf_counter() - t0
    stats = {
        "total_images": len(refs),
        "processed": sum(1 for r in results if not r.error),
        "failed": sum(1 for r in results if r.error),
        "elapsed_seconds": round(elapsed, 2),
    }
    logger.info(
        "分解完成: %d 张已处理, %d 张失败, %.1fs",
        stats["processed"], stats["failed"], elapsed,
    )

    return EnrichedMarkdown(
        original=markdown,
        enriched=enriched,
        results=results,
        stats=stats,
    )
