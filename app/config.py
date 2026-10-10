"""全局配置：API 密钥、多模态分解开关等。"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class Settings:
    """应用全局配置项，从环境变量读取。"""
    DASHSCOPE_API_KEY: str = os.getenv("DASHSCOPE_API_KEY", "")
    DASHSCOPE_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    DASHSCOPE_MODEL: str = os.getenv("DASHSCOPE_MODEL", "qwen3.8-27b")
    LLM_REQUEST_TIMEOUT_SEC: float = float(os.getenv("LLM_REQUEST_TIMEOUT_SEC", "90"))
    LLM_MAX_RETRIES: int = int(os.getenv("LLM_MAX_RETRIES", "2"))

    # 云端模式无需安装 MinerU 模型；local 保留原有子进程解析入口。
    MINERU_MODE: str = os.getenv("MINERU_MODE", "cloud")
    MINERU_API_TOKEN: str = os.getenv("MINERU_API_TOKEN", "")
    MINERU_API_BASE_URL: str = os.getenv("MINERU_API_BASE_URL", "https://mineru.net")
    MINERU_MODEL_VERSION: str = os.getenv("MINERU_MODEL_VERSION", "vlm")
    MINERU_LANGUAGE: str = os.getenv("MINERU_LANGUAGE", "ch")
    MINERU_TIMEOUT_SEC: float = float(os.getenv("MINERU_TIMEOUT_SEC", "1200"))
    MINERU_REQUEST_TIMEOUT_SEC: float = float(os.getenv("MINERU_REQUEST_TIMEOUT_SEC", "60"))
    MINERU_POLL_INTERVAL_SEC: float = float(os.getenv("MINERU_POLL_INTERVAL_SEC", "3"))

    DECOMPOSER_ENABLED: bool = os.getenv("DECOMPOSER_ENABLED", "true").lower() == "true"
    DECOMPOSER_BATCH_SIZE: int = int(os.getenv("DECOMPOSER_BATCH_SIZE", "5"))
    # 同时跑解析+提取的任务数上限
    PIPELINE_CONCURRENCY: int = int(os.getenv("PIPELINE_CONCURRENCY", "3"))
    PIPELINE_MAX_PENDING: int = int(os.getenv("PIPELINE_MAX_PENDING", "10"))
    UPLOAD_RATE_LIMIT_ENABLED: bool = os.getenv("UPLOAD_RATE_LIMIT_ENABLED", "false").lower() == "true"
    UPLOAD_VISITOR_PER_MINUTE: int = int(os.getenv("UPLOAD_VISITOR_PER_MINUTE", "5"))
    UPLOAD_IP_PER_MINUTE: int = int(os.getenv("UPLOAD_IP_PER_MINUTE", "30"))
    # 本地默认 SQLite；Compose 注入 Postgres
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/app.db")
    EXPORT_DIR: str = os.getenv("EXPORT_DIR", "data/exports")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
    # true=Celery+Redis；false=进程内 TaskQueue
    USE_CELERY: bool = os.getenv("USE_CELERY", "false").lower() == "true"
    # DashScope 列表价近似（元 / 百万 token），用于工作台成本展示
    LLM_INPUT_CNY_PER_MILLION: float = float(os.getenv("LLM_INPUT_CNY_PER_MILLION", "3"))
    LLM_OUTPUT_CNY_PER_MILLION: float = float(os.getenv("LLM_OUTPUT_CNY_PER_MILLION", "12"))


settings = Settings()
