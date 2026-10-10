import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Boxes,
  Clock3,
  FileText,
  Loader2,
  UploadCloud,
} from 'lucide-react';
import { listTasks } from '../api/tasks';
import { ApiError } from '../api/client';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ErrorState } from '../components/ui/ErrorState';
import { useWorkspace } from '../components/layout/useWorkspace';
import { formatRelativeTime, STATUS_META } from '../lib/status';
import type { TaskStatus, TaskSummary } from '../types';

const STATUS_ORDER: TaskStatus[] = [
  'queued',
  'parsing',
  'extracting',
  'pending_confirm',
  'sending',
  'sent',
  'failed',
];

interface OverviewStats {
  total: number;
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  byStatus: Record<TaskStatus, number>;
}

function emptyByStatus(): Record<TaskStatus, number> {
  return {
    queued: 0,
    parsing: 0,
    extracting: 0,
    pending_confirm: 0,
    sending: 0,
    sent: 0,
    failed: 0,
  };
}

function emptyStats(): OverviewStats {
  return { total: 0, pending: 0, processing: 0, sent: 0, failed: 0, byStatus: emptyByStatus() };
}

export function OverviewPage() {
  const { refreshKey, seeding, loadSamples } = useWorkspace();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [queue, setQueue] = useState<TaskSummary[]>([]);
  const [recent, setRecent] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [all, pending, sent, failed, queued, parsing, extracting, sending] = await Promise.all([
          listTasks({ limit: 6 }),
          listTasks({ status: 'pending_confirm', limit: 8 }),
          listTasks({ status: 'sent', limit: 1 }),
          listTasks({ status: 'failed', limit: 1 }),
          listTasks({ status: 'queued', limit: 1 }),
          listTasks({ status: 'parsing', limit: 1 }),
          listTasks({ status: 'extracting', limit: 1 }),
          listTasks({ status: 'sending', limit: 1 }),
        ]);
        if (cancelled) return;
        const byStatus: Record<TaskStatus, number> = {
          queued: queued.total,
          parsing: parsing.total,
          extracting: extracting.total,
          pending_confirm: pending.total,
          sending: sending.total,
          sent: sent.total,
          failed: failed.total,
        };
        setStats({
          total: all.total,
          pending: pending.total,
          processing: queued.total + parsing.total + extracting.total + sending.total,
          sent: sent.total,
          failed: failed.total,
          byStatus,
        });
        setQueue(pending.items);
        setRecent(all.items);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setStats(emptyStats());
          setError(err instanceof ApiError ? err.message : '加载总览失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, retryKey]);

  const s = stats ?? emptyStats();
  const rate = s.total > 0 ? Math.round((s.sent / s.total) * 100) : 0;
  const barMax = Math.max(...STATUS_ORDER.map((status) => s.byStatus[status]), 1);

  const metricCards = [
    { label: '研报', value: s.total, hint: '全部任务', to: '/tasks', icon: FileText },
    { label: '待确认', value: s.pending, hint: '需要人工审阅', to: '/tasks?status=pending_confirm', icon: Clock3 },
    { label: '处理中', value: s.processing, hint: '排队、解析、提取、发送', to: '/pipeline', icon: Boxes },
    { label: '已发送', value: s.sent, hint: '已推到飞书', to: '/tasks?status=sent', icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-4">
      <section className="ef-card grid gap-6 p-6 lg:grid-cols-[1.5fr_0.7fr] lg:items-center">
        <div>
          <p className="text-xs font-medium text-brand">研报摘要工作台</p>
          <h2 className="mt-2 max-w-xl text-2xl font-semibold tracking-tight text-ink">
            从 PDF 到可核对的飞书卡片
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            本地解析版面，按固定字段提取。人工确认后才发送，失败可以重试。
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link to="/upload" className="ef-btn ef-btn-primary">
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              上传研报
            </Link>
            <Link to="/pipeline" className="ef-btn ef-btn-secondary">
              查看流水线
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-lg border border-line bg-canvas px-4 py-4">
          <div
            className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 border-brand text-sm font-semibold tabular-nums text-ink"
            aria-label={loading ? '已发送占比计算中' : `已发送占比 ${rate}%`}
          >
            {loading ? '—' : `${rate}%`}
          </div>
          <div>
            <p className="text-sm font-medium text-ink">已发送占比</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {loading ? '正在统计' : `${s.sent} / ${s.total} 份研报已推到飞书`}
            </p>
          </div>
        </div>
      </section>

      {error && !loading ? (
        <div className="ef-card">
          <ErrorState message={error} onRetry={() => setRetryKey((key) => key + 1)} />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <Link key={card.label} to={card.to} className="ef-card ef-card-hover block p-4">
            <div className="ef-icon-tile bg-brand-soft text-brand">
              <card.icon className="h-4 w-4" aria-hidden="true" />
            </div>
            <p className="mt-4 text-[28px] font-semibold tabular-nums tracking-tight text-ink">
              {loading ? '—' : card.value}
            </p>
            <p className="mt-1 text-sm font-medium text-ink">{card.label}</p>
            <p className="mt-0.5 text-xs text-subtle">{card.hint}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="ef-card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-ink">状态分布</h3>
          <p className="mt-0.5 text-xs text-subtle">按当前任务状态计数</p>
          <ul className="mt-4 space-y-3">
            {STATUS_ORDER.map((status) => {
              const value = s.byStatus[status];
              const width = loading ? 0 : Math.round((value / barMax) * 100);
              return (
                <li key={status}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted">{STATUS_META[status].label}</span>
                    <span className="tabular-nums text-ink">{loading ? '—' : value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${width}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          {s.failed > 0 ? (
            <Link to="/tasks?status=failed" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand">
              <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
              {s.failed} 条失败可重试
            </Link>
          ) : null}
        </section>

        <section className="ef-card lg:col-span-3">
          <div className="flex items-center justify-between px-5 py-4">
            <h3 className="text-sm font-semibold text-ink">待审阅队列</h3>
            <Link to="/tasks?status=pending_confirm" className="text-xs font-medium text-brand hover:underline">
              全部待确认
            </Link>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 px-5 py-12 text-sm text-subtle">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              加载队列…
            </div>
          ) : queue.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-ink">暂无待确认任务</p>
              <p className="mt-1 text-xs text-subtle">载入样例即可审阅，不必等待模型</p>
              <div className="mt-5 flex items-center justify-center gap-2">
                <button type="button" className="ef-btn ef-btn-secondary" onClick={() => void loadSamples()} disabled={seeding}>
                  载入样例
                </button>
                <Link to="/upload" className="ef-btn ef-btn-primary">
                  去上传
                </Link>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {queue.map((task) => (
                <li key={task.id}>
                  <Link
                    to={`/tasks/${task.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-canvas"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {task.company_name ?? task.relative_path ?? task.source_file}
                        {task.stock_code ? (
                          <span className="ml-1.5 font-normal text-muted">{task.stock_code}</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-subtle">
                        {task.source_file} · {formatRelativeTime(task.updated_at)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="ef-card">
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-sm font-semibold text-ink">最近任务</h3>
          <Link to="/tasks" className="text-xs font-medium text-brand hover:underline">
            任务列表
          </Link>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-sm text-subtle">加载中…</div>
        ) : recent.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-subtle">还没有任务</div>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((task) => (
              <li key={task.id}>
                <Link
                  to={task.batch_id ? `/batches/${task.batch_id}` : `/tasks/${task.id}`}
                  className="flex items-center justify-between gap-2 px-5 py-3 hover:bg-canvas"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{task.company_name ?? task.source_file}</p>
                    <p className="mt-0.5 text-xs text-subtle">{formatRelativeTime(task.updated_at)}</p>
                  </div>
                  <StatusBadge status={task.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
