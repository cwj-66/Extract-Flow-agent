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
import { getOverview } from '../api/ops';
import { ApiError } from '../api/client';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ErrorState } from '../components/ui/ErrorState';
import { useWorkspace } from '../components/layout/useWorkspace';
import { eventLabel } from '../lib/audit';
import { formatRelativeTime, STATUS_META } from '../lib/status';
import type { DashboardOverview, TaskStatus } from '../types';

const STATUS_ORDER: TaskStatus[] = [
  'queued',
  'parsing',
  'extracting',
  'pending_confirm',
  'sending',
  'sent',
  'failed',
];

const VALIDATION_LABELS = [
  { key: 'valid' as const, label: '通过' },
  { key: 'warning' as const, label: '需核对' },
  { key: 'failed' as const, label: '有错误' },
];

function formatElapsed(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} 毫秒`;
  return `${(ms / 1000).toFixed(1)} 秒`;
}

export function OverviewPage() {
  const { refreshKey, seeding, loadSamples } = useWorkspace();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await getOverview();
        if (cancelled) return;
        setOverview(data);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setOverview(null);
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

  const total = overview?.total ?? 0;
  const pending = overview?.pending_confirm ?? 0;
  const processing = overview?.processing ?? 0;
  const sent = overview?.sent ?? 0;
  const failed = overview?.failed ?? 0;
  const rate = total > 0 ? Math.round((sent / total) * 100) : 0;
  const barMax = Math.max(...STATUS_ORDER.map((status) => overview?.by_status?.[status] ?? 0), 1);
  const editRate =
    overview?.edit_rate == null ? '—' : `${Math.round(overview.edit_rate * 100)}%`;

  const metricCards = [
    { label: '研报', value: total, hint: '全部任务', to: '/tasks', icon: FileText },
    { label: '待确认', value: pending, hint: '需要人工审阅', to: '/tasks?status=pending_confirm', icon: Clock3 },
    { label: '处理中', value: processing, hint: '排队、解析、提取、发送', to: '/pipeline', icon: Boxes },
    { label: '已发送', value: sent, hint: '已推到飞书', to: '/tasks?status=sent', icon: CheckCircle2 },
  ];

  const queue = overview?.review_queue ?? [];
  const recent = overview?.recent_tasks ?? [];
  const events = overview?.recent_events ?? [];

  return (
    <div className="space-y-4">
      <section className="ef-card grid gap-6 p-6 lg:grid-cols-[1.5fr_0.7fr] lg:items-center">
        <div>
          <p className="text-xs font-medium text-brand">研报摘要工作台</p>
          <h2 className="mt-2 max-w-xl text-2xl font-semibold tracking-tight text-ink">
            从 PDF 到可核对的飞书卡片
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            解析正文、表格与公式，按固定字段提取。人工确认后才发送，失败可以重试。
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
              {loading ? '正在统计' : `${sent} / ${total} 份研报已推到飞书`}
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

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="ef-card p-4">
          <p className="text-xs text-subtle">人工修改比例</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-ink">{loading ? '—' : editRate}</p>
          <p className="mt-0.5 text-xs text-muted">
            {loading ? '统计已发送快照' : `${overview?.edited_send_count ?? 0} / ${overview?.sent_with_log_count ?? 0} 次发送改过字段`}
          </p>
        </div>
        <div className="ef-card p-4">
          <p className="text-xs text-subtle">平均提取耗时</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
            {loading ? '—' : formatElapsed(overview?.avg_elapsed_ms ?? null)}
          </p>
          <p className="mt-0.5 text-xs text-muted">有耗时记录的提取</p>
        </div>
        <div className="ef-card p-4">
          <p className="text-xs text-subtle">估算费用</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
            {loading ? '—' : `¥${(overview?.total_estimated_cny ?? 0).toFixed(2)}`}
          </p>
          <p className="mt-0.5 text-xs text-muted">字段提取阶段，不含图像描述</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="ef-card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-ink">状态分布</h3>
          <p className="mt-0.5 text-xs text-subtle">按当前任务状态计数</p>
          <ul className="mt-4 space-y-3">
            {STATUS_ORDER.map((status) => {
              const value = overview?.by_status?.[status] ?? 0;
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
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
            {VALIDATION_LABELS.map((item) => (
              <span key={item.key} className="rounded-md bg-canvas px-2 py-1">
                {item.label} {loading ? '—' : overview?.validation?.[item.key] ?? 0}
              </span>
            ))}
          </div>
          {failed > 0 ? (
            <Link to="/tasks?status=failed" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand">
              <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
              {failed} 条失败可重试
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

      <div className="grid gap-4 lg:grid-cols-2">
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

        <section className="ef-card">
          <div className="flex items-center justify-between px-5 py-4">
            <h3 className="text-sm font-semibold text-ink">最近操作</h3>
            <Link to="/audit" className="text-xs font-medium text-brand hover:underline">
              审计记录
            </Link>
          </div>
          {loading ? (
            <div className="px-5 py-8 text-sm text-subtle">加载中…</div>
          ) : events.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-subtle">还没有操作记录</div>
          ) : (
            <ul className="divide-y divide-line">
              {events.map((event) => (
                <li key={event.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-ink">{eventLabel(event.event_type)}</p>
                    <p className="shrink-0 text-xs text-subtle">{formatRelativeTime(event.created_at)}</p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">{event.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
