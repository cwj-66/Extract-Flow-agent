import { useEffect, useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { FieldEvidence } from '../../types';
import { FIELD_LABELS } from '../../lib/fields';

interface SourcePaneProps {
  content: string;
  charCount: number;
  loading?: boolean;
  emptyHint?: string;
  highlight?: FieldEvidence | null;
}

export function SourcePane({
  content,
  charCount,
  loading = false,
  emptyHint,
  highlight,
}: SourcePaneProps) {
  const [copied, setCopied] = useState(false);
  const markRef = useRef<HTMLElement>(null);

  useEffect(() => {
    markRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight?.field, highlight?.start, highlight?.end]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-subtle" aria-busy="true">
        <div
          className="mb-3 h-7 w-7 animate-spin rounded-full border-2 border-brand border-t-transparent"
          aria-hidden="true"
        />
        <p className="text-sm">原文生成中…</p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-subtle">
        {emptyHint ?? '暂无原文内容'}
      </div>
    );
  }

  const range =
    highlight &&
    highlight.start >= 0 &&
    highlight.end > highlight.start &&
    highlight.end <= content.length
      ? highlight
      : null;
  const before = range ? content.slice(0, range.start) : content;
  const mid = range ? content.slice(range.start, range.end) : '';
  const after = range ? content.slice(range.end) : '';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-line bg-canvas px-3">
        <p className="truncate text-xs text-muted">
          {charCount.toLocaleString()} 字
          {range && (
            <span className="ml-2 text-brand">
              定位 · {FIELD_LABELS[range.field] ?? range.field}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-600 hover:bg-white"
          aria-label="复制全文"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
              已复制
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              复制
            </>
          )}
        </button>
      </div>
      <pre
        className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-sans text-[13px] leading-6 text-[#1F2329]"
        aria-label="研报清洗原文"
      >
        {range ? (
          <>
            {before}
            <mark
              ref={markRef}
              className="rounded-sm bg-[#FFF3C4] text-inherit ring-1 ring-[#FFC60A]/70"
            >
              {mid}
            </mark>
            {after}
          </>
        ) : (
          content
        )}
      </pre>
    </div>
  );
}
