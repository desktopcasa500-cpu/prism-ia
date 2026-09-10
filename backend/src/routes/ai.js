import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { getModelProfile, validateThinking, normalizeEffort } from '../services/modelRouter.js';
import { runOrchestration } from '../services/orchestrator.js';
import { MODEL_REQUIREMENTS, PLAN_FEATURES, normalizePlanRank, reserveUsage, releaseUsage, recordTokens } from '../services/usage.js';

const router = Router();
router.use(requireAuth);
const MAX_FILE_CONTENT = 2_000_000;
const PLAN_NAMES = ['Grátis', 'Base', 'Medium', 'Pro', 'Empresarial'];
const ALLOWED_EFFORTS = new Set(['low', 'medium', 'high', 'max', 'ultracode']);
const UNAVAILABLE_MESSAGE = 'Estamos com instabilidade nos servidores. Tente novamente mais tarde.';

function parseArtifacts(text) {
  const artifacts = [];
  const pattern = /<file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/file>/gi;
  let match;
  while ((match = pattern.exec(String(text || ''))) !== null) {
    const path = match[1].trim().replace(/^\/+/, '');
    if (!path || path.includes('..') || path.length > 500) continue;
    const content = match[2].replace(/^\n/, '').replace(/\n$/, '');
    if (content.length <= MAX_FILE_CONTENT) artifacts.push({ path, content });
  }
  return artifacts.filter((item, index, array) => array.findIndex((entry) => entry.path === item.path) === index);
}
async function getAccount(userId) { const result = await pool.query('SELECT plan FROM users WHERE id=$1', [userId]); if (!result.rows.length) return null; const plan = result.rows[0].plan || 'free'; return { plan, rank: normalizePlanRank(plan) }; }
async function authorizeGeneration(userId, model, thinking) {
  if (!Object.prototype.hasOwnProperty.call(MODEL_REQUIREMENTS, model)) return { ok: false, status: 400, code: 'INVALID_MODEL', error: 'Modelo inválido.' };
  const account = await getAccount(userId); if (!account) return { ok: false, status: 401, code: 'AUTH_REQUIRED', error: 'Sessão expirada.' };
  const requiredRank = MODEL_REQUIREMENTS[model];
  if (account.rank < requiredRank) return { ok: false, status: 403, code: 'PLAN_UPGRADE_REQUIRED', error: 'Este modelo não está disponível no seu plano.', model, requiredPlan: PLAN_NAMES[requiredRank] || 'Pro' };
  if (!validateThinking(model, thinking)) return { ok: false, status: 400, code: 'INVALID_EFFORT', error: 'Nível de pensamento inválido.' };
  if (thinking === 'ultracode' && !PLAN_FEATURES[account.rank]?.ultracode) return { ok: false, status: 403, code: 'PLAN_UPGRADE_REQUIRED', error: 'O modo Ultracode está disponível apenas no plano Empresarial.', model, requiredPlan: 'Empresarial' };
  return { ok: true, ...account };
}
async function validateSession(sessionId, userId) { if (!sessionId) return null; const result = await pool.query('SELECT id,title,surface FROM sessions WHERE id=$1 AND user_id=$2', [sessionId, userId]); if (!result.rows.length) throw Object.assign(new Error('Sessão não encontrada.'), { status: 404, code: 'SESSION_NOT_FOUND' }); return result.rows[0]; }
async function loadProjectContext(projectId, userId) {
  if (!projectId) return { project: null, files: [] };
  const project = await pool.query('SELECT id,name FROM projects WHERE id=$1 AND user_id=$2', [projectId, userId]);
  if (!project.rows.length) throw Object.assign(new Error('Projeto não encontrado'), { status: 404, code: 'PROJECT_NOT_FOUND' });
  const files = await pool.query('SELECT id,path,content,kind,updated_at FROM project_files WHERE project_id=$1 AND user_id=$2 ORDER BY path', [projectId, userId]);
  return { project: project.rows[0], files: files.rows };
}
async function loadAttachments(ids, userId) {
  const safe = Array.isArray(ids) ? [...new Set(ids.map(String).filter(Boolean))].slice(0, 20) : [];
  if (!safe.length) return { ids: [], attachments: [], context: '' };
  const result = await pool.query('SELECT id,name,mime_type,size_bytes,content FROM uploads WHERE id=ANY($2::uuid[]) AND user_id=$1 ORDER BY created_at ASC', [userId, safe]);
  const attachments = result.rows.map((row) => ({ id: row.id, name: row.name, mime_type: row.mime_type, size_bytes: Number(row.size_bytes || 0) }));
  const context = result.rows.map((row) => {
    const ext = row.name.split('.').pop()?.toLowerCase();
    if (row.content && ['txt','md','json','csv','js','ts','jsx','tsx','html','css','py','java','go','rs','sql'].includes(ext)) return `ATTACHMENT: ${row.name}\n${Buffer.from(row.content).toString('utf8').slice(0, 120_000)}`;
    return `ATTACHMENT: ${row.name} (${row.mime_type || 'file'}, ${Number(row.size_bytes || 0)} bytes)`;
  }).join('\n\n').slice(0, 180_000);
  return { ids: result.rows.map((row) => row.id), attachments, context };
}
async function persistArtifacts(projectId, userId, artifacts, onArtifact) {
  if (!projectId || !artifacts.length) return { filesChanged: [], filesCreated: [] };
  const changed = [], created = [];
  for (const artifact of artifacts) {
    const existing = await pool.query('SELECT id FROM project_files WHERE project_id=$1 AND user_id=$2 AND path=$3', [projectId, userId, artifact.path]);
    if (existing.rows.length) { await pool.query("UPDATE project_files SET content=$1,kind='file',updated_at=now() WHERE id=$2 AND user_id=$3", [artifact.content, existing.rows[0].id, userId]); changed.push(artifact.path); onArtifact?.({ path: artifact.path, content: artifact.content, action: 'updated' }); }
    else { await pool.query("INSERT INTO project_files(project_id,user_id,path,content,kind) VALUES($1,$2,$3,$4,'file')", [projectId, userId, artifact.path, artifact.content]); created.push(artifact.path); onArtifact?.({ path: artifact.path, content: artifact.content, action: 'created' }); }
  }
  await pool.query('UPDATE projects SET updated_at=now() WHERE id=$1 AND user_id=$2', [projectId, userId]);
  return { filesChanged: changed, filesCreated: created };
}
function buildProjectPrompt(prompt, project, files, attachments = '') {
  const fileContext = files.filter((file) => file.kind !== 'folder').map((file) => `FILE: ${file.path}\n${String(file.content || '').slice(0, 120_000)}`).join('\n\n').slice(-120_000);
  return ['Você está operando dentro do Prism Codex sobre um projeto real.','Analise primeiro os arquivos fornecidos. Preserve o que já funciona e faça somente as alterações necessárias.','Quando precisar criar ou modificar arquivos, devolva cada arquivo completo usando exatamente <file path="CAMINHO">CONTEUDO</file>.','Não diga que executou comandos, testes, commits ou ferramentas se isso não ocorreu de fato.','Se não houver executor de terminal disponível, não simule execução.','Durante a execução, descreva apenas ações observáveis: arquivos lidos, criados, alterados, salvos e validações realizadas. Nunca revele raciocínio privado interno.',`Projeto: ${project.name} (${project.id})`,`Arquivos atuais:\n${fileContext || '(nenhum arquivo ainda)'}`,attachments ? `Arquivos anexados:\n${attachments}` : '',`Pedido do usuário:\n${prompt}`].filter(Boolean).join('\n\n');
}
async function persistGenerationMessages(sessionId, userId, prompt, result, thinking, model, attachments = []) {
  const session = await validateSession(sessionId, userId); if (!session) return null;
  const title = session.title === 'Nova conversa' ? prompt.replace(/\s+/g, ' ').slice(0, 64) || 'Nova conversa' : session.title;
  await pool.query("INSERT INTO messages(session_id,user_id,role,content,effort,model_id,metadata) VALUES($1,$2,'user',$3,$4,$5,$6)", [sessionId,userId,prompt,thinking,model,JSON.stringify({ surface: 'codex', attachments })]);
  const tokens = Number.isFinite(Number(result?.tokens)) ? Math.max(0, Math.floor(Number(result.tokens))) : 0;
  const saved = await pool.query(`INSERT INTO messages(session_id,user_id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata) VALUES($1,$2,'assistant',$3,$4,$5,$6,$7,$8,$9) RETURNING id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata,created_at`, [sessionId,userId,String(result?.text || '').trim() || 'Projeto atualizado.',thinking,tokens,result?.providers?.[0] || null,model,'Execução concluída pelo Codex.',JSON.stringify({ surface:'codex',tools_used:result?.tools_used||[],files_changed:result?.files_changed||[],files_created:result?.files_created||[],attachments })]);
  await pool.query('UPDATE sessions SET title=$1,updated_at=now() WHERE id=$2 AND user_id=$3', [title,sessionId,userId]);
  return saved.rows[0] || null;
}
async function executeGeneration({ model, thinking, prompt, context, projectId, userId, mcpServerIds = [], attachmentIds = [], onPhase, onTrace, onArtifact }) {
  const workspace = await loadProjectContext(projectId,userId);
  const attachmentData = await loadAttachments(attachmentIds,userId);
  onPhase?.({ phase:'analyzing', label:'Analisando o projeto', detail:`${workspace.files.filter((file)=>file.kind!=='folder').length} arquivos no workspace` });
  for (const file of workspace.files.filter((entry)=>entry.kind!=='folder').slice(0, 20)) onTrace?.({ action:'read', path:file.path, detail:`Lendo ${file.path}` });
  for (const file of attachmentData.attachments) onTrace?.({ action:'read', path:file.name, detail:`Lendo anexo ${file.name}` });
  onTrace?.({ action:'think', detail:'Relacionando o pedido com o projeto e os arquivos disponíveis' });
  const agentPrompt = workspace.project ? buildProjectPrompt(prompt,workspace.project,workspace.files,attachmentData.context) : [prompt,attachmentData.context].filter(Boolean).join('\n\n');
  onPhase?.({ phase:'planning', label:'Planejando', detail:'Definindo a implementação antes de editar' });
  onTrace?.({ action:'plan', detail:'Definindo quais arquivos precisam ser criados ou alterados' });
  const safeMcpIds = Array.isArray(mcpServerIds) ? mcpServerIds.map(String).filter(Boolean).slice(0,32) : [];
  const result = await runOrchestration(agentPrompt,thinking,{ ...getModelProfile(model), id:model },context,userId,{ mcpServerIds:safeMcpIds });
  if (result?.status === 'unavailable') return result;
  const artifacts = parseArtifacts(result.text);
  for (const artifact of artifacts) onTrace?.({ action:'edit', path:artifact.path, detail:`${workspace.files.some((file)=>file.path===artifact.path) ? 'Editando' : 'Criando'} ${artifact.path}` });
  onPhase?.({ phase:'writing', label:'Escrevendo arquivos', detail: artifacts.length ? `${artifacts.length} arquivo(s) retornado(s)` : 'Processando a resposta do agente' });
  const persisted = await persistArtifacts(projectId,userId,artifacts,onArtifact);
  for (const path of persisted.filesChanged) onTrace?.({ action:'saved', path, detail:`Salvo ${path}` });
  for (const path of persisted.filesCreated) onTrace?.({ action:'saved', path, detail:`Criado e salvo ${path}` });
  onPhase?.({ phase:'reviewing', label:'Revisando', detail:'Verificando os arquivos recebidos e a estrutura do resultado' });
  onTrace?.({ action:'validate', detail:'Verificando estrutura dos arquivos gerados' });
  onPhase?.({ phase:'updating', label:'Atualizando o workspace', detail:`${artifacts.length} arquivo(s) recebido(s)` });
  const cleanedText = String(result.text || '').replace(/<file\s+path=["'][^"']+["']\s*>[\s\S]*?<\/file>/gi,'').replace(/<prism:summary>([\s\S]*?)<\/prism:summary>/gi,'$1').replace(/\n{3,}/g,'\n\n').trim();
  return { model,thinking,...result,text:cleanedText || (artifacts.length ? 'Alterações aplicadas ao projeto real.' : result.text),project_id:projectId,files_changed:persisted.filesChanged,files_created:persisted.filesCreated,attachments:attachmentData.attachments };
}
function readGenerationInput(req) {
  const model=String(req.body?.model||'prism-mini-1.0').trim(); const rawThinking=String(req.body?.thinking||'medium').trim().toLowerCase(); const mcpServerIds=Array.isArray(req.body?.mcpServerIds)?req.body.mcpServerIds.map(String).filter(Boolean).slice(0,32):[]; const attachmentIds=Array.isArray(req.body?.attachmentIds)?req.body.attachmentIds.map(String).filter(Boolean).slice(0,20):[]; const sessionId=req.body?.sessionId?String(req.body.sessionId):null;
  return { model,rawThinking,thinking:normalizeEffort(rawThinking),prompt:String(req.body?.prompt||'').replace(/\u0000/g,'').trim(),context:String(req.body?.context||'').replace(/\u0000/g,'').slice(-30_000),projectId:req.body?.projectId?String(req.body.projectId):null,sessionId,mcpServerIds,attachmentIds };
}
async function runGeneration(req,res,stream=false){
  let reservation=null,heartbeat=null,closed=false;
  try{
    const input=readGenerationInput(req); if(!input.prompt)return res.status(400).json({error:'Prompt vazio',code:'EMPTY_PROMPT'}); if(input.prompt.length>50_000)return res.status(413).json({error:'Pedido muito longo',code:'PROMPT_TOO_LONG'}); if(!ALLOWED_EFFORTS.has(input.rawThinking))return res.status(400).json({error:'Nível de pensamento inválido.',code:'INVALID_EFFORT'});
    const authorization=await authorizeGeneration(req.userId,input.model,input.thinking); if(!authorization.ok)return res.status(authorization.status).json(authorization); await validateSession(input.sessionId,req.userId);
    reservation=await reserveUsage(req.userId,input.model); if(!reservation.ok)return res.status(reservation.status||429).json({error:'O limite de uso desta janela foi atingido.',code:reservation.code,usage:reservation.usage});
    if(!stream){ const result=await executeGeneration({...input,userId:req.userId}); if(result?.status==='unavailable'){await releaseUsage(reservation.reservationId).catch(()=>{});reservation=null;return res.status(503).json({status:'unavailable',message:UNAVAILABLE_MESSAGE})} await recordTokens(reservation.reservationId,result.providers?.[0]||null,result.tokens||0); const saved=await persistGenerationMessages(input.sessionId,req.userId,input.prompt,result,input.thinking,input.model,result.attachments||[]); reservation=null; return res.json({...result,message:saved}); }
    res.status(200); res.setHeader('Content-Type','text/event-stream; charset=utf-8'); res.setHeader('Cache-Control','no-cache, no-transform'); res.setHeader('Connection','keep-alive'); res.setHeader('X-Accel-Buffering','no'); res.flushHeaders?.();
    const close=()=>{closed=true;if(heartbeat)clearInterval(heartbeat);if(reservation?.reservationId)releaseUsage(reservation.reservationId).catch(()=>{});reservation=null}; req.on('aborted',close); res.on('close',()=>{if(!res.writableEnded)close()}); heartbeat=setInterval(()=>{if(!closed&&!res.writableEnded)res.write(`: heartbeat ${Date.now()}\n\n`)},1500); const send=(payload)=>{if(!closed&&!res.writableEnded)res.write(`data: ${JSON.stringify(payload)}\n\n`)}; const startedAt=Date.now();
    try{ send({type:'phase',phase:'received',label:'Pedido recebido',detail:'Preparando o agente'}); const result=await executeGeneration({...input,userId:req.userId,onPhase:(phase)=>send({type:'phase',...phase,elapsedMs:Date.now()-startedAt}),onTrace:(trace)=>send({type:'trace',...trace,elapsedMs:Date.now()-startedAt}),onArtifact:(artifact)=>send({type:'artifact',...artifact,elapsedMs:Date.now()-startedAt})}); if(closed)return; if(result?.status==='unavailable'){await releaseUsage(reservation.reservationId).catch(()=>{});reservation=null;send({type:'error',code:'PROVIDERS_UNAVAILABLE',message:UNAVAILABLE_MESSAGE})}else{await recordTokens(reservation.reservationId,result.providers?.[0]||null,result.tokens||0);reservation=null;const saved=await persistGenerationMessages(input.sessionId,req.userId,input.prompt,result,input.thinking,input.model,result.attachments||[]);send({type:'phase',phase:'completed',label:'Concluído',detail:'O workspace recebeu o resultado do agente',elapsedMs:Date.now()-startedAt});send({type:'result',data:{...result,message:saved}})}}catch(error){if(reservation?.reservationId){await releaseUsage(reservation.reservationId).catch(()=>{});reservation=null}if(!closed)send({type:'error',code:error?.code||'GENERATION_FAILED',message:error?.code==='PROJECT_NOT_FOUND'?'Projeto não encontrado.':error?.code==='SESSION_NOT_FOUND'?'Sessão não encontrada.':UNAVAILABLE_MESSAGE})}finally{closed=true;if(heartbeat)clearInterval(heartbeat);if(!res.writableEnded)res.end()}
  }catch(error){if(reservation?.reservationId)await releaseUsage(reservation.reservationId).catch(()=>{});console.error(`${stream?'AI streaming':'AI'} generation error:`,{code:error?.code,status:error?.status,message:error?.message});if(!res.headersSent)return res.status(error?.status||502).json(error?.code==='PROJECT_NOT_FOUND'?{error:'Projeto não encontrado.',code:error.code}:error?.code==='SESSION_NOT_FOUND'?{error:'Sessão não encontrada.',code:error.code}:{error:error?.message||'Não foi possível iniciar a geração.',code:error?.code||'GENERATION_FAILED'});if(!res.writableEnded)res.end()}
}
router.post('/generate',(req,res)=>runGeneration(req,res,false));
router.post('/generate/stream',(req,res)=>runGeneration(req,res,true));
export default router;
