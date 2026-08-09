import { apiBlobRequest, apiRequest } from './client';
import type {
  BatchResponse,
  BatchUploadResponse,
  TaskConfirmRequest,
  TaskConfirmResponse,
  TaskContentResponse,
  TaskListResponse,
  TaskResultResponse,
  TaskStatus,
  TaskSummary,
  UploadResponse,
} from '../types';

export interface ListTasksParams {
  q?: string;
  status?: TaskStatus;
  batch_id?: string;
  offset?: number;
  limit?: number;
}

export function uploadDocument(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  return apiRequest<UploadResponse>(
    '/upload',
    {
      method: 'POST',
      body: form,
    },
    60_000
  );
}

export function uploadBatch(
  files: File[],
  batchName?: string
): Promise<BatchUploadResponse> {
  const form = new FormData();
  for (const file of files) {
    const relative =
      'webkitRelativePath' in file && file.webkitRelativePath
        ? file.webkitRelativePath
        : file.name;
    form.append('files', file, relative);
  }
  if (batchName) form.append('batch_name', batchName);
  return apiRequest<BatchUploadResponse>(
    '/upload/batch',
    {
      method: 'POST',
      body: form,
    },
    120_000
  );
}

export function getBatch(batchId: string): Promise<BatchResponse> {
  return apiRequest<BatchResponse>(`/batches/${encodeURIComponent(batchId)}`);
}

export function listTasks(params: ListTasksParams = {}): Promise<TaskListResponse> {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.status) search.set('status', params.status);
  if (params.batch_id) search.set('batch_id', params.batch_id);
  if (params.offset != null) search.set('offset', String(params.offset));
  if (params.limit != null) search.set('limit', String(params.limit));
  const qs = search.toString();
  return apiRequest<TaskListResponse>(`/tasks${qs ? `?${qs}` : ''}`);
}

export function getTask(taskId: string): Promise<TaskSummary> {
  return apiRequest<TaskSummary>(`/tasks/${encodeURIComponent(taskId)}`);
}

export function deleteTask(taskId: string): Promise<void> {
  return apiRequest<void>(`/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
  });
}

export function getTaskResult(taskId: string): Promise<TaskResultResponse> {
  return apiRequest<TaskResultResponse>(`/tasks/${encodeURIComponent(taskId)}/result`);
}

export function getTaskContent(taskId: string): Promise<TaskContentResponse> {
  return apiRequest<TaskContentResponse>(`/tasks/${encodeURIComponent(taskId)}/content`);
}

export async function downloadTaskFile(
  taskId: string,
  fallbackFilename = 'download'
): Promise<void> {
  const { blob, filename } = await apiBlobRequest(
    `/tasks/${encodeURIComponent(taskId)}/file`
  );
  const name = filename || fallbackFilename;
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

export function confirmTask(
  taskId: string,
  body: TaskConfirmRequest = {}
): Promise<TaskConfirmResponse> {
  return apiRequest<TaskConfirmResponse>(`/tasks/${encodeURIComponent(taskId)}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
