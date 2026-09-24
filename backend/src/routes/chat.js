import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { runOrchestration } from '../services/orchestrator.js';
import { normalizeEffort, validateThinking } from '../services/modelRouter.js';
import { getUsage, getDailyUsage, reserveUsage, releaseUsage, recordTokens, MODEL_REQUIREMENTS, normalizePlanRank, PLAN_FEATURES } from '../services/usage.js';

const router = Router(); router.use(requireAuth);
const SURFACES = new Set(['home','codex']); const EFFORTS = new Set(['low','medium','high','max','ultracode']);
const PLAN_NAMES = ['Grátis','Base','Medium','Pro','Empresarial']; const MAX_MESSAGE = 20_000; const MAX_HISTORY = 24; const MAX_ATTACHMENTS = 20;
const TEXT_FILES = new Set(['txt','md','json','csv','js','ts','jsx','tsx','html','css','py','java','go','rs','sql','xml','yml','yaml']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid=(v)=>typeof v==='string'&&UUID.test(v); const clean=(v,max=MAX_MESSAGE)=>typeof v==='string'?v.replace(/\u0000/g,'').trim().slice(0,max):'';
const surface=(v)=>{const s=clean(v,20).toLowerCase();return SURFACES.has(s)?s:'home';}; const requestKey=(v)=>clean(v,120).replace(/[^a-zA-Z0-9._:-]/g,'');

async function account(userId){const result=await pool.query('SELECT plan FROM users WHERE id=$1',[userId]);if(!result.rows.length)return null;const plan=result.rows[0].plan||'free';return{plan,rank:normalizePlanRank(plan)};}
async function authorize(userId,model,effort){const user=await account(userId);if(!user)return{ok:false,status:401,code:'AUTH_REQUIRED',error:'Sessão expirada.'};const required=MODEL_REQUIREMENTS[model];if(required===undefined)return{ok:false,status:400,code:'INVALID_MODEL',error:'Modelo inválido.'};if(user.rank<required)return{ok:false,status:403,code:'PLAN_UPGRADE_REQUIRED',error:'Este modelo não está disponível no seu plano.',requiredPlan:PLAN_NAMES[required]||'Pro',model};if(!EFFORTS.has(effort)||!validateThinking(model,effort))return{ok:false,status:400,code:'INVALID_EFFORT',error:'Nível de pensamento inválido.'};if(effort==='ultracode'&&!PLAN_FEATURES[user.rank]?.ultracode)return{ok:false,status:403,code:'PLAN_UPGRADE_REQUIRED',error:'Ultracode está disponível apenas no plano Empresarial.',requiredPlan:'Empresarial',model};return{ok:true,effort:normalizeEffort(effort),requestedEffort:effort,...user};}
async function getSession(id,userId,expected=null){if(!isUuid(id))return null;const result=await pool.query('SELECT id,title,surface,created_at,updated_at FROM sessions WHERE id=$1 AND user_id=$2',[id,userId]);const row=result.rows[0];return row&&(!expected||row.surface===expected)?row:null;}
async function history(id,userId){const result=await pool.query('SELECT role,content FROM messages WHERE session_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT $3',[id,userId,MAX_HISTORY]);return result.rows.reverse().map((row)=>`${row.role}: ${row.content}`).join('\n');}
async function getAttachments(ids,userId){const requested=Array.isArray(ids)?[...new Set(ids.map(String).filter(Boolean))].slice(0,MAX_ATTACHMENTS):[];if(requested.some((id)=>!isUuid(id)))throw Object.assign(new Error('Anexo inválido.'),{status:400,code:'INVALID_ATTACHMENT_ID'});if(!requested.length)return{items:[],context:[]};const result=await pool.query('SELECT id,name,mime_type,size_bytes,content FROM uploads WHERE user_id=$1 AND id=ANY($2::uuid[]) ORDER BY created_at ASC',[userId,requested]);const found=new Set(result.rows.map((row)=>String(row.id)));if(requested.some((id)=>!found.has(id)))throw Object.assign(new Error('Anexo não encontrado.'),{status:404,code:'ATTACHMENT_NOT_FOUND'});const items=result.rows.map((row)=>({id:row.id,name:row.name,mime_type:row.mime_type,size_bytes:Number(row.size_bytes||0)}));const context=result.rows.map((row)=>{const ext=String(row.name).split('.').pop()?.toLowerCase()||'';return row.content&&TEXT_FILES.has(ext)?`ARQUIVO: ${row.name}\n${Buffer.from(row.content).toString('utf8').slice(0,120000)}`:`ARQUIVO: ${row.name} (${row.mime_type||'arquivo'}, ${Number(row.size_bytes||0)} bytes)`;});return{items,context};}

async function saveTurn({session,userId,prompt,model,effort,result,attachments,requestId,projectId}){const usage=await getUsage(userId);const meta=JSON.stringify({client_request_id:requestId||undefined,attachments,project_id:projectId||null,requested_effort:effort,providers_used:result?.providers||[],tools_used:result?.tools_used||[]});const client=await pool.connect();try{await client.query('BEGIN');const userMessage=await client.query(`INSERT INTO messages(session_id,user_id,role,content,effort,model_id,metadata) VALUES($1,$2,'user',$3,$4,$5,$6) RETURNING id,role,content,effort,model_id,metadata,created_at`,[session.id,userId,prompt,effort,model,meta]);const assistant=await client.query(`INSERT INTO messages(session_id,user_id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata) VALUES($1,$2,'assistant',$3,$4,$5,$6,$7,$8,$9) RETURNING id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata,created_at`,[session.id,userId,String(result.text||'').trim()||'Resposta concluída.',effort,Number(result.tokens||0),result.providers?.[0]||null,model,'Execução concluída com as ferramentas disponíveis.',meta]);const title=session.title==='Nova conversa'?clean(prompt,64).replace(/\s+/g,' ')||'Nova conversa':session.title;await client.query('UPDATE sessions SET title=$1,updated_at=now() WHERE id=$2 AND user_id=$3',[title,session.id,userId]);await client.query('COMMIT');return{userMessage:userMessage.rows[0],message:assistant.rows[0],usage,attachments:result.attachments||attachments,tools:result.tools_used||[]};}catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}}

