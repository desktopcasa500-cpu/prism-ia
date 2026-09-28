const configuredApiUrl = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

const apiRoot = configuredApiUrl
  ? (configuredApiUrl.endsWith('/api') ? configuredApiUrl : `${configuredApiUrl}/api`)
  : '/api';

let token = null;
try { token = localStorage.getItem('prism_token'); } catch {}
const generationControllers = new Set();

function stringifyError(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value.message === 'string') return value.message;
  if (typeof value.error === 'string') return value.error;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function buildUrl(path) {
  const normalized = String(path || '').startsWith('/') ? String(path) : `/${path}`;
  return `${apiRoot}${normalized}`;
}

function activeSurface() {
  try {
    return sessionStorage.getItem('prism.active_surface') === 'codex' ? 'codex' : 'home';
  } catch {
    return 'home';
  }
}

function normalizePathAndBody(path, body) {
  let nextPath = String(path || '');
  const surface = activeSurface();

  if (nextPath.includes('/chat/sessions')) {
    nextPath = nextPath.replace(/([?&])surface=(home|codex)\b/, `$1surface=${surface}`);
  }

  if (
    body &&
    typeof body === 'object' &&
    nextPath.includes('/chat/sessions') &&
    (nextPath.endsWith('/messages')
      || nextPath.endsWith('/messages/stream')
      || nextPath.endsWith('/sessions')
      || nextPath.includes('/sessions/'))
  ) {
    const explicit = typeof body.surface === 'string' && /^(home|codex)$/.test(body.surface);
    if (!explicit) return { path: nextPath, body: { ...body, surface } };
  }

  return { path: nextPath, body };
}

function isGenerationPath(path) {
  return /\/chat\/sessions\/[^/]+\/messages(?:\/stream)?$/.test(path)
    || path.includes('/chat/parallel')
    || path.includes('/ai/generate');
}

function makeApiError(message, response, payload = {}) {
  const error = new Error(message || `Erro ${response?.status || 500}`);
  error.status = response?.status || 0;
  error.payload = payload;
  error.code = payload?.code || response?.headers?.get?.('X-Prism-Error-Code') || null;
  error.requestId = response?.headers?.get?.('X-Request-Id') || payload?.requestId || null;
  return error;
}

export function setAuthToken(value) {
  token = value || null;
  try {
    if (token) localStorage.setItem('prism_token', token);
    else localStorage.removeItem('prism_token');
  } catch {}
}

export function getAuthToken() {
  return token;
}

export function hasActiveGeneration() {
  return generationControllers.size > 0;
}

export function stopActiveGenerations() {
  for (const controller of [...generationControllers]) controller.abort();
}

function registerGeneration(controller) {
  generationControllers.add(controller);
  return () => generationControllers.delete(controller);
}

function isCallerAbort(error, signal) {
  return signal?.aborted || error?.name === 'AbortError';
}

function createAbortError(message, code = 'USER_ABORT') {
  return Object.assign(new DOMException(message, 'AbortError'), { code });
}

async function parseResponseBody(response) {
  const raw = await response.text();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return { error: raw }; }
}

