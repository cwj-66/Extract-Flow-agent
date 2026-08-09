"""下载 MinerU / magic-pdf 所需模型到本地，并更新 magic-pdf.json。"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from modelscope import snapshot_download

ROOT = Path(__file__).resolve().parents[1]
LOCAL_MODELS = ROOT / ".magic-pdf-models"


def find_config() -> Path:
    candidates = [Path.home() / "magic-pdf.json", ROOT / "magic-pdf.json"]
    for p in candidates:
        if p.exists():
            return p
    users = Path("C:/Users")
    if users.exists():
        for child in users.iterdir():
            cfg = child / "magic-pdf.json"
            if cfg.is_file():
                return cfg
    return Path.home() / "magic-pdf.json"


def main() -> int:
    LOCAL_MODELS.mkdir(parents=True, exist_ok=True)
    print(f"下载目录: {LOCAL_MODELS}", flush=True)

    # ModelScope 上仓库名大小写可能不同，依次尝试
    repo_ids = [
        "OpenDataLab/PDF-Extract-Kit-1.0",
        "opendatalab/PDF-Extract-Kit-1.0",
        "OpenDataLab/pdf-extract-kit-1.0",
    ]
    allow_patterns = [
        "models/Layout/LayoutLMv3/*",
        "models/Layout/YOLO/*",
        "models/MFD/YOLO/*",
        "models/MFR/unimernet_small/*",
        "models/TabRec/TableMaster/*",
        "models/TabRec/StructEqTable/*",
    ]

    kit_dir = None
    last_err = None
    for repo_id in repo_ids:
        try:
            print(f"开始下载 {repo_id} ...", flush=True)
            kit_dir = Path(
                snapshot_download(
                    repo_id,
                    local_dir=str(LOCAL_MODELS / "PDF-Extract-Kit-1.0"),
                    allow_patterns=allow_patterns,
                )
            )
            break
        except Exception as e:
            last_err = e
            print(f"失败: {repo_id}: {e}", flush=True)

    if kit_dir is None:
        print(f"ERROR: PDF-Extract-Kit 下载失败: {last_err}", file=sys.stderr)
        return 1

    models_dir = kit_dir / "models"
    if not models_dir.exists():
        # 有些镜像直接把 models 内容放在根目录
        maybe = kit_dir
        if (maybe / "MFD").exists() or (maybe / "Layout").exists():
            models_dir = maybe
        else:
            print(f"ERROR: 未找到 models 目录: {kit_dir}", file=sys.stderr)
            return 1

    print(f"models_dir: {models_dir}", flush=True)

    print("开始下载 layoutreader ...", flush=True)
    layout_repos = ["hantian/layoutreader", "AI-ModelScope/layoutreader"]
    layoutreader_dir = None
    for repo_id in layout_repos:
        try:
            layoutreader_dir = Path(
                snapshot_download(
                    repo_id,
                    local_dir=str(LOCAL_MODELS / "layoutreader"),
                )
            )
            break
        except Exception as e:
            print(f"layoutreader 失败: {repo_id}: {e}", flush=True)
    if layoutreader_dir is None:
        print("WARNING: layoutreader 下载失败，先继续配置主模型", flush=True)

    mfd = models_dir / "MFD" / "YOLO" / "yolo_v8_ft.pt"
    if not mfd.exists():
        # 列出已下载内容便于排查
        print("已下载文件:", flush=True)
        for p in models_dir.rglob("*"):
            if p.is_file():
                print(f"  {p.relative_to(models_dir)} ({p.stat().st_size})", flush=True)
        print(f"ERROR: 关键文件仍缺失: {mfd}", file=sys.stderr)
        return 1
    print(f"OK: {mfd} ({mfd.stat().st_size} bytes)", flush=True)

    cfg_path = find_config()
    data = {}
    if cfg_path.exists():
        data = json.loads(cfg_path.read_text(encoding="utf-8"))
    data["models-dir"] = str(models_dir.resolve())
    if layoutreader_dir is not None:
        data["layoutreader-model-dir"] = str(layoutreader_dir.resolve())
    data.setdefault("device-mode", "cpu")
    cfg_path.parent.mkdir(parents=True, exist_ok=True)
    cfg_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"已更新配置: {cfg_path}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
