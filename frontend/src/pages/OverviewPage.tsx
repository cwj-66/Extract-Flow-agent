import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Braces,
  FileText,
  Loader2,
  Send,
  ShieldCheck,
  UploadCloud,
  Clock3,
  CircleAlert,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { listTasks } from '../api/tasks';
import { fetchHealth, type HealthResponse } from '../api/health';
import { ApiError } from '../api/client';
import { PipelineStrip } from '../components/pipeline/PipelineStrip';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ErrorState } from '../components/ui/ErrorState';
import { formatRelativeTime } from '../lib/status';
import type { TaskSummary } from '../types';

interface OverviewStats {
  total: number;
  pending: number;
  processing: number;
  sent: number;
  failed: number;
}

const CAPABILITIES = [
  {
    title: '本地解析，不烧 Token',
    body: 'MinerU 完成版面、表格与图表分路；装饰图在进模型前过滤。',
    tags: ['MinerU', '零 Token'],
    icon: FileText,
    tile: 'bg-[#e8f3ff] text-brand',
  },
  {
    title: 'JSON Schema 约束提取',
    body: 'DashScope 按固定字段输出营收、评级、预测与风险，避免自由文本漂移。',
    tags: ['Schema', '15 字段'],
    icon: Braces,
    tile: 'bg-[#e8ffea] text-emerald-700',
  },
  {
    title: '字段回溯原文',
    body: '审阅时把提取值定位到清洗 Markdown，改完再发，不是黑盒问答。',
    tags: ['可回溯', '人工确认'],
    icon: ShieldCheck,
    tile: 'bg-[#fff3e8] text-amber-700',
  },
  {
    title: '确认后推飞书',
    body: 'Card v2 + 群 Webhook，失败可重试；CLI 与 API 共用同一条管线。',
    tags: ['Card v2', 'Webhook'],
    icon: Send,
    tile: 'bg-[#e8f7ff] text-sky-700',
  },
];

function emptyStats(): OverviewStats {
  return { total: 0, pending: 0, processing: 0, sent: 0, failed: 0 };
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export function OverviewPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [queue, setQueue] = useState<TaskSummary[]>([]);
  const [recent, setRecent] = useState<TaskSummary[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [all, pending, sent, failed, queued, parsing, extracting, sending, healthRes] =
          await Promise.all([
            listTasks({ limit: 6 }),
            listTasks({ status: 'pending_confirm', limit: 8 }),
            listTasks({ status: 'sent', limit: 1 }),
            listTasks({ status: 'failed', limit: 1 }),
            listTasks({ status: 'queued', limit: 1 }),
            listTasks({ status: 'parsing', limit: 1 }),
            listTasks({ status: 'extracting', limit: 1 }),
            listTasks({ status: 'sending', limit: 1 }),
            fetchHealth().catch(() => null),
          ]);
        if (cancelled) return;
        setStats({
          total: all.total,
          pending: pending.total,
          processing: queued.total + parsing.total + extracting.total + sending.total,
          sent: sent.total,
          failed: failed.total,
        });
        setQueue(pending.items);
        setRecent(all.items);
        setHealth(healthRes);
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
  }, [reloadKey]);

  const s = stats ?? emptyStats();
  const apiUp = health?.status === 'ok' || health?.status === 'degraded';

  const metricCards = [
    {
      label: '待确认',
      value: s.pending,
      hint: '需要人工审阅',
      to: '/tasks?status=pending_confirm',
      icon: Sparkles,
      tile: 'bg-[#fff3e8] text-amber-700',
    },
    {
      label: '处理中',
      value: s.processing,
      hint: '解析 / 提取 / 发送',
      to: '/tasks',
      icon: Clock3,
      tile: 'bg-brand-soft text-brand',
    },
    {
      label: '已发送',
      value: s.sent,
      hint: '已推到飞书',
      to: '/tasks?status=sent',
      icon: CheckCircle2,
      tile: 'bg-[#e8ffea] text-emerald-700',
    },
    {
      label: '失败',
      value: s.failed,
      hint: '可在详情重试',
      to: '/tasks?status=failed',
      icon: CircleAlert,
      tile: 'bg-red-50 text-red-600',
    },
  ];

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{greeting()}，欢迎回来</p>
          <h2 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-ink">
            把研报要点，变成可确认的飞书卡片
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            上传 PDF → 本地解析 → 结构化提取 → 人工确认 → 飞书推送
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
              health == null
                ? 'border-line text-subtle'
                : apiUp
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                health == null ? 'bg-subtle' : apiUp ? 'bg-emerald-500' : 'bg-red-500'
              }`}
              aria-hidden="true"
            />
            {health == null
              ? 'API 未检测'
              : apiUp
                ? `API ${health.queue === 'celery' ? 'Celery' : '进程内队列'}`
                : 'API 异常'}
          </span>
          <Link to="/upload" className="ef-btn ef-btn-primary px-4 py-2">
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            上传研报
          </Link>
        </div>
      </section>

      {error && !loading ? (
        <div className="ef-card">
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <Link
            key={card.label}
            to={card.to}
            className="ef-card ef-card-hover block p-4"
          >
            <div className={`ef-icon-tile ${card.tile}`}>
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

      <section className="ef-card p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-ink">处理管线</h3>
            <p className="mt-0.5 text-xs text-subtle">解析在本地完成，仅提取步骤消耗模型 Token</p>
          </div>
        </div>
        <PipelineStrip />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">能力亮点</h3>
          <span className="text-xs text-subtle">从解析到投递，一条完整链路</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {CAPABILITIES.map((item) => (
            <div key={item.title} className="ef-card p-4">
              <div className={`ef-icon-tile ${item.tile}`}>
                <item.icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-ink">{item.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{item.body}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {item.tags.map((tag) => (
                  <span key={tag} className="ef-chip">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
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
              <p className="mt-1 text-xs text-subtle">上传研报后，提取完成会出现在这里</p>
              <Link to="/upload" className="ef-btn ef-btn-primary mt-5">
                去上传
              </Link>
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

        <section className="ef-card lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-4">
            <h3 className="text-sm font-semibold text-ink">最近任务</h3>
            <Link to="/tasks" className="text-xs font-medium text-brand hover:underline">
              任务列表
            </Link>
          </div>
          {loading ? (
            <div className="px-5 py-12 text-sm text-subtle">加载中…</div>
          ) : recent.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-subtle">还没有任务</div>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((task) => (
                <li key={task.id}>
                  <Link
                    to={task.batch_id ? `/batches/${task.batch_id}` : `/tasks/${task.id}`}
                    className="flex items-center justify-between gap-2 px-5 py-3.5 hover:bg-canvas"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">
                        {task.company_name ?? task.source_file}
                      </p>
                      <p className="mt-0.5 text-xs text-subtle">{formatRelativeTime(task.updated_at)}</p>
                    </div>
                    <StatusBadge status={task.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {s.total > 0 && (
            <p className="border-t border-line px-5 py-2.5 text-xs text-subtle">共 {s.total} 条任务</p>
          )}
        </section>
      </div>
    </div>
  );
}
