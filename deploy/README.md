# chenwj.click 部署

项目介绍位于 `/projects/extract-flow/`，工作台位于 `/extract-flow/`。两者复用作品集访问验证，不改变已有客服项目的 `/api/` 路由。

使用独立生产配置，保持云端 MinerU，不安装本地模型；任务并发为 1，图像描述并发为 2。容器内存上限合计 1664 MiB，不代表正常运行时的实际占用。数据保存在 `data/` 与 Postgres 命名卷中。

文本提取与图像描述统一使用 `qwen3.8-27b`（DashScope 云端）。模型请求超时配置 90 秒、SDK 临时错误最多重试 2 次，另有最多 1 次 JSON 格式修复；不把单次请求超时当作整份任务执行时限。参考：https://help.aliyun.com/zh/model-studio/qwen3-8-27b 。成本估算按北京地域输入 3 元、输出 12 元 / 百万 token 设置，不含 MinerU 和图像描述费用。

生产单 API 进程用 FIFO 有界队列，同时执行 1 份、最多等待 10 份。容量覆盖上传预留、等待与执行；批次一次预留全部名额，容量不足在创建批次和文件前返回 503 + `Retry-After: 30`。上传按 1MB 分块落盘。完成、失败或上传异常后归还名额；正常关闭等待执行线程结束。队列本身在内存中，强制退出或重启不自动恢复排队任务；Postgres 保留状态与结果，需要重新上传未完成任务。可选 Celery 不使用这套本地容量预留，当前生产配置关闭 Celery，不可增加 Uvicorn worker 而继续声称全局并发为 1。

Redis Lua 原子检查登录会话 5 次 / 60 秒、IP 30 次 / 60 秒，单份与批量共用窗口，每次批量请求计一次，文件数另受容量限制。计数窗口从第一次提交开始，拒绝不延长窗口；429 携带剩余秒数。Redis 不可用时上传返回 503 + `Retry-After: 10`，读取任务不受此限制。身份键是会话 / IP 的 SHA-256 摘要，不记录 Cookie 原值。入口 Nginx 验证登录并覆盖 X-Forwarded-For，后端仅在隔离网络内信任代理链；本地未登录开发请求只使用 IP 限流。实现参考：https://redis.io/docs/latest/develop/programmability/eval-intro/ 。

在服务器 `/opt/extract-flow-agent/.env` 设置 `DASHSCOPE_API_KEY`、`MINERU_API_TOKEN` 和随机生成的 `POSTGRES_PASSWORD`，文件权限为 600。不要把此文件加入版本库。

```bash
docker compose -p extract-flow -f docker-compose.production.yml config --quiet
docker compose -p extract-flow -f docker-compose.production.yml build backend
docker compose -p extract-flow -f docker-compose.production.yml build frontend
docker compose -p extract-flow -f docker-compose.production.yml up -d --wait
docker compose -p extract-flow -f docker-compose.production.yml ps
```

镜像依次构建，减少 4GB 服务器构建时的内存压力。浏览器构建使用 `/extract-flow/` 基路径，API 使用 `/extract-flow/api`；入口仅监听 `127.0.0.1:15178`，数据库、Redis 和 API 不发布公网端口。

`nginx-extract-flow.conf` 插入现有 HTTPS server，复用 `/_portfolio_auth`。API 未登录时返回 401，页面未登录时跳转作品集登录页。

`portfolio/` 提供与现有客服 Agent 展示页一致的项目介绍、首页第三个轮播片段与补充样式。接入首页时，需要将轮播初始哈希匹配从 `#work-[1-2]` 扩展到 `#work-[1-3]`，并为作品集服务添加 `/projects/extract-flow/` 页面路由。

`project-desktop.css` 由萃报与客服项目介绍页共用，仅在窗口宽度大于 1000px 时加宽内容、放大正文与按钮。内容宽度按窗口与原 1160px 内容宽度的中间值计算，至少将原两侧留白减半；较窄电脑窗口保留每侧 32px。安装脚本也会备份并更新客服介绍页的样式引用，手机布局沿用原有规则。

更新前备份作品集首页、交互脚本、服务代码和 Nginx 配置。先验证 Python 服务语法与 Nginx 配置，再重启作品集服务并重载 Nginx。回滚时恢复这些备份，停止萃报容器；不要删除 Postgres 数据卷。
