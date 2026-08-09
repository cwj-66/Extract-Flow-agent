# 萃报

券商研报摘要与飞书推送工作台。  
以 **MinerU 文档解析 + DashScope LLM 提取** 为管线核心，完成 PDF 清洗、结构化字段抽取、人工确认与飞书 Card v2 推送，前后端为 **React + FastAPI + Docker Compose**。

## 项目简介

这个项目不是简单文件转换工具，也不是一次性 LLM 问答 Demo，而是一个更贴近真实投研场景的小型自动化系统：

- 用户可以上传 PDF 研报，或批量提交多份 PDF
- 系统自动完成版面解析、表格 / 图表分路处理，输出结构化 Markdown
- 基于 DashScope 提取默认 15 个研报字段，支持自定义扩展与分组
- 用户在 Web 工作台预览、编辑字段，确认后推送飞书卡片
- 同时提供 CLI 一键跑通，供本地调试与脚本集成

## 核心亮点

- 真实场景驱动：围绕「券商研报摘要 + 飞书推送」设计业务流程，而不是泛化聊天
- 成本可控的解析管线：解析、OCR、表格识别、图片过滤在本地完成，仅 LLM 提取消耗 API
- PDF 接入：MinerU 清洗 → 合并 → 提取链路
- 多模态内容分解：表格、图表、装饰图分路处理，减少噪声进入 LLM
- 固定提取契约：与 `ExtractionResult` 对齐的研报字段，前端可编辑后确认发送
- 完整任务状态机：上传 → 解析 → 提取 → 待确认 → 发送，支持轮询与批量追踪
- 前后端分离：`FastAPI` 后端 + `React + Vite` 前端，OpenAPI 契约清晰
- Docker 一键启动：`docker compose up -d` 拉起 Postgres / Redis / 后端 / 前端

## 技术栈

- Python 3.10 – 3.12
- FastAPI · Pydantic v2 · uvicorn
- MinerU 3.x（`pipeline` 后端）
- 阿里云 DashScope（OpenAI 兼容接口）
- 飞书 Card v2 Webhook
- React 19 · Vite · Tailwind CSS · Zustand
- Docker Compose · Postgres · Redis · Nginx

## 系统流程

### 主流程

1. **文档接入**：仅接受 PDF，走 MinerU 解析
2. **版面解析与区域路由**：区分正文、表格、图表、装饰图，不同类型走不同处理链路
3. **分类型处理**：正文本地提取、表格转 Markdown、图表裁剪后送 VLM 描述、装饰图过滤丢弃
4. **合并结构化内容**：统一输出干净 Markdown，供 LLM 使用
5. **LLM 字段提取**：按 JSON Schema 约束输出研报字段（默认 15 项）
6. **卡片渲染**：构建飞书 Card v2，支持分组表格与标题字段
7. **确认发送**：用户编辑字段、选择目标群，Webhook 推送飞书

### 任务状态机

```
queued → parsing → extracting → pending_confirm → sending → sent | failed
```

### 成本控制要点

- 仅 **LLM 提取** 环节消耗 API Token
- 解析、OCR、表格识别、图片哈希去重均在本地完成
- 装饰图、水印、无关内容在进 LLM 前尽量滤净，降低输入 Token 量

### 默认提取字段（15 项）

`company_name` · `stock_code` · `report_period` · `revenue` · `net_profit` · `roe` · `total_assets` · `net_assets` · `rating` · `profit_forecast_2026E` · `profit_forecast_2027E` · `profit_forecast_2028E` · `business_highlights` · `core_logic` · `risks`

字段定义见 [`app/extractor/schemas.py`](app/extractor/schemas.py)。

## 项目结构

```text
.
├── README.md
├── AGENTS.md
├── requirements-api.txt
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── main.py                     # CLI 入口
├── app/
│   ├── api/                    # FastAPI 路由、schemas、依赖注入
│   ├── cleaners/               # PDF 解析与多模态分解
│   ├── extractor/              # LLM 字段提取引擎
│   ├── feishu/                 # 飞书 Card v2 构建与 Webhook 客户端
│   ├── services/               # TaskService、PipelineService、存储
│   ├── pipeline.py             # CLI / API 共用编排
│   └── config.py               # 环境变量与全局配置
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── api/                # 后端 API 客户端
│       ├── pages/              # 上传、任务列表、详情、配置等页面
│       ├── components/         # 字段编辑、卡片预览、布局组件
│       └── types/              # 与 OpenAPI 对齐的 TypeScript 类型
├── my_project/                 # MinerU 重依赖（uv / pyproject.toml）
├── tests/                      # 单元测试
└── teach/                      # FastAPI 学习笔记（非运行时）
```

## 后端能力（FastAPI）

主要接口：

- `GET /health`
- `POST /upload`
- `POST /upload/batch`
- `GET /batches/{batch_id}`
- `GET /tasks`
- `GET /tasks/{task_id}`
- `GET /tasks/{task_id}/content`
- `GET /tasks/{task_id}/result`
- `GET /tasks/{task_id}/file`
- `POST /tasks/{task_id}/confirm`
- `GET /config/extraction-fields`
- `PUT /config/extraction-fields`
- `POST /config/extraction-fields/reset`
- `PUT /config/groups`

