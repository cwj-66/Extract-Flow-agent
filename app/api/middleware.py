"""上传入口保护：在读取 multipart 请求体前检查提交频率。"""

from __future__ import annotations

import asyncio
import logging

from redis.exceptions import RedisError
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.services.rate_limit import UploadRateLimiter

logger = logging.getLogger(__name__)


class UploadRateLimitMiddleware:
    """仅限制新任务提交；状态查询、原文审阅与历史浏览继续可用。"""

    def __init__(self, app: ASGIApp, *, limiter: UploadRateLimiter) -> None:
        self.app = app
        self.limiter = limiter

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        # 纯 ASGI 中间件不预读请求体。
        # https://www.starlette.io/middleware/#pure-asgi-middleware
        path = scope.get("path", "")
        root = scope.get("root_path", "")
        if root and path.startswith(root + "/"):
            path = path[len(root):]
        if scope["type"] != "http" or scope["method"] != "POST" or path.rstrip("/") not in {"/upload", "/upload/batch"}:
            await self.app(scope, receive, send)
            return
        request = Request(scope)
        # 线上 Nginx 已验证 portfolio_session；不能用可编辑的 X-User-Id。
        visitor = request.cookies.get("portfolio_session", "")
        # client 来自 Uvicorn 的可信代理链，不自行读取可伪造的转发头。
        ip = request.client.host if request.client else "unknown"
        try:
            retry = await asyncio.wait_for(self.limiter.check(visitor, ip), timeout=2)
        except (RedisError, TimeoutError):
            logger.warning("上传限流存储暂不可用")
            response = JSONResponse(
                {"detail": "上传服务暂时繁忙，请 10 秒后重试"}, status_code=503,
                headers={"Retry-After": "10"},
            )
        else:
            if retry == 0:
                await self.app(scope, receive, send)
                return
            response = JSONResponse(
                {"detail": f"提交过于频繁，请 {retry} 秒后重试"}, status_code=429,
                headers={"Retry-After": str(retry)},
            )
        await response(scope, receive, send)
