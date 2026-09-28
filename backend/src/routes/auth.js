import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { URLSearchParams } from 'node:url';
import { pool } from '../db/pool.js';

const router = Router();
const googleClient = new OAuth2Client();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 80;
const MAX_PASSWORD_LENGTH = 128;

function configuredEnv(...names) {
  return names.map((name) => String(process.env[name] || '').trim()).find(Boolean) || '';
}

function providerConfig(req) {
  const googleClientId = configuredEnv('GOOGLE_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_ID', 'VITE_GOOGLE_CLIENT_ID');
  const googleClientSecret = configuredEnv('GOOGLE_CLIENT_SECRET', 'GOOGLE_OAUTH_CLIENT_SECRET');
  const githubClientId = configuredEnv('GITHUB_CLIENT_ID', 'GITHUB_OAUTH_CLIENT_ID', 'VITE_GITHUB_CLIENT_ID');
  const githubClientSecret = configuredEnv('GITHUB_CLIENT_SECRET', 'GITHUB_OAUTH_CLIENT_SECRET');
  return {
    google: Boolean(googleClientId && googleClientSecret),
    googleClientId: googleClientId || null,
    googleClientSecret: Boolean(googleClientSecret),
    github: Boolean(githubClientId && githubClientSecret),
    githubClientId: githubClientId || null,
    githubClientSecret: Boolean(githubClientSecret),
    callback: githubRedirectUri(req),
  };
}


function appBaseUrl(req) {
  const configured = String(process.env.BACKEND_URL || process.env.GITHUB_APP_URL || process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `${req.protocol}://${req.get('host')}`;
}

function githubRedirectUri(req) {
  return String(process.env.GITHUB_REDIRECT_URI || `${appBaseUrl(req)}/api/auth/github/callback`).trim();
}

function googleRedirectUri(req) {
  return String(process.env.GOOGLE_REDIRECT_URI || `${appBaseUrl(req)}/api/auth/google/callback`).trim();
}

function setProviderSessionCookie(res, name, token) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  res.setHeader('Set-Cookie', [
    `${name}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/api/auth',
    'Max-Age=300',
    ...(secure ? ['Secure'] : []),
  ].join('; '));
}

function clearProviderSessionCookie(res, name) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  res.setHeader('Set-Cookie', [
    `${name}=`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/api/auth',
    'Max-Age=0',
    ...(secure ? ['Secure'] : []),
  ].join('; '));
}

function safeReturnPath(value) {
  const path = String(value || '/login');
  return path.startsWith('/') && !path.startsWith('//') ? path : '/login';
}

function cookieValue(header, name) {
  const source = String(header || '');
  const match = source.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

function setGithubSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const parts = [
    `prism_github_auth=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/api/auth/github',
    'Max-Age=300',
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearGithubSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const parts = [
    'prism_github_auth=',
    'HttpOnly',
    'SameSite=Lax',
    'Path=/api/auth/github',
    'Max-Age=0',
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

async function githubApi(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Prism-IA',
      ...(options.headers || {}),
    },
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  if (!response.ok) {
    const error = new Error(String(data?.message || raw || `GitHub HTTP ${response.status}`));
    error.status = response.status;
    throw error;
  }
  return data;
}

async function exchangeGithubCode(code, redirectUri) {
  const clientId = configuredEnv('GITHUB_CLIENT_ID', 'GITHUB_OAUTH_CLIENT_ID', 'VITE_GITHUB_CLIENT_ID');
  const clientSecret = configuredEnv('GITHUB_CLIENT_SECRET', 'GITHUB_OAUTH_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw Object.assign(new Error('Login com GitHub não está configurado neste ambiente.'), { status: 503, code: 'GITHUB_NOT_CONFIGURED' });

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: String(code || ''),
    redirect_uri: redirectUri,
  });

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Prism-IA',
    },
    body,
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  if (!response.ok || !data.access_token) {
    throw Object.assign(new Error(String(data?.error_description || data?.error || raw || 'Não foi possível autenticar com o GitHub.')), { status: 401, code: 'GITHUB_TOKEN_EXCHANGE_FAILED' });
  }
  return data;
}

function issueToken(user) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET não configurado');
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, plan: user.plan, created_at: user.created_at };
}

function normalizeCredentials(body = {}) {
  const name = String(body.name || '').trim().replace(/\s+/g, ' ');
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  return { name, email, password };
}

