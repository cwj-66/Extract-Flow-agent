import { useState, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ChevronRight, UploadCloud, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { deleteTask, listTasks } from '../api/tasks';
import { ApiError } from '../api/client';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { TableSkeleton } from '../components/ui/LoadingSkeleton';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PageHeader } from '../components/layout/PageHeader';
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

function parseStatusParam(raw: string | null): TaskStatus | '' {
  if (!raw) return '';
  return STATUS_OPTIONS.some((o) => o.value === raw) ? (raw as TaskStatus) : '';
}

const PAGE_SIZE = 10;

function clampPage(page: number, totalPages: number) {
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(page, Math.max(1, totalPages));
}

export function TaskListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const statusFilter = parseStatusParam(searchParams.get('status'));
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
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v) next.set('status', v);
        else next.delete('status');
        return next;
      },
      { replace: true }
    );
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
    <div className="space-y-5">
      <PageHeader
        title="任务队列"
        description="按公司、文件名或状态查找，点进详情审阅字段后再发飞书。"
        action={
          <button
            onClick={() => navigate('/upload')}
            className="ef-btn ef-btn-primary"
          >
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            上传研报
          </button>
        }
      />
      <div className="relative min-w-52">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label="搜索任务"
          placeholder="搜索公司名称或文件名"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          className="ef-input pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="按状态筛选">
        {STATUS_OPTIONS.map((o) => (
          <button
            key={o.value || 'all'}
            type="button"
            role="tab"
            aria-selected={statusFilter === o.value}
            onClick={() => handleStatusChange(o.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === o.value
                ? 'bg-brand text-white'
                : 'bg-surface text-muted ring-1 ring-line hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="ef-card overflow-hidden">
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
                <Link to="/upload" className="ef-btn ef-btn-primary">
                  上传研报
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {items.map((task) => (
                <li key={task.id} className="flex items-stretch hover:bg-canvas">
                  <Link
                    to={`/tasks/${task.id}`}
                    className="flex min-w-0 flex-1 items-center gap-4 px-5 py-3.5"
                    aria-label={`查看详情 ${task.company_name ?? task.source_file}`}
                  >
                    <div className="ef-icon-tile bg-brand-soft text-brand">
                      <FileText className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {task.company_name ?? task.relative_path ?? task.source_file}
                        {task.stock_code ? (
                          <span className="ml-1.5 font-normal tabular-nums text-muted">
                            {task.stock_code}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-subtle" title={task.relative_path ?? task.source_file}>
                        {task.relative_path ?? task.source_file}
                        <span className="mx-1.5">·</span>
                        {formatRelativeTime(task.updated_at)}
                      </p>
                    </div>
                    <StatusBadge status={task.status} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
                  </Link>
                  <div className="flex shrink-0 items-center gap-1 pr-4">
                    {task.batch_id && (
                      <Link
                        to={`/batches/${task.batch_id}`}
                        className="rounded-md px-2 py-1 text-xs text-brand hover:bg-brand-soft"
                      >
                        批次
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(task)}
                      className="inline-flex items-center rounded-md p-1.5 text-subtle hover:bg-red-50 hover:text-red-500"
                      aria-label={`删除 ${task.company_name ?? task.source_file}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5">
              <p className="text-xs text-subtle">
                共 {total} 条 · 每页 {PAGE_SIZE} 条 · 第 {page}/{totalPages} 页
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className="rounded px-2.5 py-1 text-xs text-muted hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40"
                >
                  上一页
                </button>
                <form
                  onSubmit={handlePageFormSubmit}
                  className="flex items-center gap-1.5 text-xs text-muted"
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
                    className="w-14 rounded-md border border-line px-1.5 py-1 text-center text-xs text-ink focus:border-brand focus:outline-none"
                    aria-label="页码"
                  />
                  <span>/ {totalPages} 页</span>
                  <button
                    type="submit"
                    className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:bg-canvas"
                  >
                    跳转
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  className="rounded px-2.5 py-1 text-xs text-muted hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40"
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
