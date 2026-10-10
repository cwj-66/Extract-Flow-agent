"""验证文本提取和图像描述遵循配置，并保留显式模型覆盖。"""

from types import SimpleNamespace
from unittest.mock import MagicMock

from app.cleaners.decomposer.processors import _call_vlm
from app.config import settings
from app.extractor import engine


def test_configured_model_used_for_text_and_image(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "DASHSCOPE_MODEL", "qwen3.8-27b")
    client = MagicMock()
    client.chat.completions.create.return_value = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content='{"company_name":"测试公司"}'))],
        usage=None,
    )
    factory = MagicMock(return_value=client)
    monkeypatch.setattr(engine, "OpenAI", factory)
    result = engine.extract_document("测试公司")
    assert result.meta.metrics.model == "qwen3.8-27b"
    assert client.chat.completions.create.call_args.kwargs["model"] == "qwen3.8-27b"
    assert factory.call_args.kwargs["timeout"] == settings.LLM_REQUEST_TIMEOUT_SEC
    assert factory.call_args.kwargs["max_retries"] == 2
    engine.extract_document("测试公司", model="explicit")
    assert client.chat.completions.create.call_args.kwargs["model"] == "explicit"
    image = tmp_path / "tiny.png"
    image.write_bytes(b"test-image")
    _call_vlm(client, "describe", image)
    assert client.chat.completions.create.call_args.kwargs["model"] == "qwen3.8-27b"
