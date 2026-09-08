const BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  status: number;
  path: string;
  constructor(status: number, message: string, path: string = '') {
    super(message);
    this.status = status;
    this.path = path;
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(authHeaders() as Record<string, string>) };
  
  try {
    const res = await fetch(url, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) localStorage.removeItem('access_token');
      const errorMsg = (data as { error?: string }).error ?? `HTTP ${res.status}`;
      throw new ApiError(res.status, `${errorMsg}${path ? ` on ${path}` : ''}`, path);
    }
    return data as T;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    throw new ApiError(0, `Network error: ${errorMsg}${path ? ` on ${path}` : ''} (URL: ${url})`, path);
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