async function process({req,input,onProgress}){const {session,prompt,model,effort,attachments,projectId,requestId,surface}=input;const access=await authorize(req.userId,model,effort);if(!access.ok)throw Object.assign(new Error(access.error),access);const reservation=await reserveUsage(req.userId,model);if(!reservation.ok)throw Object.assign(new Error('O limite de uso foi atingido.'),{status:reservation.status||429,code:reservation.code,usage:reservation.usage});try{onProgress?.({type:'quota_reserved',message:'Uso reservado.'});const files=await getAttachments(attachments,req.userId);const contextHistory=await history(session.id,req.userId);const preferences=await pool.query('SELECT assistant_instructions FROM users WHERE id=$1',[req.userId]);const instructions=String(preferences.rows[0]?.assistant_instructions||'').trim().slice(0,6000);const preferenceContext=instructions?`INSTRUÇÕES PESSOAIS DO USUÁRIO:\n${instructions}`:'';const context=[preferenceContext,`SUPERFÍCIE ATUAL: ${surface}`,contextHistory,...files.context].filter(Boolean).join('\n\n').slice(-180000);const finalPrompt=prompt||'Analise os arquivos anexados e responda com base neles.';const result=await runOrchestration(finalPrompt,access.effort,{model},context,req.userId,{projectId:projectId||null,onProgress,signal:requestAbort.signal});if(result?.status!=='ok')throw Object.assign(new Error(result?.message||'Serviço de IA temporariamente indisponível.'),{status:503,code:'AI_UNAVAILABLE'});await recordTokens(reservation.reservationId,result.providers?.[0]||null,Number(result.tokens||0));return saveTurn({session,userId:req.userId,prompt:finalPrompt,model,effort:input.effort,result,attachments:files.items,requestId,projectId});}catch(error){await releaseUsage(reservation.reservationId).catch(()=>{});throw error;}}

async function prepare(req){const raw=typeof req.body?.content==='string'?req.body.content:'';if(raw.length>MAX_MESSAGE)throw Object.assign(new Error(`Mensagem limitada a ${MAX_MESSAGE.toLocaleString('pt-BR')} caracteres.`),{status:413,code:'MESSAGE_TOO_LARGE'});const prompt=clean(raw);const model=clean(req.body?.model,80)||'prism-mini-1.0';const effort=clean(req.body?.effort,20).toLowerCase()||'medium';const attachments=Array.isArray(req.body?.attachmentIds)?req.body.attachmentIds:[];const projectId=clean(req.body?.projectId,120)||null;const requestId=requestKey(req.body?.clientRequestId);const requestedSurface=surface(req.body?.surface);if(!prompt&&!attachments.length)throw Object.assign(new Error('Mensagem vazia.'),{status:400,code:'EMPTY_MESSAGE'});if(!EFFORTS.has(effort))throw Object.assign(new Error('Nível de pensamento inválido.'),{status:400,code:'INVALID_EFFORT'});if(!isUuid(req.params.id))throw Object.assign(new Error('Identificador de sessão inválido.'),{status:400,code:'INVALID_SESSION_ID'});const session=await getSession(req.params.id,req.userId,requestedSurface);if(!session)throw Object.assign(new Error('Conversa não encontrada.'),{status:404,code:'SESSION_NOT_FOUND'});return{session,prompt,model,effort,attachments,projectId,requestId,surface:requestedSurface};}

