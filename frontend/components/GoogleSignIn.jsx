import { getApiUrl } from '../lib/api.js';

export default function GoogleSignIn({ disabled = false }) {
  const href = getApiUrl('/auth/google/start?returnTo=%2Flogin');

  return (
    <a
      className={`auth-social-button${disabled ? ' is-disabled' : ''}`}
      href={disabled ? undefined : href}
      aria-disabled={disabled}
      onClick={(event) => {
        if (disabled) event.preventDefault();
      }}
    >
      <span aria-hidden="true" className="auth-social-button__mark">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="#4285F4" d="M21.35 12.23c0-.68-.06-1.33-.18-1.96H12v3.71h5.22a4.46 4.46 0 0 1-1.94 2.93v2.43h3.14c1.84-1.7 2.93-4.21 2.93-7.11Z"/>
          <path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.43c-.87.58-1.98.92-3.31.92-2.55 0-4.71-1.72-5.49-4.03H3.27v2.51A9.75 9.75 0 0 0 12 21.75Z"/>
          <path fill="#FBBC05" d="M6.51 13.85A5.86 5.86 0 0 1 6.2 12c0-.64.11-1.27.31-1.85V7.64H3.27A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.06 1.02 4.36l3.24-2.51Z"/>
          <path fill="#EA4335" d="M12 6.12c1.43 0 2.7.49 3.71 1.46l2.78-2.78C16.83 3.14 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.73 5.39l3.24 2.51c.78-2.31 2.94-4.03 5.49-4.03Z"/>
        </svg>
      </span>
      <span>Continuar com Google</span>
    </a>
  );
}
