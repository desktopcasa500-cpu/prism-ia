import crypto from 'node:crypto';
import { pool } from '../db/pool.js';

const key = () => crypto.createHash('sha256').update(process.env.JWT_SECRET || 'change-me').digest();

export function encryptToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptToken(value) {
  const [ivRaw, tagRaw, encryptedRaw] = String(value || '').split('.');
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('Credencial GitHub inválida');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, 'base64url')), decipher.final()]).toString('utf8');
}

export async function githubRequest(token, path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `GitHub HTTP ${response.status}`);
  return data;
}

export async function getUserToken(userId) {
  const result = await pool.query('SELECT access_token_encrypted FROM github_connections WHERE user_id=$1', [userId]);
  if (!result.rows.length) throw new Error('GitHub não conectado');
  return decryptToken(result.rows[0].access_token_encrypted);
}

export function githubMcpTools() {
  return ['listRepositories','readFile','createFile','updateFile','createCommit','createBranch'];
}

export function isGithubConfigured() {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}
