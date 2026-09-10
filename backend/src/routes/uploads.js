import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
const MIME_BY_EXT = { pdf:'application/pdf', zip:'application/zip', js:'text/javascript', ts:'text/plain', jsx:'text/plain', tsx:'text/plain', html:'text/html', css:'text/css', json:'application/json', md:'text/markdown', txt:'text/plain', csv:'text/csv', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', gif:'image/gif', svg:'image/svg+xml', py:'text/x-python', java:'text/x-java-source', go:'text/plain', rs:'text/plain', sql:'application/sql' };
const MAX_BYTES = 10 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set(['txt','md','json','csv','js','ts','jsx','tsx','html','css','py','java','go','rs','sql']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
function extension(name) { return String(name || '').split('.').pop()?.toLowerCase() || ''; }
function cleanName(name) { return String(name || '').replace(/[\u0000\r\n]/g, '').trim().slice(0, 240); }
function validUuid(value) { return UUID_RE.test(String(value || '')); }
function normalizeBase64(value) { const input = String(value || '').trim(); const normalized = input.includes(',') ? input.slice(input.indexOf(',') + 1) : input; return normalized.replace(/\s+/g, ''); }
function decodeText(base64, ext) { if (!TEXT_EXTENSIONS.has(ext)) return null; try { return Buffer.from(base64, 'base64').toString('utf8').slice(0, 2_000_000); } catch { return null; } }

router.get('/', async (req, res, next) => {
  try {
    const projectId = req.query?.projectId ? String(req.query.projectId) : null;
    if (projectId && !validUuid(projectId)) return res.status(400).json({ error: 'Identificador de projeto inválido.', code: 'INVALID_PROJECT_ID' });
    const result = await pool.query(
      `SELECT id,project_id,name,mime_type,size_bytes,created_at
         FROM uploads
        WHERE user_id=$1 AND ($2::uuid IS NULL OR project_id=$2::uuid)
        ORDER BY created_at DESC LIMIT 200`,
      [req.userId, projectId],
    );
    res.json({ uploads: result.rows.map((row) => ({ ...row, downloadUrl: `/api/uploads/${row.id}`, kind: String(row.mime_type || '').startsWith('image/') ? 'image' : row.mime_type === 'application/pdf' ? 'pdf' : row.mime_type === 'application/zip' ? 'zip' : 'file' })) });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const name = cleanName(req.body?.name); const rawData = String(req.body?.dataBase64 || '').trim(); const projectId = req.body?.projectId ? String(req.body.projectId) : null;
    if (!name || !rawData) return res.status(400).json({ error: 'Nome e conteúdo do arquivo são obrigatórios.', code: 'FILE_REQUIRED' });
    const ext = extension(name); if (!MIME_BY_EXT[ext]) return res.status(415).json({ error: 'Tipo de arquivo não suportado.', code: 'FILE_TYPE_UNSUPPORTED' });
    if (projectId && !validUuid(projectId)) return res.status(400).json({ error: 'Identificador de projeto inválido.', code: 'INVALID_PROJECT_ID' });
    const normalized = normalizeBase64(rawData);
    if (!normalized || normalized.length % 4 !== 0 || !BASE64_RE.test(normalized)) return res.status(400).json({ error: 'Conteúdo Base64 inválido.', code: 'FILE_DATA_INVALID' });
    const buffer = Buffer.from(normalized, 'base64');
    if (!buffer.length || buffer.length > MAX_BYTES) return res.status(413).json({ error: `O arquivo deve ter até ${MAX_BYTES / 1024 / 1024} MB.`, code: 'FILE_TOO_LARGE' });
    if (projectId) { const owned = await pool.query('SELECT id FROM projects WHERE id=$1 AND user_id=$2', [projectId, req.userId]); if (!owned.rows.length) return res.status(404).json({ error: 'Projeto não encontrado.', code: 'PROJECT_NOT_FOUND' }); }
    const expectedMimeType = MIME_BY_EXT[ext]; const requestedMimeType = String(req.body?.mimeType || '').trim();
    if (requestedMimeType && requestedMimeType !== expectedMimeType) return res.status(415).json({ error: 'O tipo informado não corresponde à extensão do arquivo.', code: 'FILE_MIME_MISMATCH' });
    const mimeType = expectedMimeType; const textContent = decodeText(normalized, ext);
    const result = await pool.query('INSERT INTO uploads(user_id,project_id,name,mime_type,size_bytes,content) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,mime_type,size_bytes,project_id,created_at', [req.userId, projectId, name, mimeType, buffer.length, buffer]);
    res.status(201).json({ upload: result.rows[0], textContent, isText: textContent !== null, downloadUrl: `/api/uploads/${result.rows[0].id}` });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!validUuid(req.params.id)) return res.status(400).json({ error: 'Identificador de arquivo inválido.', code: 'INVALID_FILE_ID' });
    const result = await pool.query('SELECT name,mime_type,size_bytes,content FROM uploads WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Arquivo não encontrado.', code: 'FILE_NOT_FOUND' });
    const file = result.rows[0];
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream'); res.setHeader('Content-Length', String(file.size_bytes));
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'private, no-store');
    const safeDownloadName = String(file.name || 'arquivo').replace(/["\r\n\\/]/g, '').trim() || 'arquivo';
    res.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName.slice(0, 200)}"`); return res.end(file.content);
  } catch (error) { next(error); }
});

router.post('/analyze', async (req, res) => {
  const file = req.body?.file; const name = cleanName(file?.name); if (!name) return res.status(400).json({ error: 'Arquivo não informado' });
  const ext = extension(name); if (!MIME_BY_EXT[ext]) return res.status(415).json({ error: 'Tipo de arquivo não suportado' });
  return res.json({ file: name, type: ext, status: 'ready', capabilities: ['file-context','code-analysis','bug-detection','project-understanding'] });
});

export default router;
