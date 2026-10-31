import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, clearToken, getToken, setToken, ApiError } from '../api/client';
import type { AuthUser } from '../api/types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api.
    get<{ ok: boolean; user: AuthUser }>('/api/auth/me').
    then((res) => setUser(res.user)).
    catch(() => clearToken()).
    finally(() => setLoading(false));
  }, []);

  /**
   * The real backend has no `/api/auth/login` route — every request just
   * carries a `Basic <base64>` credential in the `X-Aiva-Auth` header (see
   * server/app.js's auth middleware). "Logging in" here means building that
   * header from the given username/password and confirming it's accepted by
   * probing `GET /api/auth/me`, which every authenticated route also checks.
   */
  const login = useCallback(async (username: string, password: string, remember = true) => {
    setError(null);
    const header = `Basic ${btoa(`${username}:${password}`)}`;
    setToken(header, remember);
    try {
      const res = await api.get<{ ok: boolean; user: AuthUser }>('/api/auth/me');
      setUser(res.user);
    } catch (err) {
      clearToken();
      setError(err instanceof ApiError ? err.message : 'Could not reach the AIVA backend.');
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>);

}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
