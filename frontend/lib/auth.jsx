import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken } from './api.js';

const AuthContext = createContext(null);
const USER_CACHE_KEY = 'prism_user';

function readCachedUser() {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user) {
  try {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_CACHE_KEY);
  } catch {}
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readCachedUser());
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    try { window.google?.accounts?.id?.disableAutoSelect?.(); } catch {}
    setAuthToken(null);
    setUser(null);
    writeCachedUser(null);
  }, []);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem('prism_token');
    if (!token) {
      setLoading(false);
      return () => { active = false; };
    }

    setAuthToken(token);
    api.get('/user/me')
      .then((res) => {
        if (!active) return;
        const nextUser = res.user || null;
        setUser(nextUser);
        writeCachedUser(nextUser);
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401 || error.status === 403 || error.status === 404) {
          logout();
          return;
        }
        // Mantém a sessão local durante falhas transitórias de backend/DB.
        // As próximas chamadas da API continuam responsáveis por reportar o erro real.
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [logout]);

  const login = useCallback((newToken, userData) => {
    setAuthToken(newToken);
    setUser(userData || null);
    writeCachedUser(userData || null);
  }, []);

  const updateUser = useCallback((userData) => {
    if (userData) {
      setUser((current) => {
        const next = { ...current, ...userData };
        writeCachedUser(next);
        return next;
      });
    }
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout, updateUser }), [user, loading, login, logout, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return value;
}
