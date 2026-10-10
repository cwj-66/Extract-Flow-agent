import { apiBlobRequest, apiRequest } from './client';
import type { AuditEvent, DashboardOverview, ExportRecord, TaskSummary } from '../types';

export function bootstrapDemo(): Promise<TaskSummary[]> {
  return apiRequest<TaskSummary[]>('/demo/bootstrap', { method: 'POST' });
}

export function getOverview(): Promise<DashboardOverview> {
  return apiRequest<DashboardOverview>('/dashboard/overview');
}

export function listAuditLogs(params: {
  search?: string;
  actor?: string;
  event_type?: string;
  task_id?: string;
  limit?: number;
} = {}): Promise<{ items: AuditEvent[]; total: number }> {
  const search = new URLSearchParams();
  if (params.search) search.set('search', params.search);
  if (params.actor) search.set('actor', params.actor);
  if (params.event_type) search.set('event_type', params.event_type);
  if (params.task_id) search.set('task_id', params.task_id);
  if (params.limit != null) search.set('limit', String(params.limit));
  const qs = search.toString();
  return apiRequest(`/audit-logs${qs ? `?${qs}` : ''}`);
}

export function exportSent(kind: 'csv' | 'json', taskIds: string[]): Promise<ExportRecord> {
  return apiRequest<ExportRecord>(`/export/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_ids: taskIds }),
  });
}

export function listExports(): Promise<ExportRecord[]> {
  return apiRequest<ExportRecord[]>('/export-logs');
}

export async function downloadExport(record: ExportRecord): Promise<void> {
  const { blob, filename } = await apiBlobRequest(record.download_url);
  const name = filename || `export.${record.export_type}`;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = name;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
