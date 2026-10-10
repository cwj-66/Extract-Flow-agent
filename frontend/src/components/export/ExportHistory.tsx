import { Download, FileJson, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { downloadExport } from '../../api/ops';
import { formatRelativeTime } from '../../lib/status';
import type { ExportRecord } from '../../types';

/** 展示已生成文件，下载失败后仍可在此重试。 */
export function ExportHistory({ logs, loading, failed }: { logs: ExportRecord[]; loading: boolean; failed: boolean }) {
  return (
    <section className="ef-card" aria-busy={loading}>
      <h2 className="px-5 py-4 text-sm font-semibold text-ink">导出记录</h2>
      {loading ? (
        <p className="flex items-center gap-2 px-5 py-8 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />加载导出记录…</p>
      ) : logs.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">{failed ? '导出记录暂未获取，请重试' : '还没有导出文件'}</p>
      ) : (
        <ul className="divide-y divide-line">
          {logs.map((record) => {
            const Icon = record.export_type === 'csv' ? FileSpreadsheet : record.export_type === 'json' ? FileJson : FileText;
            return (
              <li key={record.id} className="flex items-center gap-3 px-5 py-3">
                <span className="ef-icon-tile bg-canvas text-muted"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{record.export_type.toUpperCase()} · {record.task_count} 份</p>
                  <p className="text-xs text-muted">{formatRelativeTime(record.created_at)}</p>
                </div>
                <button type="button" className="ef-btn ef-btn-ghost" aria-label={`下载 ${record.export_type.toUpperCase()}，${record.task_count} 份研报`} onClick={() => void downloadExport(record).catch(() => {
                  toast.error('下载失败，文件仍保留在导出记录中，可再次下载');
                })}>
                  <Download className="h-4 w-4" aria-hidden="true" />下载
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
