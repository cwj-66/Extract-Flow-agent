"""FastAPI 应用入口。"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.deps import get_task_queue
from app.api.routers import batches, config, health, tasks, upload
from app.db import init_db


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    queue = get_task_queue()
    queue.start()
    try:
        yield
    finally:
        await queue.stop()


app = FastAPI(
    title="萃报 API",
    description="券商研报摘要：上传 → 提取 → 确认 → 飞书发送",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(upload.router)
app.include_router(batches.router)
app.include_router(tasks.router)
app.include_router(config.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "service": "萃报 API",
        "status": "ok",
        "health": "/health",
        "docs": "/docs",
    }
