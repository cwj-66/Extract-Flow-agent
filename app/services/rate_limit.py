"""Redis 原子双维度限流：访客与 IP 共用提交窗口，失败时关闭上传入口。"""

from __future__ import annotations

import hashlib
import math

from redis.asyncio import Redis

from app.config import Settings

# Redis EVAL 将检查与计数放在一个原子操作中，拒绝时不延长窗口。
# https://redis.io/docs/latest/develop/programmability/eval-intro/
_LIMIT_SCRIPT = """
local retry = 0
for i, key in ipairs(KEYS) do
    local count = tonumber(redis.call('GET', key) or '0')
    if count >= tonumber(ARGV[i + 1]) then
        retry = math.max(retry, redis.call('PTTL', key), 1)
    end
end
if retry > 0 then return retry end
for _, key in ipairs(KEYS) do
    local count = redis.call('INCR', key)
    if count == 1 then redis.call('PEXPIRE', key, ARGV[1]) end
end
return 0
"""


class UploadRateLimiter:
    """复用异步连接池，键中仅保存身份摘要；窗口从首次提交开始计时。"""

    def __init__(self, config: Settings, *, redis: Redis | None = None,
                 prefix: str = "extract-flow:upload") -> None:
        if min(config.UPLOAD_VISITOR_PER_MINUTE, config.UPLOAD_IP_PER_MINUTE) < 1:
            raise ValueError("upload rate limits must be positive")
        self._redis = redis or Redis.from_url(
            config.REDIS_URL, socket_connect_timeout=1, socket_timeout=1,
            max_connections=20, retry_on_timeout=False,
        )
        self._visitor_limit = config.UPLOAD_VISITOR_PER_MINUTE
        self._ip_limit = config.UPLOAD_IP_PER_MINUTE
        self._prefix = prefix

    async def check(self, visitor: str, ip: str) -> int:
        """返回建议等待秒数；0 表示可继续，Redis 故障交由入口返回 503。"""
        keys = [self._key("ip", ip)]
        limits = [self._ip_limit]
        if visitor:
            keys.append(self._key("visitor", visitor))
            limits.append(self._visitor_limit)
        retry_ms = await self._redis.eval(_LIMIT_SCRIPT, len(keys), *keys, 60_000, *limits)
        return math.ceil(int(retry_ms) / 1000)

    def _key(self, kind: str, identity: str) -> str:
        digest = hashlib.sha256(identity.encode()).hexdigest()
        return f"{self._prefix}:{kind}:{digest}"

    async def close(self) -> None:
        # https://redis.readthedocs.io/en/stable/examples/asyncio_examples.html
        await self._redis.aclose()