router.get('/providers', (req, res) => {
  const config = providerConfig(req);
  const missing = {
    google: config.google ? [] : [
      ...(config.googleClientId ? [] : ['GOOGLE_CLIENT_ID']),
      ...(config.googleClientSecret ? [] : ['GOOGLE_CLIENT_SECRET']),
    ],
    github: config.github ? [] : [
      ...(config.githubClientId ? [] : ['GITHUB_CLIENT_ID']),
      ...(config.githubClientSecret ? [] : ['GITHUB_CLIENT_SECRET']),
    ],
  };
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    google: config.google,
    googleClientId: config.googleClientId,
    googleMissing: missing.google,
    github: Boolean(config.githubClientId),
    githubMissing: missing.github,
    githubCallback: config.github ? config.callback : null,
  });
});

router.get('/google/start', (req, res) => {
  const clientId = configuredEnv('GOOGLE_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_ID', 'VITE_GOOGLE_CLIENT_ID');
  const clientSecret = configuredEnv('GOOGLE_CLIENT_SECRET', 'GOOGLE_OAUTH_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    return res.status(503).json({
      error: 'Login com Google não está configurado neste ambiente. Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.',
      code: 'GOOGLE_NOT_CONFIGURED',
    });
  }
  if (!process.env.JWT_SECRET) return res.status(503).json({ error: 'JWT_SECRET não configurado.', code: 'JWT_NOT_CONFIGURED' });

  const state = jwt.sign(
    { purpose: 'google_oauth', returnTo: safeReturnPath(req.query?.returnTo) },
    process.env.JWT_SECRET,
    { expiresIn: '10m' },
  );

  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(req),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'select_account',
    scope: 'openid email profile',
    state,
  });

  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`);
});

router.get('/google/callback', async (req, res) => {
  const returnTo = '/login';
  try {
    if (!process.env.JWT_SECRET) throw Object.assign(new Error('JWT_SECRET não configurado.'), { status: 503, code: 'JWT_NOT_CONFIGURED' });
    const state = String(req.query?.state || '');
    const code = String(req.query?.code || '');
    if (!state || !code) return res.redirect(`${returnTo}?google=error&reason=missing_code`);

    const statePayload = jwt.verify(state, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (statePayload?.purpose !== 'google_oauth') return res.redirect(`${returnTo}?google=error&reason=invalid_state`);
    const requestedReturnTo = safeReturnPath(statePayload?.returnTo);

    const clientId = configuredEnv('GOOGLE_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_ID', 'VITE_GOOGLE_CLIENT_ID');
    const clientSecret = configuredEnv('GOOGLE_CLIENT_SECRET', 'GOOGLE_OAUTH_CLIENT_SECRET');
    if (!clientId || !clientSecret) return res.redirect(`${returnTo}?google=error&reason=not_configured`);

    const tokenClient = new OAuth2Client(clientId, clientSecret, googleRedirectUri(req));
    const { tokens } = await tokenClient.getToken({ code, redirect_uri: googleRedirectUri(req) });
    if (!tokens?.id_token) return res.redirect(`${returnTo}?google=error&reason=missing_identity`);

    const ticket = await tokenClient.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload?.email || payload.email_verified !== true) {
      return res.redirect(`${returnTo}?google=error&reason=invalid_identity`);
    }

    const email = payload.email.trim().toLowerCase();
    const existing = await pool.query(
      'SELECT id, email, name, plan, created_at, google_id, avatar_url FROM users WHERE email = $1',
      [email],
    );
    let user = existing.rows[0];

    if (user) {
      await pool.query(
        'UPDATE users SET google_id = $1, avatar_url = COALESCE($2, avatar_url) WHERE id = $3',
        [payload.sub, payload.picture || null, user.id],
      );
    } else {
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, name, google_id, avatar_url) VALUES ($1, NULL, $2, $3, $4) RETURNING id, email, name, plan, created_at',
        [
          email,
          String(payload.name || email.split('@')[0]).trim().slice(0, MAX_NAME_LENGTH),
          payload.sub,
          payload.picture || null,
        ],
      );
      user = result.rows[0];
    }

    const fresh = await pool.query(
      'SELECT id, email, name, plan, created_at FROM users WHERE id = $1',
      [user.id],
    );
    setProviderSessionCookie(res, 'prism_google_auth', issueToken(fresh.rows[0]));
    return res.redirect(`${requestedReturnTo}?google=success`);
  } catch (error) {
    console.error('Google OAuth error:', { code: error?.code, message: error?.message });
    return res.redirect(`${returnTo}?google=error&reason=oauth_failed`);
  }
});

router.post('/google/session', async (req, res) => {
  const token = cookieValue(req.headers.cookie, 'prism_google_auth');
  if (!token || !process.env.JWT_SECRET) return res.status(401).json({ error: 'Sessão Google não encontrada.', code: 'GOOGLE_SESSION_MISSING' });
  try {
    const sessionPayload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const result = await pool.query(
      'SELECT id, email, name, plan, created_at FROM users WHERE id = $1',
      [sessionPayload?.sub],
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Usuário do Google não encontrado.', code: 'GOOGLE_USER_NOT_FOUND' });
    clearProviderSessionCookie(res, 'prism_google_auth');
    return res.json({ token, user: publicUser(user) });
  } catch {
    clearProviderSessionCookie(res, 'prism_google_auth');
    return res.status(401).json({ error: 'Sessão Google inválida ou expirada.', code: 'GOOGLE_SESSION_INVALID' });
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = normalizeCredentials(req.body);
    if (name.length < 2 || name.length > MAX_NAME_LENGTH) return res.status(400).json({ error: 'Digite um nome válido.' });
    if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'Digite um email válido.' });
    if (password.length < 6 || password.length > MAX_PASSWORD_LENGTH) return res.status(400).json({ error: 'A senha precisa ter entre 6 e 128 caracteres.' });

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(409).json({ error: 'Este email já está cadastrado.' });

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, plan, created_at',
      [email, hash, name],
    );
    const user = result.rows[0];
    res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = normalizeCredentials(req.body);
    if (!EMAIL_RE.test(email) || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    if (password.length > MAX_PASSWORD_LENGTH) return res.status(400).json({ error: 'Senha inválida.' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user?.password_hash) return res.status(401).json({ error: 'Esta conta usa login com Google. Entre pelo botão do Google.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Email ou senha incorretos.' });
    res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post('/google', async (req, res, next) => {
  try {
    const credential = req.body?.credential;
    const audience = configuredEnv('GOOGLE_CLIENT_ID');
    if (!credential || !audience) return res.status(503).json({ error: 'Login Google ainda não está configurado neste ambiente. Configure GOOGLE_CLIENT_ID.', code: 'GOOGLE_NOT_CONFIGURED' });

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) return res.status(401).json({ error: 'Credencial Google inválida.' });

    const email = payload.email.trim().toLowerCase();
    const existing = await pool.query('SELECT id, email, name, plan, created_at, google_id, avatar_url FROM users WHERE email = $1', [email]);
    let user = existing.rows[0];

    if (user) {
      if (user.google_id !== payload.sub || (!user.avatar_url && payload.picture)) {
        await pool.query(
          'UPDATE users SET google_id = $1, avatar_url = COALESCE($2, avatar_url) WHERE id = $3',
          [payload.sub, payload.picture || null, user.id],
        );
      }
      const fresh = await pool.query('SELECT id, email, name, plan, created_at FROM users WHERE id = $1', [user.id]);
      user = fresh.rows[0];
    } else {
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, name, google_id, avatar_url) VALUES ($1, NULL, $2, $3, $4) RETURNING id, email, name, plan, created_at',
        [email, String(payload.name || email.split('@')[0]).trim().slice(0, MAX_NAME_LENGTH), payload.sub, payload.picture || null],
      );
      user = result.rows[0];
    }

    res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    console.error('Google auth error:', error);
    next(error);
  }
});

router.get('/github/start', (req, res) => {
  const clientId = configuredEnv('GITHUB_CLIENT_ID', 'GITHUB_OAUTH_CLIENT_ID');
  if (!clientId) return res.status(503).json({ error: 'Login com GitHub não está configurado neste ambiente. Configure GITHUB_CLIENT_ID.', code: 'GITHUB_CLIENT_NOT_CONFIGURED' });
  if (!process.env.JWT_SECRET) return res.status(503).json({ error: 'JWT_SECRET não configurado.', code: 'JWT_NOT_CONFIGURED' });

  const redirectUri = githubRedirectUri(req);
  const state = jwt.sign(
    { purpose: 'github_oauth', returnTo: safeReturnPath(req.query?.returnTo) },
    process.env.JWT_SECRET || '',
    { expiresIn: '10m' },
  );

  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${query.toString()}`);
});

