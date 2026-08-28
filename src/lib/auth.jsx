import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    try { window.google?.accounts?.id?.disableAutoSelect?.(); } catch {}
    setAuthToken(null);
    setUser(null);
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
      .then((res) => { if (active) setUser(res.user || null); })
      .catch((error) => {
        if (error.status === 401 || error.status === 403 || error.status === 404) logout();
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [logout]);

  const login = useCallback((newToken, userData) => {
    setAuthToken(newToken);
    setUser(userData || null);
  }, []);

  const updateUser = useCallback((userData) => {
    if (userData) setUser((current) => ({ ...current, ...userData }));
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout, updateUser }), [user, loading, login, logout, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return value;
}
