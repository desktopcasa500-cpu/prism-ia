import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function GitHubSignIn({ disabled = false }) {
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [missing, setMissing] = useState([]);

  useEffect(() => {
    let active = true;
    api.get('/auth/providers').then((config) => {
      if (active) {
        setConfigured(Boolean(config?.github));
        setMissing(Array.isArray(config?.githubMissing) ? config.githubMissing : []);
      }
    }).catch(() => {
      if (active) setConfigured(false);
    });
    return () => { active = false; };
  }, []);

  const start = useCallback(() => {
    if (disabled || busy || !configured) return;
    setBusy(true);
    window.location.assign('/api/auth/github/start?returnTo=%2Flogin');
  }, [busy, configured, disabled]);

  return (
    <button
      type="button"
      className="auth-social-button"
      onClick={start}
      disabled={disabled || busy || !configured}
      aria-label="Continuar com GitHub"
    >
      <span aria-hidden="true" className="auth-social-button__mark">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12 2.2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.45-1.15-1.1-1.46-1.1-1.46-.9-.61.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.57 9.57 0 0 1 12 7.55c.85 0 1.7.12 2.5.35 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.73c0 .27.18.58.69.48A10 10 0 0 0 12 2.2Z" />
        </svg>
      </span>
      <span>{busy ? 'Conectando...' : configured ? 'Continuar com GitHub' : missing.length ? \`GitHub: falta ${missing.join(', ')}\` : 'GitHub indisponível'}</span>
    </button>
  );
}
