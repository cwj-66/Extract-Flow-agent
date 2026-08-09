import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface MarkdownViewerProps {
  content: string;
  charCount: number;
  loading?: boolean;
  emptyHint?: string;
}

function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mt-4 mb-1 text-slate-800">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-semibold mt-5 mb-2 text-slate-900">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold mt-6 mb-3 text-slate-900">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-slate-100 px-1 py-0.5 text-xs font-mono">$1</code>');

  html = html.replace(/(\|.+\|\n)+/g, (table) => {
    const rows = table.trim().split('\n');
    const headerCells = rows[0].split('|').filter(Boolean).map(c => c.trim());
    const bodyRows = rows.slice(2).map(row =>
      row.split('|').filter(Boolean).map(c => c.trim())
    );
    const thead = headerCells.map(c => `<th class="px-3 py-1.5 text-left text-xs font-semibold text-slate-600 bg-slate-50">${c}</th>`).join('');
    const tbody = bodyRows.map(cells =>
      `<tr class="border-t border-slate-100">${cells.map(c => `<td class="px-3 py-1.5 text-xs text-slate-700">${c}</td>`).join('')}</tr>`
    ).join('');
    return `<table class="w-full border border-slate-200 rounded text-sm mb-3"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
  });

  html = html.replace(/^(?!<[h|t|u|o])(.*\S.*)$/gm, '<p class="text-sm text-slate-700 leading-relaxed mb-2">$1</p>');
  return html;
}

export function MarkdownViewer({
  content,
  charCount,
  loading = false,
  emptyHint,
}: MarkdownViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" aria-hidden="true" />
        <p className="text-sm">原文生成中…</p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white py-20 text-sm text-slate-400">
        {emptyHint ?? '暂无原文内容'}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2">
        <span className="text-xs text-slate-500">{charCount.toLocaleString()} 字符</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-200"
          aria-label="复制全文"
        >
          {copied ? (
            <><Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" /> 已复制</>
          ) : (
            <><Copy className="h-3.5 w-3.5" aria-hidden="true" /> 复制全文</>
          )}
        </button>
      </div>
      <div
        className="rounded-lg border border-slate-200 bg-white px-6 py-5"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        aria-label="研报原文 Markdown"
      />
    </div>
  );
}
