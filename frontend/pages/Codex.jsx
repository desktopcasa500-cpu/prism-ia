import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { usePersistentCodex } from '../lib/usePersistentCodex.js';
import CodexSidebar from '../components/codex/CodexSidebar.jsx';
import McpContextBar from '../components/codex/McpContextBar.jsx';
import ParallelResponseGrid from '../components/codex/ParallelResponseGrid.jsx';
import './codex-next.css';

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic', model: 'claude-3-7-sonnet-latest', enabled: true },
  { id: 'openai', label: 'OpenAI', model: 'gpt-4.1', enabled: true },
  { id: 'gemini', label: 'Gemini', model: 'gemini-2.5-pro', enabled: true },
];
const EFFORTS = ['low', 'medium', 'high', 'max', 'ultracode'];

function asUiMessage(message) {
  let meta = {};
  try { meta = typeof message.metadata === 'string' ? JSON.parse(message.metadata) : (message.metadata || {}); } catch { meta = {}; }
  return {
    id: message.id,
    role: message.role,
    text: message.content,
    provider: message.provider,
    model: message.model_id,
    thinking: message.thinking_summary,
    tools: meta.tools_used || [],
  };
}

export default function Codex() {
  const { preferences, updatePreference, cacheSession, cachedSession } = usePersistentCodex();
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [runs, setRuns] = useState({});
  const [running, setRunning] = useState(false);
  const [query, setQuery] = useState('');
  const [effort, setEffort] = useState(preferences.effort || 'high');
  const [models, setModels] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('prism_codex_providers') || 'null');
      return Array.isArray(saved) && saved.length ? saved : PROVIDERS;
    } catch { return PROVIDERS; }
  });
  const [mcpServers, setMcpServers] = useState([]);
  const [mcpActive, setMcpActive] = useState([]);
  const [error, setError] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => { localStorage.setItem('prism_codex_providers', JSON.stringify(models)); }, [models]);
  useEffect(() => { updatePreference('effort', effort); }, [effort, updatePreference]);

  const loadSessions = useCallback(async () => {
    const result = await api.get('/chat/sessions');
    setSessions(result.sessions || []);
    if (!sessionId && result.sessions?.[0]) setSessionId(result.sessions[0].id);
  }, [sessionId]);

  const loadSession = useCallback(async (id) => {
    setSessionId(id); setError(''); setRuns({});
    const cached = await cachedSession(id).catch(() => null);
    if (cached?.length) setMessages(cached);
    try {
      const result = await api.get(`/chat/sessions/${encodeURIComponent(id)}/messages`);
      const next = (result.messages || []).map(asUiMessage);
      setMessages(next);
      cacheSession(id, next).catch(() => {});
    } catch (cause) {
      if (!cached?.length) setError(cause.message || 'Não foi possível carregar a sessão.');
    }
  }, [cacheSession, cachedSession]);

  useEffect(() => { loadSessions().catch((cause) => setError(cause.message || 'Não foi possível carregar o Codex.')); }, [loadSessions]);
  useEffect(() => { if (sessionId) loadSession(sessionId).catch(() => {}); }, [sessionId, loadSession]);

  const loadMcp = useCallback(async () => {
    try {
      const result = await api.get('/mcp');
      const servers = result.servers || [];
      setMcpServers(servers);
      const saved = Array.isArray(preferences.mcpServerIds) ? preferences.mcpServerIds : servers.map((server) => server.id);
      setMcpActive(saved.filter((id) => servers.some((server) => server.id === id)));
    } catch { setMcpServers([]); setMcpActive([]); }
  }, [preferences.mcpServerIds]);
  useEffect(() => { loadMcp(); }, [loadMcp]);

  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen((open) => !open); }
      if (event.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const context = useMemo(() => messages.slice(-16).map((item) => `${item.role}${item.provider ? ` [${item.provider}]` : ''}: ${item.text}`).join('\n'), [messages]);

  async function newSession() {
    if (running) return;
    const result = await api.post('/chat/sessions', { title: 'Nova conversa' });
    setSessions((current) => [result.session, ...current]);
    setSessionId(result.session.id); setMessages([]); setRuns({}); setPrompt(''); setPaletteOpen(false);
  }

  async function renameSession(session) {
    const title = window.prompt('Novo nome da conversa', session.title || 'Nova conversa');
    if (!title?.trim()) return;
    const result = await api.patch(`/chat/sessions/${encodeURIComponent(session.id)}`, { title });
    setSessions((current) => current.map((item) => item.id === session.id ? result.session : item));
  }

  async function deleteSession(session) {
    if (!window.confirm(`Excluir “${session.title || 'Nova conversa'}”?`)) return;
    await api.delete(`/chat/sessions/${encodeURIComponent(session.id)}`);
    const next = sessions.filter((item) => item.id !== session.id);
    setSessions(next);
    if (session.id === sessionId) {
      setSessionId(next[0]?.id || null);
      setMessages([]);
      setRuns({});
    }
  }

  function toggleProvider(id) { setModels((current) => current.map((item) => item.id === id ? { ...item, enabled: item.enabled === false } : item)); }
  function toggleMcp(id) {
    setMcpActive((current) => {
      const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
      updatePreference('mcpServerIds', next);
      return next;
    });
  }

  async function send() {
    const value = prompt.trim();
    if (!value || running) return;
    setError('');
    let sid = sessionId;
    if (!sid) {
      const created = await api.post('/chat/sessions', { title: value.slice(0, 64) });
      sid = created.session.id;
      setSessionId(sid); setSessions((current) => [created.session, ...current]);
    }
    const userMessage = { id: `local-${Date.now()}`, role: 'user', text: value };
    setMessages((current) => [...current, userMessage]);
    setPrompt(''); setRunning(true);
    setRuns(Object.fromEntries(models.filter((item) => item.enabled !== false).map((item) => [item.id, {
      provider: item.id, label: item.label, model: item.model, status: 'running', text: '', thinking_summary: '', elapsed_ms: 0,
    }])));
    try {
      const selectedModels = models.filter((model) => model.enabled !== false).map(({ id, model }) => ({ provider: id, model }));
      if (!selectedModels.length) throw new Error('Ative pelo menos um provedor.');
      const result = await api.post('/chat/parallel', { sessionId: sid, content: value, effort, context, models: selectedModels, mcpServerIds: mcpActive }, { timeout: 180000 });
      const nextRuns = Object.fromEntries((result.results || []).map((item) => [item.provider, item]));
      setRuns(nextRuns);
      const persisted = (result.saved || []).map(asUiMessage);
      setMessages((current) => [...current, ...persisted]);
      cacheSession(sid, [...messages, userMessage, ...persisted]).catch(() => {});
      await loadSessions();
    } catch (cause) {
      setError(cause.message || 'A execução falhou.');
    } finally { setRunning(false); }
  }

  function onComposerKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); }
  }

  return <div className="cx-root">
    <CodexSidebar sessions={sessions} activeId={sessionId} query={query} onQuery={setQuery} onNew={newSession} onOpen={loadSession} onRename={renameSession} onDelete={deleteSession}/>
    <main className="cx-main">
      <header className="cx-topbar">
        <div><span className="cx-kicker">PRISM / CODEX</span><h1>WORKSPACE PARALELO</h1></div>
        <div className="cx-top-actions"><button onClick={() => setEffort(EFFORTS[(EFFORTS.indexOf(effort) + 1) % EFFORTS.length])}>THINKING · {effort.toUpperCase()}</button><button onClick={() => setPaletteOpen(true)}>⌘ K</button></div>
      </header>
      <McpContextBar servers={mcpServers} activeIds={mcpActive} onToggle={toggleMcp}/>
      <section className="cx-provider-strip"><span>MODELOS</span>{models.map((model) => <button className={model.enabled !== false ? 'active' : ''} key={model.id} onClick={() => toggleProvider(model.id)} aria-pressed={model.enabled !== false}>{model.label}<small>{model.model}</small></button>)}</section>
      <section className="cx-workbench">
        {!Object.keys(runs).length ? <div className="cx-blank"><span className="cx-serial">03 PROVIDERS · 01 PROMPT · 01 CONTEXT</span><h2>Uma entrada.<br/>Três leituras.</h2><p>Compare respostas em paralelo, altere o contexto MCP em tempo de execução e mantenha cada sessão isolada.</p></div> : <ParallelResponseGrid models={models} runs={runs}/>} 
      </section>
      {messages.length > 0 && <section className="cx-timeline"><span className="cx-timeline-label">HISTÓRICO DA SESSÃO</span>{messages.slice(-8).map((message) => <article key={message.id} className={message.role === 'user' ? 'user' : 'assistant'}><small>{message.role === 'user' ? 'VOCÊ' : (message.provider || 'PRISM').toUpperCase()}</small><p>{message.text}</p>{message.thinking && <details><summary>Thinking summary</summary><span>{message.thinking}</span></details>}</article>)}</section>}
      {error && <div className="cx-global-error"><strong>ERRO</strong><span>{error}</span></div>}
      <footer className="cx-composer-zone"><div className="cx-composer"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={onComposerKeyDown} placeholder="Descreva o problema, a decisão ou o código…" rows={4} disabled={running}/><div className="cx-composer-foot"><span>ENTER envia · SHIFT+ENTER quebra</span><button onClick={send} disabled={running || !prompt.trim()}>{running ? 'EXECUTANDO…' : 'ENVIAR ↗'}</button></div></div><small>O painel exibe resumos de processo, não a cadeia de pensamento interna.</small></footer>
    </main>
    {paletteOpen && <div className="cx-palette-backdrop" onMouseDown={() => setPaletteOpen(false)}><div className="cx-palette" onMouseDown={(event) => event.stopPropagation()}><div className="cx-palette-head"><strong>COMMAND / SEARCH</strong><kbd>ESC</kbd></div><input autoFocus placeholder="Digite uma ação…" onKeyDown={(event) => { if (event.key === 'Enter') newSession(); }}/><button onClick={newSession}>+ Nova conversa</button><button onClick={() => { setQuery(''); setPaletteOpen(false); }}>Limpar busca</button></div></div>}
  </div>;
}