router.get('/usage',async(req,res,next)=>{try{res.json(await getUsage(req.userId));}catch(error){next(error);}});router.get('/usage/history',async(req,res,next)=>{try{res.json(await getDailyUsage(req.userId,req.query?.days));}catch(error){next(error);}});router.get('/usage/account',async(req,res,next)=>{try{res.json({usage:await getUsage(req.userId)});}catch(error){next(error);}});
router.get('/sessions',async(req,res,next)=>{try{const result=await pool.query('SELECT id,title,surface,created_at,updated_at FROM sessions WHERE user_id=$1 AND surface=$2 ORDER BY updated_at DESC,created_at DESC LIMIT 100',[req.userId,surface(req.query?.surface)]);res.json({sessions:result.rows});}catch(error){next(error);}});
router.post('/sessions',async(req,res,next)=>{try{const title=clean(req.body?.title,120).replace(/\s+/g,' ')||'Nova conversa';const result=await pool.query('INSERT INTO sessions(user_id,title,surface) VALUES($1,$2,$3) RETURNING id,title,surface,created_at,updated_at',[req.userId,title,surface(req.body?.surface)]);res.status(201).json({session:result.rows[0]});}catch(error){next(error);}});
router.patch('/sessions/:id',async(req,res,next)=>{try{if(!isUuid(req.params.id))return res.status(400).json({error:'Identificador inválido.',code:'INVALID_SESSION_ID'});const title=clean(req.body?.title,120).replace(/\s+/g,' ');if(!title)return res.status(400).json({error:'Título inválido.',code:'INVALID_TITLE'});const result=await pool.query('UPDATE sessions SET title=$1,updated_at=now() WHERE id=$2 AND user_id=$3 RETURNING id,title,surface,created_at,updated_at',[title,req.params.id,req.userId]);if(!result.rows.length)return res.status(404).json({error:'Sessão não encontrada.',code:'SESSION_NOT_FOUND'});res.json({session:result.rows[0]});}catch(error){next(error);}});
router.get('/sessions/:id/messages',async(req,res,next)=>{try{if(!isUuid(req.params.id))return res.status(400).json({error:'Identificador inválido.',code:'INVALID_SESSION_ID'});const session=await getSession(req.params.id,req.userId,req.query?.surface?surface(req.query.surface):null);if(!session)return res.status(404).json({error:'Sessão não encontrada.',code:'SESSION_NOT_FOUND'});const result=await pool.query('SELECT id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata,created_at FROM messages WHERE session_id=$1 AND user_id=$2 ORDER BY created_at ASC LIMIT 500',[req.params.id,req.userId]);res.json({messages:result.rows,surface:session.surface});}catch(error){next(error);}});
router.delete('/sessions/:id',async(req,res,next)=>{try{if(!isUuid(req.params.id))return res.status(400).json({error:'Identificador inválido.',code:'INVALID_SESSION_ID'});const result=await pool.query('DELETE FROM sessions WHERE id=$1 AND user_id=$2 RETURNING id',[req.params.id,req.userId]);if(!result.rows.length)return res.status(404).json({error:'Sessão não encontrada.',code:'SESSION_NOT_FOUND'});res.status(204).end();}catch(error){next(error);}});

async function handle(req,res,stream){
  let heartbeat = null;
  const requestAbort = new AbortController();
  const abortRequest = () => requestAbort.abort();
  req.on('aborted', abortRequest);
  res.on('close', () => {
    if (!res.writableEnded) requestAbort.abort();
  });

  const send = stream
    ? (event) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`); }
    : () => {};

  if (stream) {
    heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(': ping\n\n');
    }, 15000);
    heartbeat.unref?.();
  }

  try {
    const input=await prepare(req);if(input.requestId){const duplicate=await pool.query(`SELECT id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata,created_at FROM messages WHERE user_id=$1 AND role='assistant' AND metadata->>'client_request_id'=$2 ORDER BY created_at DESC LIMIT 1`,[req.userId,input.requestId]);if(duplicate.rows[0]){if(stream)send({type:'result',data:{message:duplicate.rows[0],usage:await getUsage(req.userId),duplicate:true}});else return res.json({message:duplicate.rows[0],usage:await getUsage(req.userId),duplicate:true});return;}}
  const result=await process({req,input,onProgress:send});if(stream)send({type:'result',data:result});else res.status(201).json(result);
}catch(error){if(stream)send({type:'error',message:error?.message||'Execução falhou.',code:error?.code||'CHAT_EXECUTION_FAILED',status:error?.status||500});else res.status(error?.status||500).json({error:error?.message||'Execução falhou.',code:error?.code||'CHAT_EXECUTION_FAILED',payload:error});}
  finally {
    if (heartbeat) clearInterval(heartbeat);
    req.off('aborted', abortRequest);
  }
}
router.post('/sessions/:id/messages',async(req,res)=>handle(req,res,false));
router.post('/sessions/:id/messages/stream',async(req,res)=>{
  res.statusCode=200;
  res.setHeader('Content-Type','text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control','no-cache, no-transform');
  res.setHeader('Connection','keep-alive');
  res.setHeader('X-Accel-Buffering','no');
  res.flushHeaders?.();
  await handle(req,res,true);
  if (!res.writableEnded) res.end();
});
export default router;
