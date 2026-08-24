import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function GoogleSignIn({ onSuccess }) {
  const hostRef = useRef(null);
  const { login } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!CLIENT_ID) return;

    let cancelled = false;
    const render = () => {
      if (cancelled || !window.google || !hostRef.current) return;
      hostRef.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async (response) => {
          setError('');
          try {
            const result = await api.post('/auth/google', { credential: response.credential });
            login(result.token, result.user);
            onSuccess?.();
          } catch (err) {
            setError(err.message || 'Não foi possível entrar com o Google.');
          }
        },
        context: 'signin',
        ux_mode: 'popup',
        auto_select: false,
      });
      window.google.accounts.id.renderButton(hostRef.current, {
        theme: 'filled_black',
        size: 'large',
        width: 360,
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
    document.head.appendChild(script);
    return () => { cancelled = true; };
  }, [login, onSuccess]);

  if (!CLIENT_ID) {
    return <div className="notice">Login com Google está pronto no código. Configure <code>VITE_GOOGLE_CLIENT_ID</code> na Vercel para habilitar o botão.</div>;
  }

  return <div><div ref={hostRef} className="google-wrap" />{error && <div className="notice" style={{marginTop:10}}>{error}</div>}</div>;
}
