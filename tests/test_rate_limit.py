"""验证入口早期拒绝、身份来源以及真实 Redis 的并发原子计数。"""

import asyncio
import json
import os
from dataclasses import replace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from redis.asyncio import Redis
from redis.exceptions import ConnectionError

from app.api.middleware import UploadRateLimitMiddleware
from app.config import settings
from app.services.rate_limit import UploadRateLimiter


@pytest.mark.parametrize("retry,error,status", [(42, None, 429), (0, ConnectionError(), 503)])
def test_reject_before_reading_body(retry, error, status):
    async def scenario():
        limiter = MagicMock(check=AsyncMock(return_value=retry, side_effect=error))
        downstream = AsyncMock()
        middleware = UploadRateLimitMiddleware(downstream, limiter=limiter)
        receive = AsyncMock(side_effect=AssertionError("must not read multipart body"))
        send = AsyncMock()
        scope = {
            "type": "http", "method": "POST", "path": "/extract-flow/api/upload/batch",
            "root_path": "/extract-flow/api", "client": ("203.0.113.1", 4321),
            "headers": [(b"cookie", b"portfolio_session=session"),
                        (b"x-user-id", b"fake"), (b"x-forwarded-for", b"spoofed")],
        }
        await middleware(scope, receive, send)
        limiter.check.assert_awaited_once_with("session", "203.0.113.1")
        downstream.assert_not_awaited()
        receive.assert_not_awaited()
        start = send.call_args_list[0].args[0]
        assert start["status"] == status
        assert dict(start["headers"])[b"retry-after"] == (b"42" if status == 429 else b"10")
        assert "重试" in json.loads(send.call_args_list[1].args[0]["body"])["detail"]
    asyncio.run(scenario())


def test_reads_and_non_uploads_bypass_limiter():
    async def scenario():
        limiter = MagicMock(check=AsyncMock())
        downstream = AsyncMock()
        middleware = UploadRateLimitMiddleware(downstream, limiter=limiter)
        for method, path in [("GET", "/tasks"), ("POST", "/tasks/task/confirm"), ("GET", "/health")]:
            await middleware({"type": "http", "method": method, "path": path}, AsyncMock(), AsyncMock())
        assert downstream.await_count == 3
        limiter.check.assert_not_awaited()
    asyncio.run(scenario())


def test_identity_is_hashed_and_no_session_uses_ip():
    async def scenario():
        redis = MagicMock(eval=AsyncMock(return_value=0))
        limiter = UploadRateLimiter(settings, redis=redis)
        assert await limiter.check("secret-cookie", "203.0.113.4") == 0
        args = redis.eval.call_args.args
        assert args[1] == 2
        assert "secret-cookie" not in str(args)
        assert "203.0.113.4" not in str(args)
        await limiter.check("", "203.0.113.4")
        assert redis.eval.call_args.args[1] == 1
    asyncio.run(scenario())


@pytest.mark.skipif(not os.getenv("REDIS_TEST_URL"), reason="requires isolated real Redis test connection")
def test_real_redis_atomic_concurrency_and_independent_ip_limit():
    async def scenario():
        redis = Redis.from_url(os.environ["REDIS_TEST_URL"])
        prefix = f"extract-flow:test:{uuid4()}"
        limiter = UploadRateLimiter(replace(settings, UPLOAD_VISITOR_PER_MINUTE=5,
                                           UPLOAD_IP_PER_MINUTE=30), redis=redis, prefix=prefix)
        try:
            results = await asyncio.gather(*(limiter.check("visitor", "ip") for _ in range(50)))
            assert results.count(0) == 5
            assert all(1 <= r <= 60 for r in results if r)
            assert int(await redis.get(limiter._key("ip", "ip"))) == 5
            assert int(await redis.get(limiter._key("visitor", "visitor"))) == 5
            # 新会话不能突破共享 IP 的限制。
            results = await asyncio.gather(*(limiter.check(str(i), "other-ip") for i in range(50)))
            assert results.count(0) == 30
            assert int(await redis.get(limiter._key("ip", "other-ip"))) == 30
            ttl = await redis.ttl(limiter._key("ip", "other-ip"))
            assert 0 < ttl <= 60
            # 实际验证窗口到期后恢复，不等待整分钟。
            await redis.pexpire(limiter._key("ip", "other-ip"), 1)
            await asyncio.sleep(0.02)
            assert await limiter.check("fresh", "other-ip") == 0
        finally:
            keys = [key async for key in redis.scan_iter(match=f"{prefix}:*")]
            if keys:
                await redis.delete(*keys)
            await limiter.close()
    asyncio.run(scenario())
