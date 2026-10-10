"""接入现有作品集：备份文件、添加第三个作品与受保护的萃报入口。"""

from __future__ import annotations

import ast
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def replace_once(text: str, old: str, new: str) -> str:
    """只修改已核对的唯一标记；结构变化时停止接入。"""
    if text.count(old) != 1:
        raise RuntimeError(f"作品集源码标记不唯一：{old[:80]}")
    return text.replace(old, new, 1)


def main(
    portfolio: Path = Path("/opt/chenwj-portfolio"),
    nginx: Path = Path("/etc/nginx/sites-available/game-support-demo"),
) -> None:
    """在应用健康后接入页面与代理，出错时恢复修改前文件。"""
    source = Path(__file__).resolve().parent
    public = portfolio / "public"
    home_file, app_file, server_file = (
        public / "index.html",
        public / "portfolio-assets/app.js",
        portfolio / "server.py",
    )
    home = home_file.read_text(encoding="utf-8")
    fragment = (source / "portfolio/home-slide.html").read_text(encoding="utf-8")
    stage_end = '</div><button class="nav-arrow previous screen-arrow"'
    slide_start = '<section class="home-slide screen-slide extract"'
    if slide_start in home:
        start = home.index(slide_start)
        home = home[:start] + home[home.index(stage_end, start):]
    home = replace_once(home, stage_end, fragment + stage_end)
    tab = '<button data-slide-to="2" aria-label="选择萃报研报工作台" aria-current="false"></button>'
    if 'data-slide-to="2"' not in home:
        anchor = 'data-slide-to="1" aria-label="选择游戏客服项目" aria-current="false"></button>'
        home = replace_once(home, anchor, anchor + tab)
    home = home.replace('data-slide-count>01 / 02', 'data-slide-count>01 / 03')
    app = app_file.read_text(encoding="utf-8").replace("^#work-[1-2]$", "^#work-[1-3]$")
    server = server_file.read_text(encoding="utf-8")
    if "'/projects/extract-flow/'" not in server:
        server = replace_once(server, "PAGES = {'/': 'index.html',", "PAGES = {'/': 'index.html', '/projects/extract-flow/': 'extract-flow.html',")
    ast.parse(server)
    nginx_text = nginx.read_text(encoding="utf-8")
    include = f"    include {source / 'nginx-extract-flow.conf'};"
    if include not in nginx_text:
        nginx_text = replace_once(nginx_text, "    location = /_portfolio_auth {", include + "\n\n    location = /_portfolio_auth {")
    files = {
        home_file: home,
        app_file: app,
        server_file: server,
        nginx: nginx_text,
        public / "extract-flow.html": (source / "portfolio/extract-flow.html").read_text(encoding="utf-8"),
        public / "portfolio-assets/extract-flow.css": (source / "portfolio/extract-flow.css").read_text(encoding="utf-8"),
    }
    backup = portfolio / "backups" / ("extract-flow-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ"))
    backup.mkdir(parents=True)
    originals: dict[Path, Path | None] = {}
    for index, target in enumerate(files):
        saved = backup / f"{index}-{target.name}"
        originals[target] = saved if target.exists() else None
        if target.exists():
            shutil.copy2(target, saved)
    (backup / "manifest.txt").write_text("\n".join(f"{target}\t{saved or 'NEW'}" for target, saved in originals.items()), encoding="utf-8")
    try:
        for target, content in files.items():
            target.write_text(content, encoding="utf-8")
        subprocess.run(["nginx", "-t"], check=True)
        subprocess.run(["systemctl", "restart", "chenwj-portfolio"], check=True)
        subprocess.run(["systemctl", "reload", "nginx"], check=True)
    except (OSError, subprocess.CalledProcessError):
        for target, saved in originals.items():
            if saved is not None:
                shutil.copy2(saved, target)
            else:
                target.unlink(missing_ok=True)
        subprocess.run(["systemctl", "restart", "chenwj-portfolio"], check=False)
        subprocess.run(["systemctl", "reload", "nginx"], check=False)
        raise
    print(f"作品集接入完成；备份目录：{backup}")


if __name__ == "__main__":
    main()
