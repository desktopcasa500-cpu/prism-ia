import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) { const b = Buffer.alloc(2); b.writeUInt16LE(value, 0); return b; }
function u32(value) { const b = Buffer.alloc(4); b.writeUInt32LE(value >>> 0, 0); return b; }

function zip(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.path.replace(/^\/+/, '').replace(/\\/g, '/'), 'utf8');
    const data = Buffer.from(String(file.content ?? ''), 'utf8');
    const crc = crc32(data);
    const header = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name,
    ]);
    local.push(header, data);
    const directory = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]), Buffer.from([20, 0, 20, 0]), u16(0), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name,
    ]);
    central.push(directory);
    offset += header.length + data.length;
  }
  const centralSize = central.reduce((sum, item) => sum + item.length, 0);
  const end = Buffer.concat([Buffer.from([0x50, 0x4b, 0x05, 0x06]), u16(0), u16(0), u16(files.length), u16(files.length), u32(centralSize), u32(offset), u16(0)]);
  return Buffer.concat([...local, ...central, end]);
}

router.get('/:id/download', async (req, res, next) => {
  try {
    const project = await pool.query('SELECT id,name FROM projects WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
    if (!project.rows.length) return res.status(404).json({ error: 'Projeto não encontrado' });
    const files = await pool.query('SELECT path,content FROM project_files WHERE project_id=$1 AND user_id=$2 ORDER BY path', [req.params.id, req.userId]);
    if (!files.rows.length) return res.status(404).json({ error: 'O projeto ainda não possui arquivos.' });
    const archive = zip(files.rows);
    const safeName = String(project.rows[0].name || 'prism-project').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'prism-project';
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);
    res.setHeader('Content-Length', archive.length);
    res.end(archive);
  } catch (error) { next(error); }
});

export default router;
