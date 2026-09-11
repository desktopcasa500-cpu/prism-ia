import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const PKG_BIN = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'pkg.cmd' : 'pkg');
const MAX_FILE_BYTES = 2_000_000;
const MAX_FILES = 500;

function safeName(value, fallback = 'prism-app') {
  return String(value || fallback).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || fallback;
}

function run(command, args, cwd, timeoutMs = 240_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (fn, value) => { if (settled) return; settled = true; clearTimeout(timer); fn(value); };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      const error = new Error('A compilação excedeu o tempo máximo.');
      error.code = 'BUILD_TIMEOUT';
      finish(reject, error);
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => finish(reject, error));
    child.on('close', (code) => {
      if (code === 0) return finish(resolve, { stdout, stderr });
      const error = new Error(String(stderr || stdout || `Processo terminou com código ${code}`).slice(-4000));
      error.code = 'BUILD_FAILED';
      error.exitCode = code;
      finish(reject, error);
    });
  });
}

async function writeProject(root, files) {
  if (!Array.isArray(files) || !files.length) throw Object.assign(new Error('O projeto não possui arquivos.'), { code: 'NO_PROJECT_FILES' });
  if (files.length > MAX_FILES) throw Object.assign(new Error('O projeto excede o limite de arquivos para compilação.'), { code: 'TOO_MANY_PROJECT_FILES' });
  for (const file of files) {
    const relative = String(file.path || '').replace(/^[/\\]+/, '');
    if (!relative || relative.includes('..')) throw Object.assign(new Error('Caminho de arquivo inválido.'), { code: 'INVALID_PROJECT_PATH' });
    const content = String(file.content || '');
    if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) throw Object.assign(new Error(`O arquivo ${relative} é grande demais para compilação.`), { code: 'PROJECT_FILE_TOO_LARGE' });
    const target = path.join(root, relative);
    if (!target.startsWith(root + path.sep)) throw Object.assign(new Error('Caminho de arquivo inválido.'), { code: 'INVALID_PROJECT_PATH' });
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf8');
  }
}

