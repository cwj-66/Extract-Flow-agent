"""Celery 应用：Redis 作 broker / result backend。"""

from __future__ import annotations

from celery import Celery

from app.config import settings

celery_app = Celery(
    "extract_flow",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    task_track_started=True,
    worker_prefetch_multiplier=1,
    timezone="UTC",
    enable_utc=True,
)
