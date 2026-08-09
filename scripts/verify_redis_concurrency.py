"""验证 Redis + Celery 并发：同时投递多个 demo.sleep，看墙钟时间与 worker pid。

用法（先起 Redis 与 worker）:
  docker compose up -d redis
  # Windows 用 threads；Linux/macOS 可省略 --pool（默认 prefork）
  celery -A app.celery_app worker --loglevel=info --concurrency=3 --pool=threads
  python scripts/verify_redis_concurrency.py
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import settings
from app.workers.tasks import demo_sleep


def main() -> None:
    try:
        import redis

        client = redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        assert client.ping()
        client.close()
    except Exception as exc:  # noqa: BLE001
        print(f"[FAIL] Redis 连不上 ({settings.REDIS_URL}): {exc}")
        print("先执行: docker compose up -d redis")
        sys.exit(1)

    n = 6
    sleep_s = 2.0
    print(f"Redis OK: {settings.REDIS_URL}")
    print(f"投递 {n} 个任务，每个 sleep {sleep_s}s")
    print("若 worker --concurrency=3，墙钟应约 4s（两批），而不是 12s（串行）")
    print("-" * 50)

    started = time.perf_counter()
    async_results = [demo_sleep.delay(sleep_s, f"job-{i}") for i in range(n)]
    results = [r.get(timeout=60) for r in async_results]
    wall = time.perf_counter() - started

    pids = sorted({r["worker_pid"] for r in results})
    print(f"墙钟时间: {wall:.2f}s")
    print(f"参与 worker pid: {pids}（共 {len(pids)} 个进程）")
    for r in results:
        print(f"  {r['label']}: pid={r['worker_pid']} elapsed={r['elapsed']}s")

    # 串行下限约 n*sleep；并发=3 时期望 < (n/3+1)*sleep 的宽松上限
    if wall < n * sleep_s * 0.7:
        print("[OK] 墙钟明显短于串行，Redis 并发队列生效")
        sys.exit(0)

    print("[WARN] 墙钟接近串行：检查 worker 是否已启动，以及 --concurrency 是否 >1")
    sys.exit(2)


if __name__ == "__main__":
    main()
