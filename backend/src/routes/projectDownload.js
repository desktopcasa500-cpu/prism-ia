import { Router } from 'express';
import { promises as fs } from 'node:fs';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validUuid(value) { return UUID_RE.test(String(value || '')); }
function safeArchivePath(value) {
  const normalized = String(value || '').replace(/\\/g, '/').trim();
  const parts = normalized.split('/');
  if (!normalized || parts.some((part) => part === '..' || part === '.' || part === '') || normalized.startsWith('/')) return null;
  const path = parts.join('/');
  if (path.length > 500) return null;
  return path;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) { const b = Buffer.alloc(2); b.writeUInt16LE(value); return b; }
function u32(value) { const b = Buffer.alloc(4); b.writeUInt32LE(value >>> 0); return b; }

function zip(files) {
  const local = [];
  const central = [];
  let offset = 0;
  let totalBytes = 0;
  for (const file of files) {
    const safePath = safeArchivePath(file.path);
    if (!safePath) throw Object.assign(new Error(`Caminho de arquivo inválido: ${String(file.path || '')}`), { code: 'INVALID_PROJECT_PATH', status: 422 });
    const name = Buffer.from(safePath, 'utf8');
    const data = Buffer.from(String(file.content ?? ''), 'utf8');
    totalBytes += data.length;
    if (totalBytes > MAX_ARCHIVE_BYTES) return null;
    const crc = crc32(data);
    const header = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name]);
    local.push(header, data);
    const directory = Buffer.concat([Buffer.from([0x50, 0x4b, 0x01, 0x02]), Buffer.from([20, 0, 20, 0]), u16(0), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]);
    central.push(directory);
    offset += header.length + data.length;
  }
  const centralSize = central.reduce((sum, item) => sum + item.length, 0);
  const end = Buffer.concat([Buffer.from([0x50, 0x4b, 0x05, 0x06]), u16(0), u16(0), u16(files.length), u16(files.length), u32(centralSize), u32(offset), u16(0)]);
  return Buffer.concat([...local, ...central, end]);
}

router.get('/:id/download', async (req, res, next) => {
  try {
    if (!validUuid(req.params.id)) return res.status(400).json({ error: 'Identificador de projeto inválido.', code: 'INVALID_PROJECT_ID' });
    const project = await pool.query('SELECT id,name FROM projects WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
    if (!project.rows.length) return res.status(404).json({ error: 'Projeto não encontrado' });
    const files = await pool.query('SELECT path,content FROM project_files WHERE project_id=$1 AND user_id=$2 ORDER BY path', [req.params.id, req.userId]);
    if (!files.rows.length) return res.status(404).json({ error: 'O projeto ainda não possui arquivos.' });
    const archive = zip(files.rows);
    if (!archive) return res.status(413).json({ error: 'O projeto excede o limite de 20 MB para download.', code: 'PROJECT_ARCHIVE_TOO_LARGE' });
    const safeName = String(project.rows[0].name || 'prism-project').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'prism-project';
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName.slice(0, 120)}.zip"`);
    res.setHeader('Content-Length', archive.length);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.end(archive);
  } catch (error) { return next(error); }
});

export default router;