router.get('/github/callback', async (req, res) => {
  const returnTo = '/login';
  try {
    if (!process.env.JWT_SECRET) throw Object.assign(new Error('JWT_SECRET não configurado.'), { status: 503, code: 'JWT_NOT_CONFIGURED' });
    const state = String(req.query?.state || '');
    const code = String(req.query?.code || '');
    if (!state || !code) return res.redirect(`${returnTo}?github=error&reason=missing_code`);

    const statePayload = jwt.verify(state, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (statePayload?.purpose !== 'github_oauth') return res.redirect(`${returnTo}?github=error&reason=invalid_state`);
    const requestedReturnTo = safeReturnPath(statePayload?.returnTo);

    const redirectUri = githubRedirectUri(req);
    const tokenData = await exchangeGithubCode(code, redirectUri);
    const accessToken = tokenData.access_token;

    const profile = await githubApi('/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const emails = await githubApi('/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const verified = Array.isArray(emails)
      ? emails.find((item) => item?.verified && item?.primary) || emails.find((item) => item?.verified)
      : null;
    const email = String(verified?.email || '').trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) return res.redirect(`${returnTo}?github=error&reason=no_verified_email`);

    const githubId = String(profile?.id || '').trim();
    if (!githubId) return res.redirect(`${returnTo}?github=error&reason=invalid_identity`);

    const existingGithub = await pool.query(
      'SELECT id, email, name, plan, created_at, github_id, avatar_url FROM users WHERE github_id = $1',
      [githubId],
    );

    let user = existingGithub.rows[0];
    if (user) {
      await pool.query(
        'UPDATE users SET avatar_url = COALESCE($1, avatar_url), name = COALESCE(NULLIF(name, \'\'), $2) WHERE id = $3',
        [profile?.avatar_url || null, String(profile?.name || profile?.login || email.split('@')[0]).trim().slice(0, MAX_NAME_LENGTH), user.id],
      );
    } else {
      const existingEmail = await pool.query(
        'SELECT id, email, name, plan, created_at FROM users WHERE email = $1',
        [email],
      );

      if (existingEmail.rows[0]) {
        user = existingEmail.rows[0];
        await pool.query(
          'UPDATE users SET github_id = $1, avatar_url = COALESCE($2, avatar_url) WHERE id = $3',
          [githubId, profile?.avatar_url || null, user.id],
        );
      } else {
        const result = await pool.query(
          'INSERT INTO users (email, password_hash, name, github_id, avatar_url) VALUES ($1, NULL, $2, $3, $4) RETURNING id, email, name, plan, created_at',
          [
            email,
            String(profile?.name || profile?.login || email.split('@')[0]).trim().slice(0, MAX_NAME_LENGTH),
            githubId,
            profile?.avatar_url || null,
          ],
        );
        user = result.rows[0];
      }
    }

    const fresh = await pool.query(
      'SELECT id, email, name, plan, created_at FROM users WHERE id = $1',
      [user.id],
    );
    const appToken = issueToken(fresh.rows[0]);
    setGithubSessionCookie(res, appToken);
    return res.redirect(`${requestedReturnTo}?github=success`);
  } catch (error) {
    console.error('GitHub auth error:', { code: error?.code, message: error?.message });
    return res.redirect(`${returnTo}?github=error&reason=oauth_failed`);
  }
});

router.post('/github/session', async (req, res) => {
  const token = cookieValue(req.headers.cookie, 'prism_github_auth');
  if (!token || !process.env.JWT_SECRET) return res.status(401).json({ error: 'Sessão GitHub não encontrada.', code: 'GITHUB_SESSION_MISSING' });
  try {
    const sessionPayload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const result = await pool.query(
      'SELECT id, email, name, plan, created_at FROM users WHERE id = $1',
      [sessionPayload?.sub],
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Usuário do GitHub não encontrado.', code: 'GITHUB_USER_NOT_FOUND' });
    clearGithubSessionCookie(res);
    return res.json({ token, user: publicUser(user) });
  } catch {
    clearGithubSessionCookie(res);
    return res.status(401).json({ error: 'Sessão GitHub inválida ou expirada.', code: 'GITHUB_SESSION_INVALID' });
  }
});

export default router;