后端职责：

- 接收研报上传，创建异步解析 + 提取任务
- 维护任务 / 批次状态，支持列表搜索与状态筛选
- 返回清洗后 Markdown 与 15 字段 JSON 结果
- 处理用户字段编辑与确认发送（Webhook 推送飞书 Card v2）
- 管理提取字段模板与飞书群配置

API 文档：[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

## 前端能力（React）

前端工作台支持：

- 配置提取字段模板（默认 15 字段 / 自定义扩展 / 重置）
- 配置飞书目标群
- 单文件 / 批量上传研报
- 查看任务列表，按状态筛选与搜索
- 轮询任务进度，查看清洗后 Markdown 原文
- 编辑提取字段，预览飞书卡片样式
- 确认发送至目标群

主要页面路由：

- `/config/fields` — 字段配置
- `/config/groups` — 群聊配置
- `/upload` — 上传研报
- `/tasks` — 任务列表
- `/tasks/:id` — 任务详情（字段编辑 + 卡片预览 + 确认发送）
- `/batches/:id` — 批量任务进度
- `/settings` — 通用设置

## 快速启动（推荐）

需已安装并启动 [Docker Desktop](https://www.docker.com/products/docker-desktop/)。

```bash
cp .env.example .env
# 编辑 .env，填入 DASHSCOPE_API_KEY

docker compose up -d
```

首次会构建 backend / frontend（较慢，Dockerfile 已配国内镜像源）；之后直接 `docker compose up -d` 即可。Compose 会注入 Postgres，无需再手写本机 `DATABASE_URL`。

访问：

- 前端：`http://localhost:5173`
- 后端 / API 文档：`http://localhost:8000/docs`
- 健康检查：`http://localhost:8000/health`

飞书机器人 Webhook 在前端「飞书通知」页配置并写入数据库，不走环境变量。

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `DASHSCOPE_API_KEY` | 是 | — | 阿里云 DashScope API Key |
| `POSTGRES_USER` / `PASSWORD` / `DB` | 否 | `extract` / `extract` / `extract_flow` | Compose 数据库账号 |
| `PIPELINE_CONCURRENCY` | 否 | `3` | 并发处理任务数上限 |
| `DECOMPOSER_ENABLED` | 否 | `true` | 是否启用多模态内容分解 |
| `DECOMPOSER_BATCH_SIZE` | 否 | `5` | 分解批大小 |

常用命令：

```bash
docker compose ps          # 查看状态
docker compose logs -f     # 看日志
docker compose down        # 停止（数据卷保留）
```

## 本机开发（可选）

改代码需要热重载时，可只起基础设施，前后端本机跑：

```bash
docker compose up -d postgres redis
cp .env.example .env   # 填 DASHSCOPE_API_KEY；示例已含本机 Postgres URL
pip install -r requirements-api.txt
cd my_project && pip install -e . && cd ..
uvicorn app.api.main:app --reload --host 127.0.0.1 --port 8000
cd frontend && npm install && npm run dev -- --host 127.0.0.1 --port 5173
```

### CLI 调试

```bash
python main.py report.pdf
python main.py report.pdf --extract
python main.py report.pdf --extract --send
python main.py report.pdf -o output.md
python main.py report.pdf --extract -o card.json
python main.py report.pdf --stats
```

### 运行测试

```bash
python -m pytest tests/ --ignore=tests/test_mineru.py
```

更多开发约定见 [AGENTS.md](AGENTS.md)。

## 运行时数据说明

请勿提交到 Git：

- `.env`（含 API Key）
- `.mineru_cache/`、`mineru_output/`、`.paddleocr_models/`
- `frontend/node_modules/`、`frontend/dist/`
- `data/`（上传与任务运行时数据）

`.gitignore` 已覆盖上述路径。Compose 全栈部署时通过 volume 挂载 `data/`，密钥用 `.env` 注入。

## 适合在简历和面试中展示的点

- 把券商研报摘要做成 **可轮询、可确认、可推送** 的完整任务流，而不是单次 LLM 调用
- 用 **MinerU + 多模态分解** 控制解析成本，仅提取环节消耗 LLM Token
- 用 **FastAPI + Pydantic v2** 封装上传、轮询、字段配置与确认发送接口
- 用 **React** 构建独立工作台，完成字段编辑、卡片预览与前后端联调
- 用 **Docker Compose** 一键拉起全栈（Postgres / Redis / API / 前端）
- CLI 与 API 共用 `app/pipeline.py`，避免编排逻辑重复

## Roadmap

- [ ] Celery Worker 纳入 Compose 编排（可选生产路径）
- [x] 持久化任务存储（SQLite / Postgres，`DbTaskStore`）
- [x] 确认发送飞书 Card v2（Webhook）
- [ ] 群权限映射、发送审计与失败重发完善
