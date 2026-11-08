import type { EventExplanation, ExplanationComment, PendingExplanation, ExplanationEvent } from './types';

const BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = new Promise(async (resolve, reject) => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      resolve(data.access_token);
    } catch (err) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      reject(err);
    } finally {
      refreshPromise = null;
    }
  });

  return refreshPromise;
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
      // Try to refresh token on 401
      if (res.status === 401) {
        try {
          const newToken = await refreshAccessToken();
          // Retry the request with the new token
          const retryHeaders: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${newToken}` };
          const retryRes = await fetch(url, { ...init, headers: { ...retryHeaders, ...(init.headers as Record<string, string>) } });
          if (retryRes.status === 204) return undefined as T;
          const retryData = await retryRes.json().catch(() => ({}));
          if (!retryRes.ok) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            const errorMsg = (retryData as { error?: string }).error ?? `HTTP ${retryRes.status}`;
            throw new ApiError(retryRes.status, `${errorMsg}${path ? ` on ${path}` : ''}`, path);
          }
          return retryData as T;
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      }
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
  postExplanation: (content: string, event_type_id: number, indicator_id?: number, log_year?: number, log_month?: number) =>
    request<void>('/explanations', {
      method: 'POST',
      body: JSON.stringify({ content, event_type_id, indicator_id, log_year, log_month }),
    }),
  explanations: {
    get: (params?: {
      user_id?: number;
      event_code?: string;
      year?: number;
      month?: number;
      limit?: number;
      offset?: number;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.user_id) searchParams.append('user_id', String(params.user_id));
      if (params?.event_code) searchParams.append('event_code', params.event_code);
      if (params?.year) searchParams.append('year', String(params.year));
      if (params?.month) searchParams.append('month', String(params.month));
      if (params?.limit) searchParams.append('limit', String(params.limit));
      if (params?.offset) searchParams.append('offset', String(params.offset));
      return request<{ explanations: EventExplanation[] }>(`/explanations?${searchParams}`);
    },
    getComments: (explanationId: number) => request<{ comments: ExplanationComment[] }>(`/explanations/${explanationId}/comments`),
    addComment: (explanationId: number, content: string, parentCommentId?: number) =>
      request<void>(`/explanations/${explanationId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content, parent_comment_id: parentCommentId }),
      }),
    hasPending: (params?: { year?: number; month?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.year) searchParams.append('year', String(params.year));
      if (params?.month) searchParams.append('month', String(params.month));
      return request<PendingExplanation>(`/explanations/pending?${searchParams}`);
    },
    getTypes: () => request<{ event_types: ExplanationEvent[] }>('/explanations/types'),
  },
};
