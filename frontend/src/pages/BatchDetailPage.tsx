// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, FolderOpen, Loader2 } from 'lucide-react';
import { getBatch } from '../api/tasks';
import { ApiError } from '../api/client';
import { useMockStore } from '../store/mockStore';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ErrorState } from '../components/ui/ErrorState';
import { TableSkeleton } from '../components/ui/LoadingSkeleton';
import { formatRelativeTime } from '../lib/status';
import type { BatchResponse, RejectedUpload, TaskStatus } from '../types';

const ACTIVE_STATUSES = new Set<TaskStatus>([
  'queued',
  'parsing',
  'extracting',
  'sending',
]);

interface BatchLocationState {
  rejected?: RejectedUpload[];
}

function countCompleted(batch: BatchResponse): number {
  const c = batch.counts;
  return c.pending_confirm + c.sending + c.sent + c.failed;
}

function countInFlight(batch: BatchResponse): number {
  const c = batch.counts;
  return c.queued + c.parsing + c.extracting;
}

export function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const pollIntervalSec = useMockStore((s) => s.generalSettings.pollIntervalSec);
  const initialRejected = (location.state as BatchLocationState | null)?.rejected ?? [];

  const [batch, setBatch] = useState<BatchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    let timer: number | undefined;

    const load = async () => {
      try {
        const data = await getBatch(id);
        if (cancelled) return;
        setBatch(data);
        setError(null);
        setLoading(false);

        const stillRunning = data.tasks.some((t) => ACTIVE_STATUSES.has(t.status));
        if (stillRunning) {
          timer = window.setTimeout(load, pollIntervalSec * 1000);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : '加载批次失败');
        setLoading(false);
      }
    };

    setLoading(true);
    void load();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [id, pollIntervalSec, reloadKey]);

  const progress = useMemo(() => {
    if (!batch || batch.total === 0) return 0;
    return Math.round((countCompleted(batch) / batch.total) * 100);
  }, [batch]);

  const inFlight = batch ? countInFlight(batch) : 0;
  const completed = batch ? countCompleted(batch) : 0;

  if (!id) {
    return (
      <ErrorState message="缺少批次 ID" onRetry={() => navigate('/upload')} />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="ef-btn ef-btn-secondary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          返回
        </button>
        <Link
          to="/upload"
          className="text-sm font-medium text-brand hover:underline"
        >
          继续上传
        </Link>
      </div>

      {loading && !batch ? (
        <div className="ef-card p-4">
          <TableSkeleton />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : batch ? (
        <>
          <div className="ef-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-slate-500">
                  <FolderOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-medium uppercase tracking-wider">
                    批量任务
                  </span>
                </div>
                <h2 className="mt-1 truncate text-lg font-semibold text-slate-900">
                  {batch.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  共 {batch.total} 个文件 · 创建于{' '}
                  {formatRelativeTime(batch.created_at)}
                </p>
              </div>
              {inFlight > 0 && (
                <div className="flex items-center gap-2 rounded-md bg-brand-soft px-3 py-2 text-sm text-brand">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {inFlight} 个处理中（最多 3 个并发）
                </div>
              )}
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-slate-600">整体进度</span>
                <span className="font-medium text-slate-800">
                  {completed}/{batch.total}（{progress}%）
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="批次处理进度"
              >
                <div
                  className="h-full rounded-full bg-brand transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {batch.counts.queued > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                  排队 {batch.counts.queued}
                </span>
              )}
              {batch.counts.parsing + batch.counts.extracting > 0 && (
                <span className="rounded bg-brand-soft px-2.5 py-1 text-brand">
                  处理中 {batch.counts.parsing + batch.counts.extracting}
                </span>
              )}
              {batch.counts.pending_confirm > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">
                  待确认 {batch.counts.pending_confirm}
                </span>
              )}
              {batch.counts.sent > 0 && (
                <span className="rounded-full bg-green-100 px-2.5 py-1 text-green-700">
                  已发送 {batch.counts.sent}
                </span>
              )}
              {batch.counts.failed > 0 && (
                <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-700">
                  失败 {batch.counts.failed}
                </span>
              )}
            </div>
          </div>

          {initialRejected.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">上传时已跳过 {initialRejected.length} 个文件</p>
              <ul className="mt-2 space-y-1 text-xs text-amber-800">
                {initialRejected.map((item) => (
                  <li key={item.filename}>
                    {item.filename} — {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="ef-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">文件</th>
                    <th className="px-4 py-3">公司</th>
                    <th className="px-4 py-3">状态</th>
                    <th className="px-4 py-3">更新时间</th>
                    <th className="px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batch.tasks.map((task) => (
                    <tr
                      key={task.id}
                      onClick={() => navigate(`/tasks/${task.id}`)}
                      className="cursor-pointer transition hover:bg-slate-50"
                    >
                      <td className="max-w-md px-4 py-3">
                        <span
                          className="block truncate text-sm text-slate-700"
                          title={task.relative_path ?? task.source_file}
                        >
                          {task.relative_path ?? task.source_file}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {task.company_name ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {formatRelativeTime(task.updated_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Link
                          to={`/tasks/${task.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                        >
                          查看
                          <ChevronRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
