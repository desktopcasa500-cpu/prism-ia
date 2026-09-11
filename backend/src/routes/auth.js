import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { pool } from '../db/pool.js';

const router = Router();
const googleClient = new OAuth2Client();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 80;
const MAX_PASSWORD_LENGTH = 128;

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
    const audience = process.env.GOOGLE_CLIENT_ID;
    if (!credential || !audience) return res.status(503).json({ error: 'Login Google ainda não está configurado neste ambiente.' });

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

export default router;
