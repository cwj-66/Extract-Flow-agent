"""MinerU 官方云端客户端：签名上传、轮询及流式下载解析结果。

协议来源：https://mineru.net/apiManage/docs（v4 本地文件批量上传）。
"""

from __future__ import annotations

import json
import re
import shutil
import tempfile
import time
import uuid
import zipfile
from pathlib import Path
from urllib.parse import quote

import httpx

from app.config import Settings, settings

_IMAGE_REF_RE = re.compile(r"(!\[[^\]]*\]\()([^)]+)(\))")


class MinerUCloudError(RuntimeError):
    """可直接展示给任务用户的云端解析错误。"""


class MinerUCloudClient:
    """每份 PDF 使用独立客户端，API Token 仅发送给 API 主机。"""

    def __init__(
        self, config: Settings = settings, *, transport: httpx.BaseTransport | None = None
    ) -> None:
        self.config = config
        self.transport = transport
        self.deadline = 0.0

    def _timeout(self) -> float:
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise MinerUCloudError("MinerU 云端解析超时，请稍后重试或增大 MINERU_TIMEOUT_SEC")
        return min(self.config.MINERU_REQUEST_TIMEOUT_SEC, remaining)

    def _api(self, client: httpx.Client, method: str, path: str, **kwargs) -> dict:
        response = client.request(
            method, self.config.MINERU_API_BASE_URL.rstrip("/") + path,
            headers={"Authorization": f"Bearer {self.config.MINERU_API_TOKEN.strip()}"},
            timeout=self._timeout(), **kwargs,
        )
        if response.status_code in (401, 403):
            raise MinerUCloudError("MinerU Token 无效或已过期，请检查 MINERU_API_TOKEN")
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise MinerUCloudError("MinerU API 返回格式错误")
        code = payload.get("code")
        if code != 0:
            if code in ("A0202", "A0211"):
                raise MinerUCloudError("MinerU Token 无效或已过期，请检查 MINERU_API_TOKEN")
            raise MinerUCloudError(f"MinerU API 错误（{code}）：{self._message(payload.get('msg'))}")
        data = payload.get("data")
        if not isinstance(data, dict):
            raise MinerUCloudError("MinerU API 返回缺少 data")
        return data

    def _message(self, value: object) -> str:
        # 服务端错误可能回显请求；避免任务记录泄露 Token。
        message = str(value or "未知错误")
        token = self.config.MINERU_API_TOKEN.strip()
        return message.replace(token, "[redacted]")[:500] if token else message[:500]

    @staticmethod
    def _object_url(value: object) -> str:
        if not isinstance(value, str):
            raise MinerUCloudError("MinerU 返回缺少上传或下载地址")
        url = httpx.URL(value)
        if url.scheme != "https" or not url.host or url.username or url.password:
            raise MinerUCloudError("MinerU 返回的文件地址无效（需要 HTTPS）")
        return value

    def download_result(self, pdf_path: Path, archive_path: Path) -> None:
        """上传本地 PDF，等待云端完成，将 ZIP 流式保存到磁盘。"""
        if not self.config.MINERU_API_TOKEN.strip():
            raise MinerUCloudError("未配置 MINERU_API_TOKEN，请在环境变量中填写 MinerU API Token")
        if self.config.MINERU_MODEL_VERSION not in ("vlm", "pipeline"):
            raise MinerUCloudError("MINERU_MODEL_VERSION 只能为 vlm 或 pipeline")
        if min(self.config.MINERU_TIMEOUT_SEC, self.config.MINERU_REQUEST_TIMEOUT_SEC,
               self.config.MINERU_POLL_INTERVAL_SEC) <= 0:
            raise MinerUCloudError("MinerU 超时和轮询间隔必须大于 0")
        size = pdf_path.stat().st_size
        if size == 0 or size > 200 * 1024 * 1024:
            raise MinerUCloudError("MinerU 云端要求 PDF 非空且不超过 200 MB")
        self.deadline = time.monotonic() + self.config.MINERU_TIMEOUT_SEC
        data_id = uuid.uuid4().hex
        try:
            # 同一连接池按请求显式添加认证，签名上传和下载不携带 Token。
            with httpx.Client(transport=self.transport, follow_redirects=False) as client:
                data = self._api(client, "POST", "/api/v4/file-urls/batch", json={
                    "files": [{"name": pdf_path.name, "data_id": data_id}],
                    "model_version": self.config.MINERU_MODEL_VERSION,
                    "enable_formula": True, "enable_table": True,
                    "language": self.config.MINERU_LANGUAGE,
                })
                urls = data.get("file_urls")
                batch_id = data.get("batch_id")
                if not isinstance(urls, list) or len(urls) != 1 or not isinstance(batch_id, str) or not batch_id:
                    raise MinerUCloudError("MinerU API 未返回有效 batch_id / file_urls")
                with pdf_path.open("rb") as source:
                    response = client.put(
                        self._object_url(urls[0]), content=self._upload_chunks(source),
                        headers={"Content-Length": str(size)}, timeout=self._timeout(),
                    )
                response.raise_for_status()
                path = "/api/v4/extract-results/batch/" + quote(batch_id, safe="")
                while True:
                    results = self._api(client, "GET", path).get("extract_result")
                    if not isinstance(results, list) or len(results) != 1 or not isinstance(results[0], dict):
                        raise MinerUCloudError("MinerU API 返回的任务结果格式错误")
                    result = results[0]
                    if result.get("data_id") not in (None, data_id):
                        raise MinerUCloudError("MinerU API 返回的任务 data_id 不匹配")
                    state = result.get("state")
                    if state == "done":
                        self._download(client, self._object_url(result.get("full_zip_url")), archive_path)
                        return
                    if state == "failed":
                        raise MinerUCloudError(f"MinerU 云端解析失败：{self._message(result.get('err_msg'))}")
                    if state not in ("waiting-file", "pending", "running", "converting"):
                        raise MinerUCloudError(f"MinerU API 返回未知任务状态：{self._message(state)}")
                    self._timeout()
                    time.sleep(min(self.config.MINERU_POLL_INTERVAL_SEC,
                                   max(0, self.deadline - time.monotonic())))
        except httpx.TimeoutException:
            raise MinerUCloudError("MinerU 云端请求超时，请稍后重试") from None
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status == 429:
                raise MinerUCloudError("MinerU 请求频率或额度受限（HTTP 429），请稍后重试") from None
            raise MinerUCloudError(f"MinerU 云端请求失败（HTTP {status}），请稍后重试") from None
        except httpx.RequestError:
            raise MinerUCloudError("无法连接 MinerU 云端，请检查服务器网络") from None
        except (ValueError, httpx.InvalidURL):
            raise MinerUCloudError("MinerU API 返回了无效 JSON 或文件地址") from None

    def _upload_chunks(self, source):
        while chunk := source.read(1024 * 1024):
            self._timeout()
            yield chunk

    def _download(self, client: httpx.Client, url: str, destination: Path) -> None:
        size = 0
        with client.stream("GET", url, timeout=self._timeout(), follow_redirects=True) as response:
            response.raise_for_status()
            with destination.open("wb") as output:
                for chunk in response.iter_bytes(1024 * 1024):
                    self._timeout()
                    size += len(chunk)
                    if size > 256 * 1024 * 1024:
                        raise MinerUCloudError("MinerU 结果压缩包超过 256 MB，请拆分 PDF")
                    output.write(chunk)


