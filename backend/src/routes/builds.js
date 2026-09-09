import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const router = Router();
const downloadSecret = String(process.env.PRISM_BUILD_DOWNLOAD_SECRET || process.env.JWT_SECRET || 'change-this-build-secret');
const buildCache = new Map();
const BUILD_TTL_MS = 30 * 60 * 1000;

function signDownload(buildId,userId,expiresAt){const payload=`${buildId}.${userId}.${expiresAt}`;const sig=crypto.createHmac('sha256',downloadSecret).update(payload).digest('hex');return Buffer.from(`${payload}.${sig}`).toString('base64url')}
function verifyDownload(token,buildId){try{const value=Buffer.from(String(token||''),'base64url').toString('utf8');const [id,userId,expiresAt,sig]=value.split('.');if(id!==buildId||!userId||Number(expiresAt)<=Date.now()||!sig)return null;const payload=`${id}.${userId}.${expiresAt}`;const expected=crypto.createHmac('sha256',downloadSecret).update(payload).digest('hex');return crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))?userId:null}catch{return null}}
function safeName(value,fallback='prism-app'){return String(value||fallback).replace(/[^a-z0-9._-]+/gi,'-').replace(/^-+|-+$/g,'')||fallback}
function run(command,args,cwd,timeoutMs=240000){return new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Object.assign(new Error('A compilação excedeu o tempo máximo.'),{code:'BUILD_TIMEOUT'}))},timeoutMs);child.stdout.on('data',c=>stdout+=c.toString());child.stderr.on('data',c=>stderr+=c.toString());child.on('error',e=>{clearTimeout(timer);reject(e)});child.on('close',code=>{clearTimeout(timer);if(code===0)return resolve({stdout,stderr});reject(Object.assign(new Error(stderr||stdout||`Processo terminou com código ${code}`),{code:'BUILD_FAILED',exitCode:code}))})})}
function cleanup(){const now=Date.now();for(const [id,item] of buildCache){if(item.expiresAt<=now){fs.rm(item.filePath,{force:true}).catch(()=>{});buildCache.delete(id)}}}
setInterval(cleanup,60000).unref();
router.use((req,res,next)=>req.path.endsWith('/download')?next():requireAuth(req,res,next));

