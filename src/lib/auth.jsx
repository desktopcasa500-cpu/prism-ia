import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('prism_token');
    if (!token) {
      setLoading(false);
      return;
    }

    setAuthToken(token);
    api.get('/user/me')
      .then((res) => setUser(res.user))
      .catch((error) => {
        if (error.status === 401 || error.status === 403 || error.status === 404) {
          setAuthToken(null);
          setUser(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = (newToken, userData) => {
    setAuthToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    try { window.google?.accounts?.id?.disableAutoSelect?.(); } catch {}
    setAuthToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
