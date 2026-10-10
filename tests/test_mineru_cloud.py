"""云端协议测试：使用模拟服务验证上传、轮询和认证边界。"""

import json
import io
import zipfile
from dataclasses import replace

import httpx
import pytest

from app.config import settings
from app.cleaners.handlers.mineru_cloud import MinerUCloudClient, MinerUCloudError, parse_cloud_pdf


def test_cloud_upload_poll_download(tmp_path):
    pdf = tmp_path / "report.pdf"
    pdf.write_bytes(b"%PDF-1.7\nexample")
    archive = tmp_path / "result.zip"
    states = iter(["waiting-file", "pending", "running", "converting", "done"])
    requests = []

    def handler(request):
        requests.append(request)
        if request.url.host == "mineru.net":
            assert request.headers["Authorization"] == "Bearer test-token"
            if request.method == "POST":
                body = json.loads(request.content)
                assert body["files"][0]["name"] == "report.pdf"
                assert body["model_version"] == "vlm"
                assert body["enable_formula"] and body["enable_table"]
                return httpx.Response(200, json={"code": 0, "data": {
                    "batch_id": "batch-1", "file_urls": ["https://storage.test/upload"]}})
            assert request.url.path == "/api/v4/extract-results/batch/batch-1"
            return httpx.Response(200, json={"code": 0, "data": {"extract_result": [{
                "state": next(states), "full_zip_url": "https://storage.test/result"}]}})
        assert "Authorization" not in request.headers
        if request.method == "PUT":
            assert request.content == pdf.read_bytes()
            assert "Content-Type" not in request.headers
            assert request.headers["Content-Length"] == str(pdf.stat().st_size)
            return httpx.Response(200)
        return httpx.Response(200, content=b"zip-result")

    config = replace(settings, MINERU_API_TOKEN="test-token", MINERU_POLL_INTERVAL_SEC=0.001)
    MinerUCloudClient(config, transport=httpx.MockTransport(handler)).download_result(pdf, archive)
    assert archive.read_bytes() == b"zip-result"
    assert len(requests) == 8


def test_missing_token_fails_before_network(tmp_path):
    client = MinerUCloudClient(replace(settings, MINERU_API_TOKEN=""))
    with pytest.raises(MinerUCloudError, match="MINERU_API_TOKEN"):
        client.download_result(tmp_path / "missing.pdf", tmp_path / "result.zip")


def make_zip(files):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return buffer.getvalue()


class ArchiveClient:
    def __init__(self, files):
        self.archive = make_zip(files)

    def download_result(self, pdf_path, archive_path):
        archive_path.write_bytes(self.archive)


def test_archive_keeps_nested_images_resolvable(tmp_path):
    from app.cleaners.decomposer.engine import _resolve_image_path

    pdf = tmp_path / "研报.pdf"
    client = ArchiveClient({
        "nested/full.md": "# 研报\n![图表](images/plot.png)",
        "nested/report_content_list.json": '[{"type":"text","text":"研报"}]',
        "nested/images/plot.png": b"image-data",
    })
    payload = parse_cloud_pdf(pdf, client)
    assert payload["structured_items"][0]["text"] == "研报"
    image_ref = payload["markdown"].split("](")[1].split(")")[0]
    assert _resolve_image_path(image_ref, pdf).read_bytes() == b"image-data"
    assert not list((tmp_path / ".mineru_cache" / pdf.stem).glob("cloud_*"))


@pytest.mark.parametrize("path", ["../outside.txt", "C:/outside.txt", "/outside.txt", "..\\outside.txt"])
def test_archive_rejects_unsafe_paths(tmp_path, path):
    with pytest.raises(MinerUCloudError, match="不安全路径"):
        parse_cloud_pdf(tmp_path / "report.pdf", ArchiveClient({"full.md": "text", path: "bad"}))
    assert not (tmp_path / "outside.txt").exists()


@pytest.mark.parametrize("files,message", [
    ({"other.txt": "text"}, "full.md"),
    ({"full.md": " "}, "为空"),
    ({"full.md": "text", "x_content_list.json": "{}"}, "数组"),
    ({"full.md": b"\xff"}, "损坏"),
])
def test_invalid_results_fail_clearly(tmp_path, files, message):
    with pytest.raises(MinerUCloudError, match=message):
        parse_cloud_pdf(tmp_path / "report.pdf", ArchiveClient(files))


