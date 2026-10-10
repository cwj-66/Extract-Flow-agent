import { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { listAuditLogs } from '../api/ops';
import { ApiError } from '../api/client';
import { ErrorState } from '../components/ui/ErrorState';
import { AuditTimeline } from '../components/audit/AuditTimeline';
import { useWorkspace } from '../components/layout/useWorkspace';
import { EVENT_FILTER_GROUPS, eventLabel } from '../lib/audit';
import type { AuditEvent } from '../types';

export function AuditPage() {
  const { refreshKey } = useWorkspace();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [actorMode, setActorMode] = useState('');
  const [actorName, setActorName] = useState('');
  const [eventType, setEventType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const actor = actorMode === 'system' ? 'system' : actorMode === 'named' ? actorName.trim() : '';
  const hasFilters = Boolean(search || actorMode || eventType);
  const clearFilters = () => {
    setSearch('');
    setActorMode('');
    setActorName('');
    setEventType('');
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const data = await listAuditLogs({
          search: search.trim() || undefined,
          actor: actor || undefined,
          event_type: eventType || undefined,
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
  }, [search, actor, eventType, retryKey, refreshKey]);

  return (
    <div className="space-y-4">
      <section className="ef-card flex flex-wrap items-center gap-3 p-4">
        <label className="relative w-full sm:min-w-56 sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
          <input
            className="ef-input w-full pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索事件或说明"
            aria-label="搜索审计记录"
          />
        </label>
        <label className="w-full text-sm text-muted sm:w-auto">
          <span className="sr-only">事件类型</span>
          <select className="ef-input" value={eventType} onChange={(event) => setEventType(event.target.value)}>
            <option value="">全部事件</option>
            {EVENT_FILTER_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.types.map((type) => <option key={type} value={type}>{eventLabel(type)}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="w-full text-sm text-muted sm:w-auto">
          <span className="sr-only">操作者</span>
          <select
            className="ef-input"
            value={actorMode}
            onChange={(event) => setActorMode(event.target.value)}
          >
            <option value="">全部操作者</option>
            <option value="system">系统</option>
            <option value="named">指定操作者</option>
          </select>
        </label>
        {actorMode === 'named' ? (
          <input className="ef-input sm:max-w-56" value={actorName} onChange={(event) => setActorName(event.target.value)} placeholder="输入显示名；匿名填 anonymous" aria-label="操作者显示名（精确匹配）" />
        ) : null}
        {hasFilters ? <button type="button" className="ef-btn ef-btn-ghost" onClick={clearFilters}>清除筛选</button> : null}
        <p className="text-xs text-muted" aria-live="polite">{loading ? '加载中' : error ? '加载失败' : `显示 ${events.length} / ${total} 条记录`}</p>
      </section>

      {error ? (
        <div className="ef-card">
          <ErrorState message={error} onRetry={() => setRetryKey((key) => key + 1)} />
        </div>
      ) : null}

      {!error || loading ? <section className="ef-card" aria-busy={loading}>
        {loading ? (
          <div className="flex items-center gap-2 px-5 py-12 text-sm text-subtle">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            加载审计记录…
          </div>
        ) : events.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted">
            <p>{hasFilters ? '没有匹配的操作记录' : '还没有操作记录'}</p>
            {hasFilters ? <button type="button" className="ef-btn ef-btn-secondary mt-3" onClick={clearFilters}>清除筛选</button> : null}
          </div>
        ) : (
          <AuditTimeline events={events} />
        )}
      </section> : null}
    </div>
  );
}
