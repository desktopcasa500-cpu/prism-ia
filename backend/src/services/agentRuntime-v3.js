import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { pool } from '../db/pool.js';
import { buildProject } from './buildService.js';
import { zipWorkspace } from './artifactService.js';

const MAX_FILES = 500;
const MAX_FILE_BYTES = 2_000_000;
const MAX_OUTPUT = 24_000;
const DEFAULT_TIMEOUT = 120_000;
const MAX_TIMEOUT = 300_000;
const DOWNLOAD_TTL = 60 * 60 * 1000;
const downloadSecret = String(process.env.PRISM_BUILD_DOWNLOAD_SECRET || process.env.JWT_SECRET || 'change-this-build-secret');
const SAFE_EXECUTABLES = new Set(['node','nodejs','npm','npx','pnpm','yarn','bun','java','javac','jar','mvn','gradle','gradlew','python','python3','pip','pip3','ruby','go','rustc','cargo','tsc','eslint','prettier','git','zip','unzip']);
const BLOCKED = [/rm\s+-rf/i,/rmdir\b/i,/del\s+\/s\b/i,/format\b/i,/mkfs\b/i,/shutdown\b/i,/reboot\b/i,/diskpart\b/i,/chmod\s+777\b/i,/curl\s+[^\s]+\s*\|\s*(sh|bash)\b/i,/wget\s+[^\s]+\s*\|\s*(sh|bash)\b/i];