def _extract_archive(archive_path: Path, destination: Path) -> None:
    """限制解压体积和路径，避免结果包覆盖工作目录以外的文件。"""
    with zipfile.ZipFile(archive_path) as archive:
        entries = archive.infolist()
        if len(entries) > 10000 or sum(item.file_size for item in entries) > 512 * 1024 * 1024:
            raise MinerUCloudError("MinerU 解压结果过大，请拆分 PDF")
        root = destination.resolve()
        for item in entries:
            name = item.filename.replace("\\", "/")
            target = (root / name).resolve()
            if (":" in name or name.startswith("/") or ".." in Path(name).parts
                    or not target.is_relative_to(root)
                    or (item.external_attr >> 16) & 0o170000 == 0o120000):
                raise MinerUCloudError("MinerU 结果压缩包包含不安全路径")
            if item.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(item) as source, target.open("wb") as output:
                    shutil.copyfileobj(source, output, length=1024 * 1024)


def parse_cloud_pdf(pdf_path: Path, client: MinerUCloudClient | None = None) -> dict:
    """返回与本地 worker 一致的 Markdown/结构化条目，并保留图片供 VLM 使用。"""
    client = client or MinerUCloudClient()
    cache_root = pdf_path.parent / ".mineru_cache" / pdf_path.stem
    cache_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="cloud_", dir=cache_root) as tmp:
        temporary = Path(tmp)
        archive_path = temporary / "result.zip"
        client.download_result(pdf_path, archive_path)
        unpacked = temporary / "unpacked"
        try:
            _extract_archive(archive_path, unpacked)
            markdown_paths = list(unpacked.rglob("full.md"))
            if len(markdown_paths) != 1:
                raise MinerUCloudError("MinerU 结果压缩包应包含一份 full.md")
            md_path = markdown_paths[0]
            markdown = md_path.read_text(encoding="utf-8-sig").strip()
            if not markdown:
                raise MinerUCloudError("MinerU 云端解析结果为空")
            structured_items = []
            content_lists = sorted(md_path.parent.glob("*_content_list.json"))
            if content_lists:
                structured_items = json.loads(content_lists[0].read_text(encoding="utf-8-sig"))
                if not isinstance(structured_items, list):
                    raise MinerUCloudError("MinerU content_list 应为 JSON 数组")
            durable = cache_root / uuid.uuid4().hex

            def image_path(match: re.Match) -> str:
                raw = match.group(2)
                local = (md_path.parent / raw.replace("\\", "/")).resolve()
                if local.is_relative_to(unpacked.resolve()) and local.is_file():
                    relative = local.relative_to(unpacked.resolve())
                    reference = (durable / relative).relative_to(pdf_path.parent).as_posix()
                    return f"{match.group(1)}{reference}{match.group(3)}"
                return match.group(0)

            markdown = _IMAGE_REF_RE.sub(image_path, markdown)
            unpacked.rename(durable)
            return {"markdown": markdown, "structured_items": structured_items}
        except (zipfile.BadZipFile, UnicodeError, json.JSONDecodeError):
            raise MinerUCloudError("MinerU 结果 ZIP、Markdown 或 JSON 损坏") from None
