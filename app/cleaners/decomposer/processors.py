"""各类型图片的 VLM 处理器：调用视觉模型生成中文描述。"""

import base64
import logging
from pathlib import Path

from app.cleaners.decomposer.schemas import ImageType

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "qwen3.7-plus"


def _encode_image(img_path: Path) -> tuple[str, str]:
    ext = img_path.suffix.lstrip(".") or "jpeg"
    if ext.lower() in ("jpg",):
        ext = "jpeg"
    b64 = base64.b64encode(img_path.read_bytes()).decode()
    return ext, b64


def _call_vlm(client, prompt: str, img_path: Path, model: str = _DEFAULT_MODEL) -> str:
    ext, b64 = _encode_image(img_path)
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/{ext};base64,{b64}"}},
                    {"type": "text", "text": prompt},
                ],
            }
        ],
        extra_body={"enable_thinking": False},
    )
    return resp.choices[0].message.content.strip()


def process_chart(img_path: Path, client) -> str:
    """描述图表类型、趋势与关键数值。"""
    prompt = (
        "你正在分析一份券商研报中的图表。请用中文描述以下内容：\n"
        "1. 图表类型（折线图/柱状图/饼图/散点图/其他）\n"
        "2. X 轴和 Y 轴的含义和单位\n"
        "3. 数据趋势（上升/下降/波动/平稳）和关键数据点\n"
        "4. 图中标注的特殊数值或注释\n\n"
        "如果有明确的数字和年份，请一定提取出来。输出格式：\n"
        "[图表类型] xxx\n"
        "[趋势] xxx\n"
        "[关键数据] xxx"
    )
    try:
        return _call_vlm(client, prompt, img_path)
    except Exception as e:
        logger.warning("图表处理失败: %s", e)
        return f"[图表: {img_path.name}]"


def process_picture(img_path: Path, client) -> str:
    """通用图片描述。"""
    prompt = "请用中文描述这张图片的内容，包括其中的文字和结构。"
    try:
        return _call_vlm(client, prompt, img_path)
    except Exception as e:
        logger.warning("图片描述失败: %s", e)
        return f"[图片: {img_path.name}]"


def dispatch_processor(image_type: ImageType, img_path: Path, client) -> str:
    """按图片类型路由到对应处理器。"""
    if image_type == ImageType.CHART:
        return process_chart(img_path, client)
    return process_picture(img_path, client)