function safeName(value,fallback='prism-project'){return String(value||fallback).replace(/[^a-z0-9._-]+/gi,'-').replace(/^-+|-+$/g,'')||fallback;}
function cleanPath(value){const relative=String(value||'').replace(/^[/\\]+/,'');if(!relative||relative.includes('..')||path.isAbsolute(relative))throw Object.assign(new Error('Caminho de arquivo inválido.'),{code:'INVALID_PROJECT_PATH'});return relative;}
function executableOf(command){const first=String(command||'').trim().match(/^["']?([^\s"']+)["']?/);return first?.[1]?.split(/[\\/]/).pop()?.toLowerCase()||'';}
function validateCommand(command){const value=String(command||'').trim();if(!value)throw Object.assign(new Error('Comando vazio.'),{code:'COMMAND_REQUIRED'});if(value.length>2000)throw Object.assign(new Error('Comando muito longo.'),{code:'COMMAND_TOO_LONG'});if(BLOCKED.some((pattern)=>pattern.test(value)))throw Object.assign(new Error('Comando bloqueado pela política de segurança.'),{code:'COMMAND_BLOCKED'});if(process.env.PRISM_ALLOW_SHELL_COMMANDS==='true')return value;const executable=executableOf(value);if(!SAFE_EXECUTABLES.has(executable))throw Object.assign(new Error(`Executável não permitido: ${executable||'desconhecido'}.`),{code:'COMMAND_NOT_ALLOWED'});if(/[;&|`<>]/.test(value))throw Object.assign(new Error('Operadores de shell estão desabilitados neste modo seguro.'),{code:'SHELL_OPERATOR_BLOCKED'});return value;}
function splitCommand(command){const parts=[];let token='';let quote='';for(const char of String(command)){if(quote){if(char===quote)quote='';else token+=char;continue;}if(char==='"'||char==="'"){quote=char;continue;}if(/\s/.test(char)){if(token){parts.push(token);token='';}}else token+=char;}if(quote)throw Object.assign(new Error('Aspas não fechadas no comando.'),{code:'COMMAND_PARSE_ERROR'});if(token)parts.push(token);return parts;}
function signDownload(buildId,userId,expiresAt){const payload=`${buildId}.${userId}.${expiresAt}`;const sig=crypto.createHmac('sha256',downloadSecret).update(payload).digest('hex');return Buffer.from(`${payload}.${sig}`).toString('base64url');}

async function loadProject(projectId,userId){
  const project=await pool.query('SELECT id,name FROM projects WHERE id=$1 AND user_id=$2',[projectId,userId]);
  if(!project.rows.length)throw Object.assign(new Error('Projeto não encontrado.'),{code:'PROJECT_NOT_FOUND',status:404});
  const files=await pool.query("SELECT path,content,kind FROM project_files WHERE project_id=$1 AND user_id=$2 AND kind='file' ORDER BY path",[projectId,userId]);
  return {project:project.rows[0],files:files.rows};
}

async function writeFiles(root,files){
  if(!Array.isArray(files))throw Object.assign(new Error('Arquivos inválidos.'),{code:'FILES_INVALID'});
  if(files.length>MAX_FILES)throw Object.assign(new Error('O projeto excede o limite de arquivos.'),{code:'TOO_MANY_PROJECT_FILES'});
  for(const file of files){const relative=cleanPath(file.path);const content=String(file.content||'');if(Buffer.byteLength(content,'utf8')>MAX_FILE_BYTES)throw Object.assign(new Error(`O arquivo ${relative} é grande demais.`),{code:'PROJECT_FILE_TOO_LARGE'});const target=path.join(root,relative);if(!target.startsWith(root+path.sep))throw Object.assign(new Error('Caminho fora do workspace.'),{code:'INVALID_PROJECT_PATH'});await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,content,'utf8');}
}

async function upsertProjectFile(workspace, filePath, content){
  const relative=cleanPath(filePath);const value=String(content||'');if(Buffer.byteLength(value,'utf8')>MAX_FILE_BYTES)throw Object.assign(new Error('Arquivo grande demais.'),{code:'PROJECT_FILE_TOO_LARGE'});
  const target=path.join(workspace.root,relative);if(!target.startsWith(workspace.root+path.sep))throw Object.assign(new Error('Caminho fora do workspace.'),{code:'INVALID_PROJECT_PATH'});
  await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,value,'utf8');
  await pool.query(`INSERT INTO project_files(project_id,user_id,path,content,kind,updated_at) VALUES($1,$2,$3,$4,'file',now()) ON CONFLICT(project_id,path) DO UPDATE SET content=EXCLUDED.content,kind='file',updated_at=now()`,[workspace.projectId,workspace.userId,relative,value]);
  workspace.files = [...workspace.files.filter((file)=>file.path!==relative),{path:relative,content:value,kind:'file'}].sort((a,b)=>a.path.localeCompare(b.path));
  return {path:relative,bytes:Buffer.byteLength(value,'utf8')};
}

async function readProjectFile(workspace,filePath){
  const relative=cleanPath(filePath);const found=workspace.files.find((file)=>file.path===relative);if(found)return {path:relative,content:String(found.content||'')};
  const row=await pool.query('SELECT path,content FROM project_files WHERE project_id=$1 AND user_id=$2 AND path=$3',[workspace.projectId,workspace.userId,relative]);if(!row.rows.length)throw Object.assign(new Error('Arquivo não encontrado.'),{code:'FILE_NOT_FOUND',status:404});return row.rows[0];
}

async function listProjectFiles(workspace){return workspace.files.map((file)=>({path:file.path,bytes:Buffer.byteLength(String(file.content||''),'utf8'),kind:file.kind||'file'}));}

export async function createAgentWorkspace({projectId,userId}={}){if(!projectId||!userId)return null;const loaded=await loadProject(projectId,userId);const root=await fs.mkdtemp(path.join(os.tmpdir(),`prism-agent-${crypto.randomUUID()}-`));await writeFiles(root,loaded.files);return{root,projectId,userId,project:loaded.project,files:loaded.files,readFile:(filePath)=>readProjectFile({root,projectId,userId,files:loaded.files},filePath),async cleanup(){await fs.rm(root,{recursive:true,force:true}).catch(()=>{});}};}

export async function runWorkspaceCommand({workspace,command,cwd='.',timeoutMs=DEFAULT_TIMEOUT,onOutput}={}){
  if(!workspace?.root)throw Object.assign(new Error('Nenhum workspace de projeto está selecionado.'),{code:'WORKSPACE_REQUIRED'});
  const safeCommand=validateCommand(command);const parts=splitCommand(safeCommand);const executable=parts.shift();const requestedCwd=cleanPath(cwd||'.');const workDir=path.resolve(workspace.root,requestedCwd);if(!workDir.startsWith(workspace.root))throw Object.assign(new Error('Diretório fora do workspace.'),{code:'INVALID_WORKSPACE_CWD'});await fs.access(workDir);const limit=Math.min(Math.max(Number(timeoutMs)||DEFAULT_TIMEOUT,5000),MAX_TIMEOUT);
  return new Promise((resolve,reject)=>{const child=spawn(executable,parts,{cwd:workDir,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});let stdout='';let stderr='';let settled=false;const emit=(stream,chunk)=>{const text=String(chunk||'');if(stream==='stdout')stdout=`${stdout}${text}`.slice(-MAX_OUTPUT);else stderr=`${stderr}${text}`.slice(-MAX_OUTPUT);onOutput?.({stream,text:text.slice(-4000)});};const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);fn(value);};const timer=setTimeout(()=>{child.kill('SIGKILL');finish(reject,Object.assign(new Error('O comando excedeu o tempo máximo.'),{code:'COMMAND_TIMEOUT'}));},limit);child.stdout.on('data',(chunk)=>emit('stdout',chunk));child.stderr.on('data',(chunk)=>emit('stderr',chunk));child.on('error',(error)=>finish(reject,error));child.on('close',(code,signal)=>{if(code!==0)return finish(reject,Object.assign(new Error(String(stderr||stdout||`Processo finalizado com código ${code}`).slice(-MAX_OUTPUT)),{code:'COMMAND_FAILED',exitCode:code,signal}));finish(resolve,{ok:true,command:safeCommand,cwd:requestedCwd,exitCode:0,stdout,stderr});});});
}

async function verifyJava(workspace){const javaFiles=workspace.files.filter((file)=>/\.java$/i.test(file.path));if(!javaFiles.length)return null;const result=await runWorkspaceCommand({workspace,command:`javac -d .prism-classes ${javaFiles.map((file)=>`"${file.path}"`).join(' ')}`,timeoutMs:240000});return{kind:'java',ok:true,files:javaFiles.length,output:result};}
async function verifyJs(workspace){const jsFiles=workspace.files.filter((file)=>/\.(?:js|mjs|cjs)$/i.test(file.path));if(!jsFiles.length)return null;for(const file of jsFiles)await runWorkspaceCommand({workspace,command:`node --check "${file.path}"`,timeoutMs:60000});return{kind:'javascript',ok:true,files:jsFiles.length};}

export async function verifyWorkspace({workspace,command}={}){
  if(command)return runWorkspaceCommand({workspace,command,timeoutMs:180000});
  const checks=[];const js=await verifyJs(workspace);if(js)checks.push(js);const java=await verifyJava(workspace);if(java)checks.push(java);return{ok:checks.every((check)=>check.ok),checks};
}

export async function buildWorkspace({workspace,target}){
  if(!workspace?.files?.length)throw Object.assign(new Error('Nenhum arquivo disponível para build.'),{code:'WORKSPACE_REQUIRED'});const allowed=new Set(['jar','win32-x64','zip','js']);if(!allowed.has(target))throw Object.assign(new Error('Destino de build não suportado.'),{code:'TARGET_UNSUPPORTED'});
  if(target==='js')return{ok:true,type:'verification',target,details:await verifyWorkspace({workspace})};
  if(target==='zip')return zipWorkspace(workspace);
  const build=await buildProject({projectName:workspace.project.name,files:workspace.files,target});const expiresAt=Date.now()+DOWNLOAD_TTL;await pool.query("INSERT INTO builds(id,user_id,project_id,platform,filename,status,output_path,expires_at) VALUES($1,$2,$3,$4,$5,'completed',$6,to_timestamp($7/1000.0))",[build.buildId,workspace.userId,workspace.projectId,target,build.filename,build.outputPath,expiresAt]);return{ok:true,type:'build',buildId:build.buildId,filename:build.filename,size:build.size,expiresAt:new Date(expiresAt).toISOString(),downloadPath:`/api/builds/${build.buildId}/download?token=${encodeURIComponent(signDownload(build.buildId,workspace.userId,expiresAt))}`,details:build.details};
}

export function agentToolDefinitions(){return[
  {modelName:'prism_exec',serverId:'prism-agent',serverName:'Prism Agent Runtime',toolName:'execute_command',kind:'native',description:'Executa um comando de desenvolvimento dentro do workspace atual, com política de segurança e limite de tempo.',inputSchema:{type:'object',properties:{command:{type:'string'},cwd:{type:'string'},timeoutMs:{type:'integer'}},required:['command']}},
  {modelName:'prism_read_file',serverId:'prism-agent',serverName:'Prism Agent Runtime',toolName:'read_file',kind:'native',description:'Lê um arquivo do projeto atual.',inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path']}},
  {modelName:'prism_write_file',serverId:'prism-agent',serverName:'Prism Agent Runtime',toolName:'write_file',kind:'native',description:'Cria ou substitui um arquivo do projeto e persiste a alteração no workspace.',inputSchema:{type:'object',properties:{path:{type:'string'},content:{type:'string'}},required:['path','content']}},
  {modelName:'prism_list_files',serverId:'prism-agent',serverName:'Prism Agent Runtime',toolName:'list_files',kind:'native',description:'Lista os arquivos do projeto atual.',inputSchema:{type:'object',properties:{}}},
  {modelName:'prism_build',serverId:'prism-agent',serverName:'Prism Agent Runtime',toolName:'build_project',kind:'native',description:'Compila, valida ou empacota o projeto. Suporta Java/JAR, JavaScript, Windows EXE e ZIP.',inputSchema:{type:'object',properties:{target:{type:'string',enum:['jar','js','win32-x64','zip']}},required:['target']}},
  {modelName:'prism_verify',serverId:'prism-agent',serverName:'Prism Agent Runtime',toolName:'verify_project',kind:'native',description:'Executa verificações apropriadas ao projeto, como node --check, javac, testes ou lint.',inputSchema:{type:'object',properties:{command:{type:'string'}}}},
];}

export async function executeAgentTool(tool,args,workspace){
  if(tool==='prism_read_file')return readProjectFile(workspace,args.path);
  if(tool==='prism_write_file')return upsertProjectFile(workspace,args.path,args.content);
  if(tool==='prism_list_files')return listProjectFiles(workspace);
  if(tool==='prism_verify')return verifyWorkspace({workspace,command:args.command});
  if(tool==='prism_exec')return runWorkspaceCommand({workspace,command:args.command,cwd:args.cwd||'.',timeoutMs:args.timeoutMs});
  if(tool==='prism_build')return buildWorkspace({workspace,target:String(args.target||'')});
  throw Object.assign(new Error('Ferramenta do runtime não encontrada.'),{code:'AGENT_TOOL_NOT_FOUND'});
}