function javaMainClass(files) {
  for (const file of files.filter((entry) => /\.java$/i.test(entry.path))) {
    const source = String(file.content || '');
    if (!/public\s+static\s+void\s+main\s*\(/.test(source)) continue;
    const packageMatch = source.match(/\bpackage\s+([a-zA-Z_][\w.]*)\s*;/);
    const classMatch = source.match(/\bpublic\s+(?:final\s+|abstract\s+)?class\s+([A-Za-z_][\w]*)/);
    if (!classMatch) continue;
    return `${packageMatch ? `${packageMatch[1]}.` : ''}${classMatch[1]}`;
  }
  return null;
}

async function buildJar(root, files, outputPath) {
  const javaFiles = files.filter((file) => /\.java$/i.test(file.path));
  if (!javaFiles.length) throw Object.assign(new Error('Para criar um JAR, o projeto precisa conter arquivos .java.'), { code: 'JAVA_SOURCE_REQUIRED' });

  const javac = process.env.JAVAC_PATH || 'javac';
  const jar = process.env.JAR_PATH || 'jar';
  const classesDir = path.join(root, '.prism-classes');
  await fs.mkdir(classesDir, { recursive: true });
  await run(javac, ['-d', classesDir, ...javaFiles.map((file) => file.path)], root, 240_000);

  const mainClass = javaMainClass(javaFiles);
  const manifest = mainClass ? `Manifest-Version: 1.0\nMain-Class: ${mainClass}\n\n` : 'Manifest-Version: 1.0\n\n';
  const manifestPath = path.join(root, '.prism-manifest.mf');
  await fs.writeFile(manifestPath, manifest, 'utf8');
  await run(jar, ['--create', '--file', outputPath, '--manifest', manifestPath, '-C', classesDir, '.'], root, 120_000);
  const stat = await fs.stat(outputPath);
  if (!stat.size) throw Object.assign(new Error('O JAR foi produzido vazio.'), { code: 'EMPTY_BUILD' });
  return { outputPath, mainClass, size: stat.size };
}

function browserLauncher() {
  return `const http=require('node:http');\nconst fs=require('node:fs');\nconst path=require('node:path');\nconst root=path.join(__dirname,'project');\nconst mime={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'text/javascript;charset=utf-8','.json':'application/json;charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'};\nconst server=http.createServer((req,res)=>{let requestPath=decodeURIComponent((req.url||'/').split('?')[0]);if(requestPath==='/'||requestPath==='')requestPath='/index.html';const filePath=path.normalize(path.join(root,requestPath.replace(/^[/\\\\]+/,'')));if(!filePath.startsWith(root))return res.writeHead(403).end('Forbidden');fs.readFile(filePath,(error,data)=>{if(error)return res.writeHead(404).end('Not found');res.writeHead(200,{'Content-Type':mime[path.extname(filePath).toLowerCase()]||'application/octet-stream'});res.end(data);});});server.listen(4173,'127.0.0.1',()=>{const {exec}=require('node:child_process');exec('start http://127.0.0.1:4173');});\n`;
}

async function buildExe(root, files, outputPath, projectName) {
  if (!PKG_BIN) throw Object.assign(new Error('O empacotador do Windows não está disponível neste ambiente.'), { code: 'PKG_NOT_AVAILABLE' });
  const packageFile = files.find((file) => file.path.toLowerCase() === 'package.json');
  let pkg = {};
  if (packageFile) { try { pkg = JSON.parse(packageFile.content || '{}'); } catch {} }
  const html = files.find((file) => /^index\.html$/i.test(path.basename(file.path))) || files.find((file) => /\.html?$/i.test(file.path));
  const nodeEntry = pkg.main && files.find((file) => file.path === String(pkg.main).replace(/^[/\\]+/, ''))
    ? String(pkg.main).replace(/^[/\\]+/, '')
    : files.find((file) => /^index\.(js|cjs|mjs)$/i.test(path.basename(file.path)))?.path;

  if (!html && !nodeEntry) throw Object.assign(new Error('Para criar um .exe, o projeto precisa de index.html, index.js/cjs/mjs ou package.json com main.'), { code: 'BUILD_ENTRYPOINT_REQUIRED' });

  const packageRoot = path.join(root, 'project');
  await fs.mkdir(packageRoot, { recursive: true });
  await writeProject(packageRoot, files);
  let entry = nodeEntry;
  let packageJson = { name: safeName(projectName), version: '1.0.0', main: entry || 'launcher.js', bin: entry || 'launcher.js' };
  if (html) {
    await fs.writeFile(path.join(root, 'launcher.js'), browserLauncher(), 'utf8');
    packageJson = {
      name: safeName(projectName), version: '1.0.0', type: 'commonjs', main: 'launcher.js', bin: 'launcher.js',
      pkg: { assets: ['project/**/*'] },
    };
    entry = 'launcher.js';
  }
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf8');
  const args = ['.', '--targets', 'node22-win-x64', '--output', outputPath];
  await run(PKG_BIN, args, root, 300_000);
  const stat = await fs.stat(outputPath);
  if (!stat.size) throw Object.assign(new Error('O executável foi produzido vazio.'), { code: 'EMPTY_BUILD' });
  return { outputPath, size: stat.size, entry };
}

export async function buildProject({ projectName, files, target }) {
  const buildId = crypto.randomUUID();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `prism-build-${buildId}-`));
  try {
    await writeProject(tempDir, files);
    const extension = target === 'jar' ? 'jar' : 'exe';
    const outputName = `${safeName(projectName)}.${extension}`;
    const outputPath = path.join(tempDir, outputName);
    const result = target === 'jar'
      ? await buildJar(tempDir, files, outputPath)
      : await buildExe(tempDir, files, outputPath, projectName);
    return { buildId, tempDir, outputPath, filename: outputName, size: result.size, details: result };
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
