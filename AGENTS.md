# Project Instructions

## Tech Stack

- **Language**: Python 3.10–3.12（`my_project/pyproject.toml` 约束 `<3.13`）
- **API**: FastAPI + Pydantic v2 + uvicorn
- **Pipeline**: 官方 MinerU 3.x `pipeline` 后端（仅 PDF）、DashScope LLM 提取
- **Output**: 飞书 Card v2（`app/feishu/`）
- **Storage**: `DbTaskStore`（本地 SQLite / Compose Postgres）；`InMemoryTaskStore` 仅测试兜底
- **Frontend**: React + Vite（`frontend/`）

## Code Style

- 模块 docstring 用中文，说明职责
- 路由层薄：只做 HTTP 映射，业务在 `app/services/`
- Schema 放 `app/api/schemas/`，与 `app/extractor/schemas.py` 的 15 字段对齐
- 管线编排复用 `app/pipeline.py` 与 `PipelineService`，不在 router 里重复逻辑
- 错误：服务层抛 `TaskNotFoundError` / `TaskStateError` / `UploadValidationError`，router 转 HTTPException

## Testing

- 运行单元测试：`python -m pytest tests/ --ignore=tests/test_mineru.py`
- 集成/手工脚本（非 pytest）：`test_cleaner.py`、`test_decomposer.py`、`test_mineru.py`
- 测试文件命名：`test_*.py`
- API 手工验证：`uvicorn app.api.main:app --reload` → `http://127.0.0.1:8000/docs`

## Build & Run

- 安装 API 依赖：`pip install -r requirements-api.txt`
- 安装管线依赖：在 `my_project/` 用 uv/pip 按 `pyproject.toml`
- 启动 API：`uvicorn app.api.main:app --reload`
- 环境变量：`DASHSCOPE_API_KEY`（见 `app/config.py`）；飞书 Webhook 存库（「飞书通知」）

## Project Structure

```
app/
  api/           → FastAPI 入口、路由、schemas、deps
  cleaners/      → PDF 解析与多模态分解
  extractor/     → LLM 15 字段提取
  feishu/        → 卡片构建与 Webhook 发送
  services/      → TaskService、PipelineService、DbTaskStore
  pipeline.py    → CLI/API/Celery 共用编排
tests/           → 单元测试与集成脚本
my_project/      → uv 项目与 MinerU 重依赖
frontend/        → React + Vite 工作台
```

## API 契约（前端对接重点）

| 端点 | 用途 |
|------|------|
| `POST /upload` | 上传研报，返回 `task_id` + `poll_url` |
| `POST /upload/batch` | 批量上传 |
| `GET /tasks` | 历史列表（`q` 搜索、`status` 筛选） |
| `GET /tasks/{id}` | 轮询任务状态 |
| `GET /tasks/{id}/content` | 清洗后 Markdown 原文 |
| `GET /tasks/{id}/result` | 固定 `ExtractionResult` |
| `GET /tasks/{id}/file` | 下载原始文件 |
| `POST /tasks/{id}/confirm` | 用户改字段 + 选群 → 构建卡片并发送飞书 |
| `PUT /config/groups` | 飞书群配置 |

任务状态机：`queued → parsing → extracting → pending_confirm → sending → sent | failed`

## Conventions

- 确认发送：`TaskService.confirm` → 库内群 Webhook → Card v2；失败可重试
- CORS 已在 `app/api/main.py` 配置 Vite 开发源
