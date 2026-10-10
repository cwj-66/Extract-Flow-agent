import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Circle, FileText, Loader2 } from 'lucide-react';
import { listTasks } from '../api/tasks';
import { ApiError } from '../api/client';
import { useWorkspace } from '../components/layout/useWorkspace';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PIPELINE_STAGES, pipelineStageIndex } from '../lib/status';
import type { TaskSummary } from '../types';

const PAGE_LIMIT = 100;
const MAX_TASKS = 300;

async function loadPipelineTasks(): Promise<TaskSummary[]> {
  const items: TaskSummary[] = [];
  let offset = 0;
  while (items.length < MAX_TASKS) {
    const page = await listTasks({ offset, limit: PAGE_LIMIT });
    items.push(...page.items);
    if (items.length >= page.total || page.items.length === 0) break;
    offset += PAGE_LIMIT;
  }
  return items;
}

export function PipelinePage() {
  const { refreshKey } = useWorkspace();
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const items = await loadPipelineTasks();
        if (!cancelled) {
          setTasks(items);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : '加载流水线失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, retryKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-subtle">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        加载流水线…
      </div>
    );
  }

  if (error) {
    return (
      <div className="ef-card">
        <ErrorState message={error} onRetry={() => setRetryKey((key) => key + 1)} />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="ef-card">
        <EmptyState
          title="还没有研报"
          description="上传一份 PDF，或先载入样例，就能看到每一步走到哪里。"
          action={
            <Link to="/upload" className="ef-btn ef-btn-primary">
              上传研报
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-brand text-white">
            <Check className="h-2.5 w-2.5" aria-hidden="true" />
          </span>
          已完成
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-4 w-4 rounded-full border-2 border-brand" />
          当前阶段
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Circle className="h-4 w-4 text-subtle" aria-hidden="true" />
          未到
        </span>
      </div>
      <ul className="space-y-3">
        {tasks.map((task) => {
          const current = pipelineStageIndex(task.status);
          return (
            <li key={task.id} className="ef-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="ef-icon-tile bg-brand-soft text-brand">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {task.company_name ?? task.relative_path ?? task.source_file}
                  </p>
                  <p className="truncate text-xs text-subtle">{task.source_file}</p>
                </div>
                <StatusBadge status={task.status} />
                <Link to={`/tasks/${task.id}`} className="text-xs font-medium text-brand hover:underline">
                  打开
                </Link>
              </div>
              <ol className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="处理阶段">
                {PIPELINE_STAGES.map((stage, index) => {
                  const done = current >= 0 && index < current;
                  const active = index === current;
                  const sentDone = task.status === 'sent';
                  const complete = done || (sentDone && index <= current);
                  return (
                    <li key={stage.status} className="min-w-0">
                      <div
                        className={`mb-1 grid h-5 w-5 place-items-center rounded-full ${
                          complete
                            ? 'bg-brand text-white'
                            : active
                              ? 'border-2 border-brand text-brand'
                              : 'border border-line text-subtle'
                        }`}
                      >
                        {complete ? (
                          <Check className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <Circle className="h-2.5 w-2.5" aria-hidden="true" />
                        )}
                      </div>
                      <p className={`truncate text-[11px] ${active || complete ? 'font-medium text-ink' : 'text-subtle'}`}>
                        {stage.label}
                      </p>
                    </li>
                  );
                })}
              </ol>
              {task.status === 'failed' && task.error_message ? (
                <p className="mt-3 text-xs text-danger">{task.error_message}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {tasks.length >= MAX_TASKS ? (
        <p className="text-xs text-subtle">仅显示最近 {MAX_TASKS} 条。更早的任务在任务队列里查找。</p>
      ) : null}
    </div>
  );
}
