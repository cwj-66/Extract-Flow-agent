import { Bot, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { eventLabel } from '../../lib/audit';
import type { AuditEvent } from '../../types';

const dateOptions: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
};
const timeOptions: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
};

/** 在时间线上展示操作者、事件与可展开的原始详情。 */
export function AuditTimeline({ events }: { events: AuditEvent[] }) {
  return (
    <ol className="px-4 py-5 sm:px-5" aria-label="操作时间线">
      {events.map((event) => {
        const system = event.actor === 'system';
        const Marker = system ? Bot : UserRound;
        const actorName = system ? '系统' : event.actor === 'anonymous' ? '匿名操作者' : event.actor;
        const createdAt = new Date(event.created_at);
        return (
          <li key={event.id} className="group relative flex min-w-0 gap-3 sm:gap-4">
            <time dateTime={event.created_at} className="hidden w-28 shrink-0 pt-1 text-right text-xs leading-5 text-muted sm:block">
              <span className="block">{createdAt.toLocaleDateString('zh-CN', dateOptions)}</span>
              <span className="block">{createdAt.toLocaleTimeString('zh-CN', timeOptions)}</span>
            </time>
            <div className="relative flex w-8 shrink-0 justify-center">
              <span className="absolute bottom-0 top-8 w-px bg-line group-last:hidden" aria-hidden="true" />
              <span className={`relative flex h-8 w-8 items-center justify-center rounded-full ${system ? 'bg-canvas text-muted' : 'bg-brand-soft text-brand'}`}>
                <Marker className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <div className="min-w-0 flex-1 pb-6 group-last:pb-0">
              <time dateTime={event.created_at} className="mb-1 block text-xs text-muted sm:hidden">
                {createdAt.toLocaleDateString('zh-CN', dateOptions)} {createdAt.toLocaleTimeString('zh-CN', timeOptions)}
              </time>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <p className="text-sm font-semibold text-ink">{eventLabel(event.event_type)}</p>
                <span className="ef-chip">{system ? '系统事件' : '人工事件'}</span>
              </div>
              <p className="mt-1 break-words text-sm text-ink">{event.message}</p>
              <p className="mt-1 break-words text-xs text-muted">
                {actorName}
                {event.task_id ? <> · <Link className="text-brand hover:underline" to={`/tasks/${event.task_id}`}>查看任务</Link></> : null}
              </p>
              {event.details && Object.keys(event.details).length > 0 ? (
                <details className="mt-2 text-xs">
                  <summary className="w-fit cursor-pointer rounded text-brand">查看详情</summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-line bg-canvas p-3 text-muted" tabIndex={0} aria-label="事件详情">
                    {JSON.stringify(event.details, null, 2)}
                  </pre>
                </details>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
