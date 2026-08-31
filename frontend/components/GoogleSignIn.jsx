import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function GoogleSignIn({ onSuccess }) {
  const hostRef = useRef(null);
  const successRef = useRef(onSuccess);
  const { login } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => { successRef.current = onSuccess; }, [onSuccess]);

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let cancelled = false;

    const render = () => {
      if (cancelled || !window.google || !hostRef.current) return;
      hostRef.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async (response) => {
          if (!response?.credential) {
            setError('O Google não retornou uma credencial válida.');
            return;
          }
          setError('');
          try {
            const result = await api.post('/auth/google', { credential: response.credential });
            if (!result.token || !result.user) throw new Error('A resposta do servidor está incompleta.');
            login(result.token, result.user);
            successRef.current?.();
          } catch (err) {
            setError(err.message || 'Não foi possível entrar com o Google.');
          }
        },
        context: 'signin',
        ux_mode: 'popup',
        auto_select: false,
      });
      window.google.accounts.id.renderButton(hostRef.current, {
        theme: 'outline',
        size: 'large',
        width: Math.min(360, hostRef.current.clientWidth || 360),
        shape: 'rectangular',
        text: 'continue_with',
        logo_alignment: 'left',
      });
    };

    const existing = document.querySelector('script[data-google-gsi]');
    if (existing) {
      if (window.google) render();
      else existing.addEventListener('load', render, { once: true });
      return () => { cancelled = true; };
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleGsi = 'true';
    script.onload = render;
    script.onerror = () => setError('Não foi possível carregar o login do Google.');
    document.head.appendChild(script);
    return () => { cancelled = true; };
  }, [login]);

  if (!CLIENT_ID) return null;
  return <div><div ref={hostRef} className="google-wrap" />{error && <div className="notice" style={{ marginTop: 10 }} role="alert">{error}</div>}</div>;
}
