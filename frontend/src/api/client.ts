import { useMockStore } from '../store/mockStore';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

function getBaseUrl(): string {
  return API_BASE_URL.replace(/\/$/, '');
}

function getUserId(): string {
  const uid = useMockStore.getState().generalSettings.userId?.trim();
  return uid || 'anonymous';
}

/** HTTP 头值仅允许 ISO-8859-1，中文等需 percent-encode 后再写入 X-User-Id。 */
function encodeUserIdForHeader(userId: string): string {
  return encodeURIComponent(userId);
}

export function getApiBaseUrl(): string {
  return getBaseUrl();
}

function withAuthHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers);
  headers.set('X-User-Id', encodeUserIdForHeader(getUserId()));
  return headers;
}

function connectionErrorMessage(url: string, err: unknown): string {
  const detail =
    err instanceof Error && err.message ? `（${err.message}）` : '';
  return `无法连接后端 ${url}${detail}。请确认已运行：uvicorn app.api.main:app --reload`;
}

function formatDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg: unknown }).msg);
        }
        return JSON.stringify(item);
      })
      .join('; ');
  }
  if (detail != null) return JSON.stringify(detail);
  return '请求失败';
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 20_000
): Promise<T> {
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: withAuthHeaders(init),
      signal: init?.signal ?? controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(
        0,
        '请求超时：后端可能正在解析文档（CPU 繁忙），请稍后再刷新列表'
      );
    }
    throw new ApiError(0, connectionErrorMessage(url, err));
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let message = response.statusText || `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (body.detail !== undefined) message = formatDetail(body.detail);
    } catch {
      // keep statusText for non-JSON error bodies
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiBlobRequest(
  path: string,
  init?: RequestInit,
  timeoutMs = 60_000
): Promise<{ blob: Blob; filename: string | null }> {
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: withAuthHeaders(init),
      signal: init?.signal ?? controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, '下载超时：后端可能正忙，请稍后再试');
    }
    throw new ApiError(0, connectionErrorMessage(url, err));
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let message = response.statusText || `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (body.detail !== undefined) message = formatDetail(body.detail);
    } catch {
      // keep statusText for non-JSON error bodies
    }
    throw new ApiError(response.status, message);
  }

  const disposition = response.headers.get('Content-Disposition');
  let filename: string | null = null;
  if (disposition) {
    const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    const plain = /filename="?([^";]+)"?/i.exec(disposition);
    if (utf8?.[1]) {
      try {
        filename = decodeURIComponent(utf8[1]);
      } catch {
        filename = utf8[1];
      }
    } else if (plain?.[1]) {
      filename = plain[1];
    }
  }

  const blob = await response.blob();
  return { blob, filename };
}
