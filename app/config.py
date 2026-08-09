"""全局配置：API 密钥、多模态分解开关等。"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class Settings:
    """应用全局配置项，从环境变量读取。"""
    DASHSCOPE_API_KEY: str = os.getenv("DASHSCOPE_API_KEY", "")
    DASHSCOPE_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"

    DECOMPOSER_ENABLED: bool = os.getenv("DECOMPOSER_ENABLED", "true").lower() == "true"
    DECOMPOSER_BATCH_SIZE: int = int(os.getenv("DECOMPOSER_BATCH_SIZE", "5"))
    # 同时跑解析+提取的任务数上限
    PIPELINE_CONCURRENCY: int = int(os.getenv("PIPELINE_CONCURRENCY", "3"))
    # 本地默认 SQLite；Compose 注入 Postgres
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/app.db")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
    # true=Celery+Redis；false=进程内 TaskQueue
    USE_CELERY: bool = os.getenv("USE_CELERY", "false").lower() == "true"


settings = Settings()
