"""完整 Pipeline CLI：文档清洗 → 提取 → 飞书卡片 →（可选）发送。

用法:
    python main.py <file>                          # 清洗，输出 Markdown
    python main.py <file> -o output.md             # 清洗，写入文件
    python main.py <file> --extract                # 清洗 + 提取，输出卡片 JSON
    python main.py <file> --extract --send --webhook <url>  # 发送飞书
    python main.py <file> --extract -o card.json   # 卡片 JSON 写入文件
    python main.py <file> --stats                  # 仅输出统计信息
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from app.pipeline import PipelineError, parse_document, run_report_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("main")


def _print_doc_stats(doc) -> None:
    print(f"文件:        {doc.source}")
    print(f"类型:        {doc.file_type}")
    print(f"字符数:      {len(doc.content)}")
    print(f"结构化条目:  {len(doc.structured_items)}")
    print(f"图片处理:    {doc.stats}")
    if doc.parse_warnings:
        print(f"警告:        {doc.parse_warnings}")


def main() -> None:
    parser = argparse.ArgumentParser(description="研报处理 Pipeline")
    parser.add_argument("file", type=Path, help="输入 PDF 文件")
    parser.add_argument("-o", "--output", type=Path, help="输出文件路径")
    parser.add_argument("--stats", action="store_true", help="仅输出统计信息")
    parser.add_argument("--extract", action="store_true", help="执行 LLM 字段提取")
    parser.add_argument("--send", action="store_true", help="提取后发送飞书卡片（需同时传 --webhook）")
    parser.add_argument("--webhook", type=str, default=None, help="飞书自定义机器人 Webhook URL")
    parser.add_argument("--extract-raw", action="store_true", help="同时输出/保存提取的原始 JSON 字段")
    args = parser.parse_args()

    if args.send and not args.extract:
        args.extract = True
    if args.send and not args.webhook:
        parser.error("使用 --send 时必须提供 --webhook")

    try:
        if args.extract:
            result = run_report_pipeline(
                args.file,
                send=args.send,
                webhook_url=args.webhook,
            )
            doc = result.doc
            fields = result.fields or {}
            card_payload = result.card.to_dict() if result.card else {}

            if args.stats:
                _print_doc_stats(doc)
                print(f"提取字段数:  {len(fields)}")
                print(f"字段:        {list(fields.keys())}")
                if result.feishu_response:
                    print(f"飞书响应:    {result.feishu_response}")
                return

            card_json = json.dumps(card_payload, ensure_ascii=False, indent=2)

            if args.output:
                args.output.write_text(card_json, encoding="utf-8")
                logger.info("已写入卡片 JSON: %s", args.output)

                if args.extract_raw:
                    raw_path = args.output.with_suffix(".json")
                    if raw_path == args.output:
                        raw_path = args.output.with_name(args.output.stem + "_fields.json")
                    raw_path.write_text(
                        json.dumps(fields, ensure_ascii=False, indent=2),
                        encoding="utf-8",
                    )
                    logger.info("已写入字段 JSON: %s", raw_path)
            else:
                print(card_json)
                if args.extract_raw:
                    print("\n--- 原始字段 JSON ---")
                    print(json.dumps(fields, ensure_ascii=False, indent=2))

            if args.send:
                logger.info("飞书发送成功")
            return

        doc = parse_document(args.file)

        if args.stats:
            _print_doc_stats(doc)
            return

        if args.output:
            args.output.write_text(doc.content, encoding="utf-8")
            logger.info("已写入: %s (%d 字符)", args.output, len(doc.content))
        else:
            print(doc.content)

    except PipelineError as e:
        logger.error("%s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
