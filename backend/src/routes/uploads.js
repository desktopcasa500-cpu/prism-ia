import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
const MIME_BY_EXT = {
  pdf:'application/pdf', zip:'application/zip', js:'text/javascript', ts:'text/plain', jsx:'text/plain', tsx:'text/plain', html:'text/html', css:'text/css', json:'application/json', md:'text/markdown', txt:'text/plain', csv:'text/csv',
  docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', odt:'application/vnd.oasis.opendocument.text', rtf:'application/rtf', epub:'application/epub+zip',
  png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', gif:'image/gif', svg:'image/svg+xml', py:'text/x-python', java:'text/x-java-source', go:'text/plain', rs:'text/plain', sql:'application/sql'
};
const MAX_BYTES = 10 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set(['txt','md','json','csv','js','ts','jsx','tsx','html','css','py','java','go','rs','sql']);
function extension(name) { return String(name || '').split('.').pop()?.toLowerCase() || ''; }
function cleanName(name) { return String(name || '').replace(/[\u0000\r\n]/g, '').trim().slice(0, 240); }
function decodeText(base64, ext) { if (!TEXT_EXTENSIONS.has(ext)) return null; try { return Buffer.from(base64, 'base64').toString('utf8').slice(0, 2_000_000); } catch { return null; } }

router.get('/', async (req, res, next) => {
  try {
    const projectId = req.query?.projectId ? String(req.query.projectId) : null;
    const result = await pool.query(`SELECT id,project_id,name,mime_type,size_bytes,created_at FROM uploads WHERE user_id=$1 AND ($2::uuid IS NULL OR project_id=$2::uuid) ORDER BY created_at DESC LIMIT 200`, [req.userId, projectId]);
    res.json({ uploads: result.rows.map((row) => ({ ...row, downloadUrl: `/api/uploads/${row.id}`, kind: String(row.mime_type || '').startsWith('image/') ? 'image' : row.mime_type === 'application/pdf' ? 'pdf' : row.mime_type === 'application/zip' ? 'zip' : 'file' })) });
  } catch (error) { next(error); }
});
router.post('/', async (req, res, next) => {
  try {
    const name=cleanName(req.body?.name); const data=String(req.body?.dataBase64||'').trim(); const projectId=req.body?.projectId?String(req.body.projectId):null;
    if(!name||!data)return res.status(400).json({error:'Nome e conteúdo do arquivo são obrigatórios.',code:'FILE_REQUIRED'});
    const ext=extension(name); if(!MIME_BY_EXT[ext])return res.status(415).json({error:'Tipo de arquivo não suportado.',code:'FILE_TYPE_UNSUPPORTED'});
    const normalized=data.includes(',')?data.slice(data.indexOf(',')+1):data; const buffer=Buffer.from(normalized,'base64');
    if(!buffer.length||buffer.length>MAX_BYTES)return res.status(413).json({error:`O arquivo deve ter até ${MAX_BYTES/1024/1024} MB.`,code:'FILE_TOO_LARGE'});
    if(projectId){const owned=await pool.query('SELECT id FROM projects WHERE id=$1 AND user_id=$2',[projectId,req.userId]);if(!owned.rows.length)return res.status(404).json({error:'Projeto não encontrado.',code:'PROJECT_NOT_FOUND'});}
    const mimeType=MIME_BY_EXT[ext]; const textContent=decodeText(normalized,ext);
    const result=await pool.query('INSERT INTO uploads(user_id,project_id,name,mime_type,size_bytes,content) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,mime_type,size_bytes,project_id,created_at',[req.userId,projectId,name,mimeType,buffer.length,buffer]);
    res.status(201).json({upload:result.rows[0],textContent,isText:textContent!==null,downloadUrl:`/api/uploads/${result.rows[0].id}`});
  } catch(error){next(error);}
});
router.get('/:id', async(req,res,next)=>{try{const result=await pool.query('SELECT name,mime_type,size_bytes,content FROM uploads WHERE id=$1 AND user_id=$2',[req.params.id,req.userId]);if(!result.rows.length)return res.status(404).json({error:'Arquivo não encontrado.',code:'FILE_NOT_FOUND'});const file=result.rows[0];res.setHeader('Content-Type',file.mime_type||'application/octet-stream');res.setHeader('Content-Length',String(file.size_bytes));res.setHeader('Content-Disposition',`attachment; filename="${file.name.replace(/"/g,'')}"`);return res.end(file.content);}catch(error){next(error);}});
router.post('/analyze',async(req,res)=>{const file=req.body?.file;const name=cleanName(file?.name);if(!name)return res.status(400).json({error:'Arquivo não informado'});const ext=extension(name);if(!MIME_BY_EXT[ext])return res.status(415).json({error:'Tipo de arquivo não suportado'});return res.json({file:name,type:ext,status:'ready',capabilities:['file-context','code-analysis','bug-detection','project-understanding']});});
export default router;