def test_cloud_mode_preserves_parsed_doc_and_skips_local(tmp_path, monkeypatch):
    from app.cleaners.handlers import pdf as pdf_handler
    from app.cleaners.handlers import mineru_cloud

    pdf = tmp_path / "report.pdf"
    pdf.write_bytes(b"%PDF-1.7")
    monkeypatch.setattr(settings, "MINERU_MODE", "cloud")
    monkeypatch.setattr(settings, "DECOMPOSER_ENABLED", False)
    monkeypatch.setattr(mineru_cloud, "parse_cloud_pdf", lambda path: {
        "markdown": "# 云端原文", "structured_items": [{"type": "text"}]})
    monkeypatch.setattr(pdf_handler, "_parse_with_mineru_subprocess", lambda path: pytest.fail("local called"))
    doc = pdf_handler.parse_pdf(pdf)
    assert doc.source == "report.pdf"
    assert doc.content == "# 云端原文"
    assert doc.structured_items == [{"type": "text"}]


def test_local_mode_still_works(tmp_path, monkeypatch):
    from app.cleaners.handlers import pdf as pdf_handler

    pdf = tmp_path / "report.pdf"
    pdf.touch()
    monkeypatch.setattr(settings, "MINERU_MODE", "local")
    monkeypatch.setattr(settings, "DECOMPOSER_ENABLED", False)
    monkeypatch.setattr(pdf_handler, "_parse_with_mineru_subprocess", lambda path: {"markdown": "local"})
    assert pdf_handler.parse_pdf(pdf).content == "local"


@pytest.mark.parametrize("status,payload,message", [
    (401, {}, "Token"),
    (403, {}, "Token"),
    (429, {}, "额度"),
    (503, {}, "HTTP 503"),
    (200, {"code": "A0211"}, "Token"),
    (200, {"code": -60018, "msg": "每日额度用完"}, "每日额度"),
    (200, {"code": 0, "data": {}}, "batch_id"),
])
def test_api_errors_are_actionable(tmp_path, status, payload, message):
    pdf = tmp_path / "report.pdf"
    pdf.write_bytes(b"%PDF")
    client = MinerUCloudClient(replace(settings, MINERU_API_TOKEN="test-token"),
                              transport=httpx.MockTransport(lambda request: httpx.Response(status, json=payload)))
    with pytest.raises(MinerUCloudError, match=message):
        client.download_result(pdf, tmp_path / "result.zip")


def test_errors_do_not_expose_token(tmp_path):
    pdf = tmp_path / "report.pdf"
    pdf.write_bytes(b"%PDF")
    transport = httpx.MockTransport(lambda request: httpx.Response(
        200, json={"code": -1, "msg": "echo secret-token"}))
    client = MinerUCloudClient(replace(settings, MINERU_API_TOKEN="secret-token"), transport=transport)
    with pytest.raises(MinerUCloudError) as exc:
        client.download_result(pdf, tmp_path / "result.zip")
    assert "secret-token" not in str(exc.value)


def test_queue_has_bounded_total_timeout(tmp_path, monkeypatch):
    from app.cleaners.handlers import mineru_cloud

    clock = [0.0]
    monkeypatch.setattr(mineru_cloud.time, "monotonic", lambda: clock[0])
    monkeypatch.setattr(mineru_cloud.time, "sleep", lambda seconds: clock.__setitem__(0, clock[0] + seconds))
    pdf = tmp_path / "report.pdf"
    pdf.write_bytes(b"%PDF")

    def handler(request):
        if request.method == "POST":
            return httpx.Response(200, json={"code": 0, "data": {
                "batch_id": "b", "file_urls": ["https://storage.test/upload"]}})
        if request.method == "PUT":
            return httpx.Response(200)
        return httpx.Response(200, json={"code": 0, "data": {"extract_result": [{"state": "pending"}]}})

    client = MinerUCloudClient(replace(settings, MINERU_API_TOKEN="test", MINERU_TIMEOUT_SEC=5,
                                      MINERU_POLL_INTERVAL_SEC=2), transport=httpx.MockTransport(handler))
    with pytest.raises(MinerUCloudError, match="解析超时"):
        client.download_result(pdf, tmp_path / "result.zip")
    assert clock[0] == 5


@pytest.mark.parametrize("error,message", [(httpx.ConnectError, "网络"), (httpx.ReadTimeout, "请求超时")])
def test_network_errors_are_sanitized(tmp_path, error, message):
    pdf = tmp_path / "report.pdf"
    pdf.write_bytes(b"%PDF")

    def handler(request):
        raise error("https://private-signed-url", request=request)

    client = MinerUCloudClient(replace(settings, MINERU_API_TOKEN="test"), transport=httpx.MockTransport(handler))
    with pytest.raises(MinerUCloudError, match=message) as exc:
        client.download_result(pdf, tmp_path / "result.zip")
    assert "private-signed-url" not in str(exc.value)
