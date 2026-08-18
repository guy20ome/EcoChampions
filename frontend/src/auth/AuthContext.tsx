import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from '../api/client';
import type { AuthResponse, User } from '../api/types';

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const storeTokens = (res: AuthResponse) => {
    localStorage.setItem('access_token', res.access_token);
    localStorage.setItem('refresh_token', res.refresh_token);
  };

  const fetchMe = useCallback(async () => {
    if (!localStorage.getItem('access_token')) {
      setReady(true);
      return;
    }
    try {
      const data = await api.get<{ user: User }>('/auth/me');
      setUser(data.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<AuthResponse>('/auth/login', { email, password });
    storeTokens(res);
    await fetchMe();
  }, [fetchMe]);

  const register = useCallback(async (email: string, username: string, password: string) => {
    const res = await api.post<AuthResponse>('/auth/register', { email, username, password });
    storeTokens(res);
    await fetchMe();
  }, [fetchMe]);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ user, ready, login, register, logout }), [user, ready, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
