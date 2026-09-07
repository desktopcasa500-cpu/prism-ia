import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { usePersistentCodex } from '../lib/usePersistentCodex.js';
import PrismCodexIntro, { INTRO_KEY } from '../components/PrismCodexIntro.jsx';
import CodexSidebar from '../components/codex/CodexSidebar.jsx';
import McpContextBar from '../components/codex/McpContextBar.jsx';
import CodeArtifactsPanel from '../components/CodeArtifactsPanel.jsx';
import MarkdownMessage from '../components/MarkdownMessage.jsx';
import PlanPanel from '../components/PlanPanel.jsx';
import TaffPresentation from '../components/TaffPresentation.jsx';
import '../components/codex-stable-taff.css';

const MODELS = [
  ['prism-nano-1.0', 'Prism Nano 1.0A'],
  ['prism-mini-1.0', 'Prism Mini 1.0A'],
  ['prism-edge-1.0', 'Prism Edge 1.0A'],
  ['prism-tex-1.5', 'Prism Tex 1.5B'],
  ['prism-taff-1.0', 'Prism Taff 1.0A'],
  ['prism-taff-2.0', 'Prism Taff 2.0'],
];
const EFFORTS = ['low', 'medium', 'high', 'max', 'ultracode'];
const PLAN_RANK = { Grátis: 0, free: 0, Base: 1, base: 1, Medium: 2, medium: 2, Pro: 3, pro: 3, Empresarial: 4, enterprise: 4 };
const MODEL_RANK = { 'prism-nano-1.0': 0, 'prism-mini-1.0': 0, 'prism-edge-1.0': 2, 'prism-tex-1.5': 2, 'prism-taff-1.0': 3, 'prism-taff-2.0': 3 };
const PHASES = [['received', 'Pedido recebido'], ['analyzing', 'Analisando'], ['planning', 'Planejando'], ['writing', 'Escrevendo arquivos'], ['reviewing', 'Revisando'], ['updating', 'Atualizando workspace'], ['completed', 'Concluído']];
const STARTER = [
  { path: 'src/App.jsx', kind: 'file', content: 'export default function App() {\n  return <main>Comece a construir.</main>;\n}\n' },
  { path: 'src/index.css', kind: 'file', content: '' },
  { path: 'package.json', kind: 'file', content: '{"name":"prism-project"}\n' },
];

function normalizeMessage(message) {
  let metadata = {};
  try { metadata = typeof message?.metadata === 'string' ? JSON.parse(message.metadata) : (message?.metadata || {}); } catch {}
  return { id: message?.id, role: message?.role, text: message?.content || '', model: message?.model_id || '', tools: Array.isArray(metadata.tools_used) ? metadata.tools_used : [] };
}

function extensionOf(path) { return String(path || '').split('.').pop()?.toLowerCase() || 'txt'; }
function fileArtifact(file) {
  const extension = extensionOf(file.path);