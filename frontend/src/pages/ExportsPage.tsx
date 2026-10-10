import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileJson, FileSpreadsheet, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { downloadExport, exportSent, listExports } from '../api/ops';
import { listTasks } from '../api/tasks';
import { ApiError } from '../api/client';
import { ErrorState } from '../components/ui/ErrorState';
import { ExportHistory } from '../components/export/ExportHistory';
import { useWorkspace } from '../components/layout/useWorkspace';
import { formatRelativeTime } from '../lib/status';
import type { ExportRecord, TaskSummary } from '../types';

export function ExportsPage() {
  const { refreshKey, seeding, loadSamples } = useWorkspace();
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [logs, setLogs] = useState<ExportRecord[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [sent, history] = await Promise.all([
          listTasks({ status: 'sent', limit: 100 }),
          listExports(),
        ]);
        if (cancelled) return;
        setTasks(sent.items);
        setLogs(history);
        const validIds = new Set(sent.items.map((task) => task.id));
        setSelected((current) => current.filter((id) => validIds.has(id)));
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : '加载导出数据失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [retryKey, refreshKey]);

  const allSelected = tasks.length > 0 && selected.length === tasks.length;
  const exportDisabled = selected.length === 0 || loading || error != null || exporting != null;

  const toggle = (taskId: string) => {
    setSelected((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]
    );
  };

  const runExport = async (kind: 'csv' | 'json') => {
    if (exportDisabled) return;
    setExporting(kind);
    try {
      const record = await exportSent(kind, selected);
      setSelected([]);
      setLogs((current) => [record, ...current.filter((item) => item.id !== record.id)]);
      try {
        await downloadExport(record);
        toast.success(`已导出 ${record.task_count} 份`);
      } catch {
        toast.error('文件已生成，下载失败，可从导出记录重试');
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '导出失败');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="ef-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-ink">选择已发送研报</h2>
              <span className="ef-chip" role="status">已选 {selected.length} 份</span>
            </div>
            <p className="mt-1 text-xs text-muted">只导出确认发送时的字段。未发送的任务不会写入文件。</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="ef-btn ef-btn-secondary"
              disabled={exportDisabled}
              onClick={() => void runExport('csv')}
            >
              {exporting === 'csv' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
              导出 CSV
            </button>
            <button
              type="button"
              className="ef-btn ef-btn-primary"
              disabled={exportDisabled}
              onClick={() => void runExport('json')}
            >
              {exporting === 'json' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileJson className="h-4 w-4" aria-hidden="true" />}
              导出 JSON
            </button>
          </div>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={() => setRetryKey((key) => key + 1)} />
        ) : loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-subtle">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            加载已发送任务…
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted">
            <p>还没有已发送的研报。确认发送后才能导出。</p>
            <p className="mt-1 text-xs">载入样例，体验已发送研报的导出流程。</p>
            <button type="button" className="ef-btn ef-btn-secondary mt-4" onClick={() => void loadSamples()} disabled={seeding}>
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
              {seeding ? '载入中…' : '载入样例'}
            </button>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            <li className="flex items-center gap-3 py-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={allSelected}
                disabled={exporting != null}
                onChange={() => setSelected(allSelected ? [] : tasks.map((task) => task.id))}
                aria-label="全选已发送研报"
              />
              全选 {tasks.length} 份
            </li>
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3 py-3">
                <input
                  type="checkbox"
                  checked={selected.includes(task.id)}
                  disabled={exporting != null}
                  onChange={() => toggle(task.id)}
                  aria-label={`选择 ${task.company_name ?? task.source_file}`}
                />
                <div className="min-w-0 flex-1">
                  <Link to={`/tasks/${task.id}`} className="truncate text-sm font-medium text-ink hover:underline">
                    {task.company_name ?? task.source_file}
                  </Link>
                  <p className="truncate text-xs text-subtle">
                    {task.source_file} · {formatRelativeTime(task.updated_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ExportHistory logs={logs} loading={loading} failed={error != null} />
    </div>
  );
}
