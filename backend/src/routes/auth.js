import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { pool } from '../db/pool.js';

const router = Router();
const googleClient = new OAuth2Client();

function issueToken(user) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET não configurado');
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, plan: user.plan, created_at: user.created_at };
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    const normalizedEmail = email?.trim().toLowerCase();
    if (!name?.trim() || !normalizedEmail || !password || password.length < 6) return res.status(400).json({ error: 'Nome, email e senha (mín. 6 caracteres) são obrigatórios' });
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length) return res.status(409).json({ error: 'Email já cadastrado' });
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query('INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, plan, created_at', [normalizedEmail, hash, name.trim()]);
    const user = result.rows[0];
    res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const normalizedEmail = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password;
    if (!normalizedEmail || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    const user = result.rows[0];
    if (!user?.password_hash) return res.status(401).json({ error: 'Esta conta usa login com Google. Entre pelo botão do Google.' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });
    res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post('/google', async (req, res, next) => {
  try {
    const credential = req.body?.credential;
    const audience = process.env.GOOGLE_CLIENT_ID;
    if (!credential || !audience) return res.status(400).json({ error: 'Login Google não está configurado corretamente' });

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) return res.status(401).json({ error: 'Credencial Google inválida' });

    const email = payload.email.toLowerCase();
    const existing = await pool.query('SELECT id, email, name, plan, created_at, google_id FROM users WHERE email = $1', [email]);
    let user = existing.rows[0];

    if (user) {
      if (user.google_id !== payload.sub || !user.avatar_url) {
        await pool.query('UPDATE users SET google_id = $1, avatar_url = COALESCE($2, avatar_url) WHERE id = $3', [payload.sub, payload.picture || null, user.id]);
      }
      const fresh = await pool.query('SELECT id, email, name, plan, created_at FROM users WHERE id = $1', [user.id]);
      user = fresh.rows[0];
    } else {
      const result = await pool.query('INSERT INTO users (email, password_hash, name, google_id, avatar_url) VALUES ($1, NULL, $2, $3, $4) RETURNING id, email, name, plan, created_at', [email, payload.name || email.split('@')[0], payload.sub, payload.picture || null]);
      user = result.rows[0];
    }

    res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({ error: 'Não foi possível validar sua conta Google.' });
  }
});

export default router;
