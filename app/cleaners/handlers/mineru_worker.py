"""MinerU 官方 do_parse 入口（pipeline / CPU）。

参考：
- https://opendatalab.github.io/MinerU/quick_start/
- mineru.cli.common.do_parse
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import traceback
from pathlib import Path


def _prepare_env() -> None:
    """官方推荐的稳定性环境变量（Windows CPU）。"""
    os.environ.setdefault("PYTHONUTF8", "1")
    os.environ.setdefault("MINERU_MODEL_SOURCE", "local")
    os.environ.setdefault("MINERU_PDF_RENDER_THREADS", "1")
    os.environ.setdefault("MINERU_PDF_RENDER_TIMEOUT", "600")
    os.environ.setdefault("MINERU_PROCESSING_WINDOW_SIZE", "16")
    os.environ.setdefault("MINERU_API_MAX_CONCURRENT_REQUESTS", "1")
    os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    os.environ.setdefault("MKL_NUM_THREADS", "1")
    os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")


def _find_markdown(output_dir: Path, stem: str) -> Path | None:
    preferred = list(output_dir.rglob(f"{stem}.md"))
    if preferred:
        return preferred[0]
    any_md = sorted(output_dir.rglob("*.md"))
    return any_md[0] if any_md else None


def _find_content_list(md_path: Path) -> list:
    for cand in md_path.parent.glob("*content_list*.json"):
        try:
            data = json.loads(cand.read_text(encoding="utf-8"))
            return data if isinstance(data, list) else []
        except Exception:
            continue
    return []


def _parse(pdf_path: Path) -> dict:
    _prepare_env()

    from mineru.cli.common import do_parse
    from mineru.utils.enum_class import MakeMode

    pdf_bytes = pdf_path.read_bytes()
    stem = pdf_path.stem

    with tempfile.TemporaryDirectory(prefix="mineru_do_parse_") as tmp:
        out_dir = Path(tmp) / "out"
        out_dir.mkdir(parents=True, exist_ok=True)

        # 官方 Python API：pipeline 后端（纯 CPU）
        do_parse(
            output_dir=str(out_dir),
            pdf_file_names=[stem],
            pdf_bytes_list=[pdf_bytes],
            p_lang_list=["ch"],
            backend="pipeline",
            parse_method="auto",
            formula_enable=True,
            table_enable=True,
            f_draw_layout_bbox=False,
            f_draw_span_bbox=False,
            f_dump_md=True,
            f_dump_middle_json=False,
            f_dump_model_output=False,
            f_dump_orig_pdf=False,
            f_dump_content_list=True,
            f_make_md_mode=MakeMode.MM_MD,
        )

        md_path = _find_markdown(out_dir, stem)
        if md_path is None:
            raise RuntimeError(f"mineru do_parse 未产出 markdown，输出目录: {out_dir}")
        markdown = md_path.read_text(encoding="utf-8")
        if not markdown.strip():
            raise RuntimeError("mineru markdown 为空")
        return {
            "markdown": markdown,
            "structured_items": _find_content_list(md_path),
        }


def main() -> int:
    if len(sys.argv) != 3:
        print(
            "usage: python -m app.cleaners.handlers.mineru_worker <pdf> <out.json>",
            file=sys.stderr,
        )
        return 2
    pdf_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    try:
        result = _parse(pdf_path)
        out_path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
        return 0
    except Exception:
        out_path.write_text(
            json.dumps({"error": traceback.format_exc()}, ensure_ascii=False),
            encoding="utf-8",
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
