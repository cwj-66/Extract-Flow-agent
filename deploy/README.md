# chenwj.click 部署

项目介绍位于 `/projects/extract-flow/`，工作台位于 `/extract-flow/`。两者复用作品集访问验证，不改变已有客服项目的 `/api/` 路由。

使用独立生产配置，保持云端 MinerU，不安装本地模型；任务并发为 1，图像描述并发为 2。容器内存上限合计 1664 MiB，不代表正常运行时的实际占用。数据保存在 `data/` 与 Postgres 命名卷中。

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

更新前备份作品集首页、交互脚本、服务代码和 Nginx 配置。先验证 Python 服务语法与 Nginx 配置，再重启作品集服务并重载 Nginx。回滚时恢复这些备份，停止萃报容器；不要删除 Postgres 数据卷。