router.post('/',async(req,res)=>{
 let tempDir=null;
 try{
  const projectId=String(req.body?.projectId||'').trim();const target=String(req.body?.target||'win32-x64').trim();if(!projectId)return res.status(400).json({error:'Projeto não informado.',code:'PROJECT_REQUIRED'});if(target!=='win32-x64')return res.status(400).json({error:'Target não suportado.',code:'TARGET_UNSUPPORTED'});
  const project=await pool.query('SELECT id,name FROM projects WHERE id=$1 AND user_id=$2',[projectId,req.userId]);if(!project.rows.length)return res.status(404).json({error:'Projeto não encontrado.',code:'PROJECT_NOT_FOUND'});
  const result=await pool.query("SELECT path,content,kind FROM project_files WHERE project_id=$1 AND user_id=$2 AND kind='file' ORDER BY path",[projectId,req.userId]);if(!result.rows.length)return res.status(400).json({error:'O projeto não possui arquivos.',code:'NO_PROJECT_FILES'});
  const files=result.rows;const packageFile=files.find(f=>f.path.toLowerCase()==='package.json');let pkg={};if(packageFile){try{pkg=JSON.parse(packageFile.content||'{}')}catch{pkg={}}}
  const html=files.find(f=>/^index\.html$/i.test(path.basename(f.path)))||files.find(f=>/\.html?$/i.test(f.path));
  const requestedEntry=String(pkg.main||'').replace(/^\/+/, '');const nodeEntry=requestedEntry?files.find(f=>f.path===requestedEntry):files.find(f=>/^index\.js$/i.test(path.basename(f.path)));
  const buildId=crypto.randomUUID();tempDir=await fs.mkdtemp(path.join(os.tmpdir(),`prism-build-${buildId}-`));
  for(const file of files){const destination=path.join(tempDir,file.path);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,String(file.content||''),'utf8')}
  let buildEntry='';
  if(nodeEntry) buildEntry=nodeEntry.path;
  else if(html){
    const launcher=`import http from 'node:http';\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport { fileURLToPath } from 'node:url';\nconst root=path.join(path.dirname(fileURLToPath(import.meta.url)),'project');\nconst mime={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'text/javascript;charset=utf-8','.json':'application/json;charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};\nconst server=http.createServer((req,res)=>{let requested=decodeURIComponent((req.url||'/').split('?')[0]);if(requested==='/'||requested==='')requested='/index.html';const filePath=path.normalize(path.join(root,requested.replace(/^[/\\\\]+/,'')));if(!filePath.startsWith(root))return res.writeHead(403).end();fs.readFile(filePath,(err,data)=>{if(err)return res.writeHead(404).end('Not found');res.writeHead(200,{'Content-Type':mime[path.extname(filePath)]||'application/octet-stream'});res.end(data)})});server.listen(4173,'127.0.0.1',()=>{import('node:child_process').then(({exec})=>exec('start http://127.0.0.1:4173'))});\n`;
    await fs.mkdir(path.join(tempDir,'project'),{recursive:true});
    for(const file of files){const destination=path.join(tempDir,'project',file.path);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,String(file.content||''),'utf8')}
    await fs.writeFile(path.join(tempDir,'launcher.mjs'),launcher,'utf8');
    const launcherPackage={name:'prism-windows-app',version:'1.0.0',type:'module',main:'launcher.mjs',pkg:{assets:['project/**/*']}};await fs.writeFile(path.join(tempDir,'package.json'),JSON.stringify(launcherPackage,null,2),'utf8');buildEntry='launcher.mjs';
  } else return res.status(422).json({error:'Para criar um .exe, o projeto precisa de package.json/main, index.js ou index.html.',code:'BUILD_ENTRYPOINT_REQUIRED'});
  const outputName=`${safeName(project.rows[0].name)}.exe`;const outputPath=path.join(tempDir,outputName);const pkgBin=path.resolve(process.cwd(),'node_modules','.bin',process.platform==='win32'?'pkg.cmd':'pkg');
  await run(pkgBin,[buildEntry,'--targets','node20-win-x64','--output',outputPath],tempDir);
  const stat=await fs.stat(outputPath);if(!stat.size)throw Object.assign(new Error('O executável foi produzido vazio.'),{code:'EMPTY_BUILD'});
  const expiresAt=Date.now()+BUILD_TTL_MS;buildCache.set(buildId,{userId:req.userId,projectId,filePath:outputPath,filename:outputName,expiresAt});await pool.query("INSERT INTO builds(id,user_id,project_id,platform,filename,status,output_path,expires_at) VALUES($1,$2,$3,$4,$5,'completed',$6,to_timestamp($7/1000.0))",[buildId,req.userId,projectId,target,outputName,outputPath,expiresAt]);const token=signDownload(buildId,req.userId,expiresAt);res.json({ok:true,buildId,filename:outputName,target,expiresAt:new Date(expiresAt).toISOString(),downloadPath:`/api/builds/${buildId}/download?token=${encodeURIComponent(token)}`});
 }catch(error){if(tempDir)await fs.rm(tempDir,{recursive:true,force:true}).catch(()=>{});const code=error?.code||'BUILD_FAILED';try{const projectId=String(req.body?.projectId||'');if(projectId)await pool.query("INSERT INTO builds(user_id,project_id,platform,filename,status,error_message) VALUES($1,$2,$3,$4,'failed',$5)",[req.userId,projectId,String(req.body?.target||'win32-x64'),'prism-app.exe',String(error?.message||code).slice(0,500)])}catch{}res.status(code==='BUILD_TIMEOUT'?504:422).json({error:error?.message||'Não foi possível criar o executável.',code})}
});

router.get('/:id/download',async(req,res)=>{try{const userId=verifyDownload(req.query?.token,req.params.id);if(!userId)return res.status(401).json({error:'Token de download inválido ou expirado.',code:'BUILD_DOWNLOAD_UNAUTHORIZED'});const row=await pool.query('SELECT filename,output_path,status,expires_at FROM builds WHERE id=$1 AND user_id=$2',[req.params.id,userId]);if(!row.rows.length)return res.status(404).json({error:'Build não encontrado.',code:'BUILD_NOT_FOUND'});if(row.rows[0].status!=='completed')return res.status(409).json({error:'Este build não foi concluído.',code:'BUILD_NOT_READY'});if(new Date(row.rows[0].expires_at).getTime()<=Date.now())return res.status(410).json({error:'O download expirou. Gere novamente.',code:'BUILD_EXPIRED'});const cached=buildCache.get(req.params.id);const filePath=cached?.filePath||row.rows[0].output_path;await fs.access(filePath);return res.download(filePath,row.rows[0].filename)}catch(error){return res.status(404).json({error:error?.message||'Arquivo não encontrado.',code:'BUILD_FILE_NOT_FOUND'})}});
export default router;
