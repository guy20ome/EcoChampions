const BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(authHeaders() as Record<string, string>) };
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) localStorage.removeItem('access_token');
    throw new ApiError(res.status, (data as { error?: string }).error ?? 'Request failed');
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
