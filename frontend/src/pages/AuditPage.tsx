import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search } from 'lucide-react';
import { listAuditLogs } from '../api/ops';
import { ApiError } from '../api/client';
import { ErrorState } from '../components/ui/ErrorState';
import { eventLabel } from '../lib/audit';
import { formatRelativeTime } from '../lib/status';
import type { AuditEvent } from '../types';

export function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [actor, setActor] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await listAuditLogs({
          search: search.trim() || undefined,
          actor: actor || undefined,
          limit: 200,
        });
        if (!cancelled) {
          setEvents(data.items);
          setTotal(data.total);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : '加载审计记录失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, actor, retryKey]);

  return (
    <div className="space-y-4">
      <section className="ef-card flex flex-wrap items-center gap-3 p-4">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
          <input
            className="ef-input w-full pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索事件或说明"
            aria-label="搜索审计记录"
          />
        </label>
        <label className="text-sm text-muted">
          <span className="sr-only">操作者</span>
          <select
            className="ef-input"
            value={actor}
            onChange={(event) => setActor(event.target.value)}
          >
            <option value="">全部操作者</option>
            <option value="system">系统</option>
          </select>
        </label>
        <p className="text-xs text-subtle">{loading ? '加载中' : `${total} 条记录`}</p>
      </section>

      {error ? (
        <div className="ef-card">
          <ErrorState message={error} onRetry={() => setRetryKey((key) => key + 1)} />
        </div>
      ) : null}

      <section className="ef-card">
        {loading ? (
          <div className="flex items-center gap-2 px-5 py-12 text-sm text-subtle">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            加载审计记录…
          </div>
        ) : events.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-subtle">没有匹配的操作记录</div>
        ) : (
          <ul className="divide-y divide-line">
            {events.map((event) => (
              <li key={event.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[140px_1fr]">
                <div>
                  <p className="text-sm font-medium text-ink">{eventLabel(event.event_type)}</p>
                  <p className="mt-1 text-xs text-subtle">{formatRelativeTime(event.created_at)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-ink">{event.message}</p>
                  <p className="mt-1 text-xs text-muted">
                    {event.actor}
                    {event.task_id ? (
                      <>
                        {' · '}
                        <Link className="text-brand hover:underline" to={`/tasks/${event.task_id}`}>
                          查看任务
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
