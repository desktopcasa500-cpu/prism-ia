import { createAgentWorkspace, runWorkspaceCommand, verifyWorkspace, buildWorkspace, agentToolDefinitions } from './agentRuntime-v3.js';
import { syncWorkspaceToProject } from './workspaceSync.js';

export { createAgentWorkspace, runWorkspaceCommand, verifyWorkspace, buildWorkspace, agentToolDefinitions };

export async function executeAgentTool(tool, args, workspace) {
  if (!workspace) throw Object.assign(new Error('Nenhum workspace de projeto está selecionado.'), { code: 'WORKSPACE_REQUIRED' });
  let result;
  switch (tool) {
    case 'prism_read_file':
      result = await readWorkspaceFile(workspace, args?.path);
      break;
    case 'prism_write_file':
      result = await writeWorkspaceFile(workspace, args?.path, args?.content);
      break;
    case 'prism_list_files':
      result = workspace.files.map((file) => ({ path: file.path, bytes: Buffer.byteLength(String(file.content || ''), 'utf8') }));
      break;
    case 'prism_verify':
      result = await verifyWorkspace({ workspace, command: args?.command });
      await syncWorkspaceToProject(workspace);
      break;
    case 'prism_exec':
      result = await runWorkspaceCommand({ workspace, command: args?.command, cwd: args?.cwd || '.', timeoutMs: args?.timeoutMs });
      await syncWorkspaceToProject(workspace);
      break;
    case 'prism_build':
      await syncWorkspaceToProject(workspace);
      result = await buildWorkspace({ workspace, target: String(args?.target || '') });
      await syncWorkspaceToProject(workspace).catch(() => {});
      break;
    default:
      throw Object.assign(new Error(`Ferramenta do runtime não encontrada: ${tool}`), { code: 'AGENT_TOOL_NOT_FOUND' });
  }
  return result;
}

async function readWorkspaceFile(workspace, filePath) {
  const path = String(filePath || '').trim();
  const found = workspace.files.find((file) => file.path === path);
  if (found) return { path, content: String(found.content || '') };
  throw Object.assign(new Error('Arquivo não encontrado.'), { code: 'FILE_NOT_FOUND', status: 404 });
}

async function writeWorkspaceFile(workspace, filePath, content) {
  const relative = String(filePath || '').replace(/^[/\\]+/, '');
  if (!relative || relative.includes('..')) throw Object.assign(new Error('Caminho de arquivo inválido.'), { code: 'INVALID_PROJECT_PATH' });
  const value = String(content || '');
  const target = `${workspace.root}/${relative}`.replace(/\\/g, '/');
  const { promises: fs } = await import('node:fs');
  const { default: path } = await import('node:path');
  const resolved = path.resolve(target);
  if (!resolved.startsWith(path.resolve(workspace.root) + path.sep)) throw Object.assign(new Error('Caminho fora do workspace.'), { code: 'INVALID_PROJECT_PATH' });
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, value, 'utf8');
  const result = await syncWorkspaceToProject(workspace);
  return { path: relative, bytes: Buffer.byteLength(value, 'utf8'), sync: result };
}
