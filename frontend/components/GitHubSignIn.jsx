import { getApiUrl } from '../lib/api.js';

export default function GitHubSignIn({ disabled = false }) {
  const href = getApiUrl('/auth/github/start?returnTo=%2Flogin');

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
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12 2.2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.45-1.15-1.1-1.46-1.1-1.46-.9-.61.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.73c0 .27.18.58.69.48A10 10 0 0 0 12 2.2Z"/>
        </svg>
      </span>
      <span>Continuar com GitHub</span>
    </a>
  );
}