async function request(method, path, body, { signal, timeout = 30_000 } = {}) {
  const normalized = normalizePathAndBody(path, body);
  const controller = new AbortController();
  const release = isGenerationPath(normalized.path) ? registerGeneration(controller) : () => {};
  let timedOut = false;

  if (signal?.aborted) controller.abort();

  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);

  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await fetch(buildUrl(normalized.path), {
      method,
      headers: {
        Accept: 'application/json',
        ...(normalized.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: normalized.body !== undefined ? JSON.stringify(normalized.body) : undefined,
      credentials: configuredApiUrl ? 'include' : 'same-origin',
      signal: controller.signal,
    });

    const payload = await parseResponseBody(response);
    if (!response.ok) {
      let message = stringifyError(payload?.error) || stringifyError(payload?.message) || `Erro ${response.status}`;
      if (response.status >= 500 && payload?.code && payload.code !== 'SERVER_ERROR') {
        message += ` (${payload.code})`;
      }
      if (response.status >= 500 && payload?.requestId) {
        message += ` — ID ${payload.requestId}`;
      }
      throw makeApiError(message, response, payload);
    }

    return payload;
  } catch (error) {
    if (isCallerAbort(error, signal)) {
      if (signal?.aborted && !timedOut) throw createAbortError('A solicitação foi cancelada.');
      const timeoutError = new Error('A solicitação demorou demais. Tente novamente.');
      timeoutError.status = 408;
      timeoutError.code = 'REQUEST_TIMEOUT';
      throw timeoutError;
    }

    if (error instanceof TypeError) {
      const networkError = new Error('Não foi possível conectar ao servidor. Verifique se o backend da Prism IA está online.');
      networkError.status = 0;
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    }

    throw error;
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
    release();
  }
}

function parseSseChunk(chunk, onEvent, state) {
  const blocks = chunk.split(/\r?\n\r?\n/);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (!line.startsWith('data:')) continue;

      let event;
      try {
        event = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }

      onEvent?.(event);
      if (event?.type === 'result') state.finalData = event.data;
      if (event?.type === 'error') {
        const error = new Error(event.message || 'A execução falhou.');
        error.status = event.status || 500;
        error.code = event.code || 'STREAM_EXECUTION_FAILED';
        error.payload = event;
        throw error;
      }
    }
  }
}

async function streamRequest(path, body, onEvent, { signal, timeout = 300_000 } = {}) {
  const normalized = normalizePathAndBody(path, body);
  const controller = new AbortController();
  const release = registerGeneration(controller);
  let timedOut = false;

  if (signal?.aborted) controller.abort();

  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);

  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await fetch(buildUrl(normalized.path), {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(normalized.body),
      credentials: configuredApiUrl ? 'include' : 'same-origin',
      signal: controller.signal,
    });

    if (!response.ok) {
      const payload = await parseResponseBody(response);
      const message = stringifyError(payload?.error) || stringifyError(payload?.message) || `Erro ${response.status}`;
      throw makeApiError(message, response, payload);
    }

    if (!response.body) {
      const error = new Error('O servidor não disponibilizou o fluxo de progresso.');
      error.code = 'STREAM_UNAVAILABLE';
      throw error;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const state = { finalData: null };
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || '';
      if (blocks.length) parseSseChunk(blocks.join('\n\n') + '\n\n', onEvent, state);

      if (done) break;
    }

    if (buffer.trim()) parseSseChunk(buffer + '\n\n', onEvent, state);
    return state.finalData || {};
  } catch (error) {
    if (isCallerAbort(error, signal)) {
      if (signal?.aborted && !timedOut) throw createAbortError('A execução foi cancelada.');
      const timeoutError = new Error('A execução demorou demais. Tente novamente.');
      timeoutError.status = 408;
      timeoutError.code = 'STREAM_TIMEOUT';
      throw timeoutError;
    }

    if (error instanceof TypeError) {
      const networkError = new Error('Não foi possível conectar ao servidor. Verifique se o backend da Prism IA está online.');
      networkError.status = 0;
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    }

    throw error;
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
    release();
  }
}

export function getApiUrl(path = '') {
  const normalized = String(path || '').startsWith('/') ? String(path) : `/${path}`;
  return `${apiRoot}${normalized}`;
}

export const api = {
  get: (path, options) => request('GET', path, undefined, options),
  post: (path, body, options) => request('POST', path, body, options),
  patch: (path, body, options) => request('PATCH', path, body, options),
  put: (path, body, options) => request('PUT', path, body, options),
  delete: (path, options) => request('DELETE', path, undefined, options),
  streamPost: (path, body, onEvent, options) => streamRequest(path, body, onEvent, options),
};
