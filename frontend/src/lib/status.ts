import type { TaskStatus } from '../types';

export interface StatusMeta {
  label: string;
  color: string;
  spinning: boolean;
}

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  queued: { label: '排队中', color: 'slate', spinning: false },
  parsing: { label: '解析中', color: 'brand', spinning: true },
  extracting: { label: '提取中', color: 'brand', spinning: true },
  pending_confirm: { label: '待确认', color: 'amber', spinning: false },
  sending: { label: '发送中', color: 'brand', spinning: true },
  sent: { label: '已发送', color: 'green', spinning: false },
  failed: { label: '失败', color: 'red', spinning: false },
};

export function formatRelativeTime(dateStr: string): string {
  // 后端偶发返回无时区 ISO（UTC）；补 Z，避免被当成本地时间偏 8 小时
  const normalized =
    /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(dateStr) ? dateStr : `${dateStr}Z`;
  const now = Date.now();
  const then = new Date(normalized).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}
