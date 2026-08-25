const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const apiRoot = configuredApiUrl
  ? (configuredApiUrl.endsWith('/api') ? configuredApiUrl : `${configuredApiUrl}/api`)
  : '/api';

let token = localStorage.getItem('prism_token');

function stringifyError(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value?.message === 'string') return value.message;
  if (typeof value?.error === 'string') return value.error;
  try { return JSON.stringify(value); } catch { return String(value); }
}

export function setAuthToken(value) {
  token = value || null;
  if (token) localStorage.setItem('prism_token', token);
  else localStorage.removeItem('prism_token');
}

export function getAuthToken() {
  return token;
}

function buildUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${apiRoot}${normalizedPath}`;
}

async function request(method, path, body, { signal, timeout = 30_000 } = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await fetch(buildUrl(path), {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: configuredApiUrl ? 'omit' : 'same-origin',
      signal: controller.signal,
    });

    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: raw }; }

    if (!response.ok) {
      const message = stringifyError(data?.error) || stringifyError(data?.message) || `Erro ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.payload = data;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('A solicitação demorou demais. Tente novamente.');
      timeoutError.status = 408;
      throw timeoutError;
    }
    if (error instanceof TypeError) {
      const networkError = new Error('Não foi possível conectar ao servidor. Verifique se o backend da Prism IA está online.');
      networkError.status = 0;
      throw networkError;
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export const api = {
  get: (path, options) => request('GET', path, undefined, options),
  post: (path, body, options) => request('POST', path, body, options),
  delete: (path, options) => request('DELETE', path, undefined, options),
};
