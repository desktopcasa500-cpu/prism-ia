let token = localStorage.getItem('prism_token');

function stringifyError(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (value.message && typeof value.message === 'string') return value.message;
  if (value.error && typeof value.error === 'string') return value.error;
  try { return JSON.stringify(value); } catch { return String(value); }
}

export function setAuthToken(value) {
  token = value || null;
  if (token) localStorage.setItem('prism_token', token);
  else localStorage.removeItem('prism_token');
}

async function request(method, path, body) {
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
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
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
};
