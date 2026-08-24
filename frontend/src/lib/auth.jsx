import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setAuthToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('prism_token');
    if (!token) return setLoading(false);
    setAuthToken(token);
    api.get('/user/me')
      .then((res) => setUser(res.user))
      .catch(() => { localStorage.removeItem('prism_token'); setAuthToken(null); })
      .finally(() => setLoading(false));
  }, []);

  function login(token, userData) {
    localStorage.setItem('prism_token', token);
    setAuthToken(token);
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('prism_token');
    setAuthToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
