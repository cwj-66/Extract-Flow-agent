"""健康检查。"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.config import settings

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, Any]:
    """服务存活 + Redis 连通性。"""
    redis_ok = False
    redis_error: str | None = None
    try:
        import redis

        client = redis.from_url(settings.REDIS_URL, socket_connect_timeout=1.5)
        redis_ok = bool(client.ping())
        client.close()
    except Exception as exc:  # noqa: BLE001 — 健康检查需吞掉连接错误
        redis_error = str(exc)

    status = "ok" if redis_ok or not settings.USE_CELERY else "degraded"
    body: dict[str, Any] = {
        "status": status,
        "queue": "celery" if settings.USE_CELERY else "inprocess",
        "redis": {"ok": redis_ok, "url": settings.REDIS_URL},
    }
    if redis_error:
        body["redis"]["error"] = redis_error
    return body
