import { useState, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ChevronRight, UploadCloud, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteTask, listTasks } from '../api/tasks';
import { ApiError } from '../api/client';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { TableSkeleton } from '../components/ui/LoadingSkeleton';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { formatRelativeTime } from '../lib/status';
import type { TaskStatus, TaskSummary } from '../types';

const STATUS_OPTIONS: { value: TaskStatus | ''; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'queued', label: '排队中' },
  { value: 'parsing', label: '解析中' },
  { value: 'extracting', label: '提取中' },
  { value: 'pending_confirm', label: '待确认' },
  { value: 'sending', label: '发送中' },
  { value: 'sent', label: '已发送' },
  { value: 'failed', label: '失败' },
];

const PAGE_SIZE = 10;

function clampPage(page: number, totalPages: number) {
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(page, Math.max(1, totalPages));
}

export function TaskListPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [items, setItems] = useState<TaskSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<TaskSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await listTasks({
          q: query.trim() || undefined,
          status: statusFilter || undefined,
          offset: (page - 1) * PAGE_SIZE,
          limit: PAGE_SIZE,
        });
        if (!cancelled) {
          setItems(data.items);
          setTotal(data.total);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : '加载失败，请重试');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, statusFilter, page, reloadKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const goToPage = (next: number) => {
    setPage(clampPage(next, totalPages));
  };

  const commitPageInput = () => {
    const parsed = Number.parseInt(pageInput.trim(), 10);
    if (Number.isNaN(parsed)) {
      setPageInput(String(page));
      return;
    }
    goToPage(parsed);
  };

  const handlePageInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitPageInput();
    }
  };

  const handlePageFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    commitPageInput();
  };

  const handleQueryChange = (v: string) => {
    setQuery(v);
    setPage(1);
  };

  const handleStatusChange = (v: TaskStatus | '') => {
    setStatusFilter(v);
    setPage(1);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTask(deleteTarget.id);
      toast.success('任务已删除');
      setDeleteTarget(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="搜索任务"
            placeholder="搜索公司名称或文件名"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white/90 py-2 pl-9 pr-4 text-sm text-slate-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <select
          aria-label="筛选状态"
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value as TaskStatus | '')}
          className="rounded-xl border border-stone-200 bg-white/90 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => navigate('/upload')}
          className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
        >
          <UploadCloud className="h-4 w-4" aria-hidden="true" />
          上传研报
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white/90 shadow-md">
        {loading ? (
          <div className="p-4">
            <TableSkeleton />
          </div>
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="暂无任务"
            description={query || statusFilter ? '无匹配结果' : '暂无任务记录'}
            action={
              !query && !statusFilter ? (
                <Link
                  to="/upload"
                  className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  上传研报
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-100">
                <thead>
                  <tr className="bg-stone-50/80 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">
                    <th className="px-4 py-3">公司</th>
                    <th className="px-4 py-3">代码</th>
                    <th className="px-4 py-3">文件名</th>
                    <th className="px-4 py-3">状态</th>
                    <th className="px-4 py-3">更新时间</th>
                    <th className="px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {items.map((task) => (
                    <tr
                      key={task.id}
                      onClick={() => navigate(`/tasks/${task.id}`)}
                      className="cursor-pointer transition hover:bg-teal-50/40"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-800">
                        {task.company_name ?? '\u2014'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {task.stock_code ?? '\u2014'}
                      </td>
                      <td className="max-w-xs px-4 py-3">
                        <span
                          className="block truncate text-sm text-slate-600"
                          title={task.relative_path ?? task.source_file}
                        >
                          {task.relative_path ?? task.source_file}
                        </span>
                        {task.batch_id && (
                          <Link
                            to={`/batches/${task.batch_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5 inline-block text-xs text-teal-600 hover:text-teal-700"
                          >
                            查看批次
                          </Link>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {formatRelativeTime(task.updated_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/tasks/${task.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700"
                            aria-label={`查看详情 ${task.company_name ?? task.source_file}`}
                          >
                            详情
                            <ChevronRight className="h-3 w-3" aria-hidden="true" />
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(task);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-500 transition hover:bg-red-50"
                            aria-label={`删除 ${task.company_name ?? task.source_file}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-4 py-3">
              <p className="text-xs text-slate-500">
                共 {total} 条 · 每页 {PAGE_SIZE} 条 · 第 {page}/{totalPages} 页
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className="rounded-lg px-2.5 py-1 text-xs text-slate-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  上一页
                </button>
                <form
                  onSubmit={handlePageFormSubmit}
                  className="flex items-center gap-1.5 text-xs text-slate-600"
                >
                  <label htmlFor="task-list-page-input" className="sr-only">
                    跳转到页码
                  </label>
                  <span>第</span>
                  <input
                    id="task-list-page-input"
                    type="number"
                    min={1}
                    max={totalPages}
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onBlur={commitPageInput}
                    onKeyDown={handlePageInputKeyDown}
                    className="w-14 rounded-lg border border-stone-200 px-1.5 py-1 text-center text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    aria-label="页码"
                  />
                  <span>/ {totalPages} 页</span>
                  <button
                    type="submit"
                    className="rounded-lg border border-stone-200 px-2 py-1 text-xs text-slate-600 hover:bg-stone-50"
                  >
                    跳转
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  className="rounded-lg px-2.5 py-1 text-xs text-slate-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除任务"
        description={`删除后不可恢复：${deleteTarget?.relative_path ?? deleteTarget?.source_file ?? ''}，是否继续？`}
        confirmLabel="删除"
        tone="danger"
        loading={deleting}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
