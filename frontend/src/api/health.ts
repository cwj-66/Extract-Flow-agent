import { getApiBaseUrl } from './client';

export interface HealthResponse {
  status: string;
  queue: string;
  redis: { ok: boolean; url?: string; error?: string };
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${getApiBaseUrl()}/health`);
  if (!res.ok) {
    throw new Error(`health ${res.status}`);
  }
  return res.json() as Promise<HealthResponse>;
}
