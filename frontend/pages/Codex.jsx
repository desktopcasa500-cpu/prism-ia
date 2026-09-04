import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { usePersistentCodex } from '../lib/usePersistentCodex.js';
import PrismCodexIntro, { INTRO_KEY } from '../components/PrismCodexIntro.jsx';
import CodexSidebar from '../components/codex/CodexSidebar.jsx';
import McpContextBar from '../components/codex/McpContextBar.jsx';
import ParallelResponseGrid from '../components/codex/ParallelResponseGrid.jsx';
import './prism-codex-final.css';

const PROVIDERS = [
  { id: 'anthropic', label: 'Claude', model: 'claude-fable-5-1', enabled: true },
  { id: 'openai', label: 'OpenAI', model: 'gpt-4.1', enabled: true },
  { id: 'gemini', label: 'Gemini', model: 'gemini-3.8-flash', enabled: true },
];
const EFFORTS = ['low', 'medium', 'high', 'max', 'ultracode'];

function mapMessage(message) {
  let metadata = {};
  try { metadata = typeof message.metadata === 'string' ? JSON.parse(message.metadata) : (message.metadata || {}); } catch {}
  return {
    id: message.id,
    role: message.role,
    text: message.content || '',
    provider: message.provider || '',
    model: message.model_id || '',
    thinking: message.thinking_summary || '',
    tools: Array.isArray(metadata.tools_used) ? metadata.tools_used : [],
  };
}

function readProviders() {
  try {
    const raw = JSON.parse(localStorage.getItem('prism_codex_providers') || 'null');
    if (!Array.isArray(raw)) return PROVIDERS;
    return PROVIDERS.map((base) => ({ ...base, ...(raw.find((item) => item.id === base.id) || {}) }));
  } catch { return PROVIDERS; }
}

export default function Codex() {
  const { preferences, updatePreference, cacheSession, cachedSession } = usePersistentCodex();
  const [showIntro, setShowIntro] = useState(() => localStorage.getItem(INTRO_KEY) !== '1');
  const [mode, setMode] = useState('chat');
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [runs, setRuns] = useState({});
  const [running, setRunning] = useState(false);
  const [query, setQuery] = useState('');
  const [effort, setEffort] = useState(preferences.effort || 'medium');
  const [providers, setProviders] = useState(readProviders);
  const [mcpServers, setMcpServers] = useState([]);
  const [mcpActive, setMcpActive] = useState([]);
  const [modelOpen, setModelOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => localStorage.setItem('prism_codex_providers', JSON.stringify(providers)), [providers]);
  useEffect(() => updatePreference('effort', effort), [effort, updatePreference]);

  const loadSessions = useCallback(async () => {
    const result = await api.get('/chat/sessions');
    const next = result.sessions || [];
    setSessions(next);
    if (!sessionId && next[0]) setSessionId(next[0].id);
  }, [sessionId]);

  const loadSession = useCallback(async (id) => {
    if (!id) return;
    setSessionId(id);
    setRuns({});
    setError('');
    const cached = await cachedSession(id).catch(() => null);
    if (cached) setMessages(cached);
    try {
      const result = await api.get(`/chat/sessions/${encodeURIComponent(id)}/messages`);
      const next = (result.messages || []).map(mapMessage);
      setMessages(next);
      cacheSession(id, next).catch(() => {});
    } catch (cause) {
      if (!cached) setError(cause.message || 'Não foi possível carregar a conversa.');
    }
  }, [cacheSession, cachedSession]);

  const loadMcp = useCallback(async () => {
    try {
      const result = await api.get('/mcp');
      const next = result.servers || [];
      setMcpServers(next);
      const saved = Array.isArray(preferences.mcpServerIds) ? preferences.mcpServerIds : next.map((server) => server.id);
      setMcpActive(saved.filter((id) => next.some((server) => server.id === id)));
    } catch {
      setMcpServers([]);
      setMcpActive([]);
    }
  }, [preferences.mcpServerIds]);

  useEffect(() => { loadSessions().catch((cause) => setError(cause.message || 'Não foi possível carregar as conversas.')); }, [loadSessions]);
  useEffect(() => { if (sessionId) loadSession(sessionId).catch(() => {}); }, [sessionId, loadSession]);
  useEffect(() => { loadMcp(); }, [loadMcp]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === 'Escape') {
        setCommandOpen(false);
        setModelOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const context = useMemo(
    () => messages.slice(-16).map((item) => `${item.role}: ${item.text}`).join('\n'),
    [messages],
  );

  async function newSession() {
    if (running) return;
    const result = await api.post('/chat/sessions', { title: 'Nova conversa' });
    setSessions((current) => [result.session, ...current]);
    setSessionId(result.session.id);
    setMessages([]);
    setRuns({});
    setMode('chat');
    setPrompt('');
    setCommandOpen(false);
  }

  async function renameSession(session) {
    const title = window.prompt('Nome da conversa', session.title || 'Nova conversa');
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

  function toggleProvider(id) {
    setProviders((current) => current.map((item) => item.id === id ? { ...item, enabled: item.enabled === false } : item));
  }

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
    const selected = providers.filter((item) => item.enabled !== false).map(({ id, model }) => ({ provider: id, model }));
    if (!selected.length) {
      setError('Ative pelo menos um modelo.');
      return;
    }

    setError('');
    let sid = sessionId;
    if (!sid) {
      const created = await api.post('/chat/sessions', { title: value.slice(0, 64) });
      sid = created.session.id;
      setSessionId(sid);
      setSessions((current) => [created.session, ...current]);
    }

    const userMessage = { id: `local-${Date.now()}`, role: 'user', text: value, tools: [] };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setPrompt('');
    setRunning(true);
    setRuns(Object.fromEntries(selected.map((item) => [item.provider, {
      provider: item.provider,
      model: item.model,
      status: 'running',
      text: '',
      thinking_summary: '',
      elapsed_ms: 0,
      tools_used: [],
    }])));

    try {
      const result = await api.post('/chat/parallel', {
        sessionId: sid,
        content: value,
        context,
        effort,
        models: selected,
        mcpServerIds: mcpActive,
      }, { timeout: 180000 });

      setRuns(Object.fromEntries((result.results || []).map((item) => [item.provider, item])));
      const persisted = (result.saved || []).map(mapMessage);
      const finalMessages = [...nextMessages, ...persisted];
      setMessages(finalMessages);
      cacheSession(sid, finalMessages).catch(() => {});
      await loadSessions();
    } catch (cause) {
      setError(cause.message || 'Não foi possível concluir a execução.');
    } finally {
      setRunning(false);
    }
  }

  function replayIntro() {
    localStorage.removeItem(INTRO_KEY);
    setShowIntro(true);
  }

  return (
    <div className={`pcx-root pcx-mode-${mode}`}>
      {showIntro && <PrismCodexIntro onComplete={() => setShowIntro(false)} />}

      <CodexSidebar
        sessions={sessions}
        activeId={sessionId}
        query={query}
        onQuery={setQuery}
        onNew={newSession}
        onOpen={loadSession}
        onRename={renameSession}
        onDelete={deleteSession}
        onReplay={replayIntro}
        onMode={setMode}
        mode={mode}
      />

      <main className="pcx-main">
        <header className="pcx-header">
          <div className="pcx-header-title">
            <span>PRISM</span>
            <strong>{mode === 'vibe' ? 'Vibe Code' : 'Conversa'}</strong>
          </div>

          <div className="pcx-header-controls">
            <div className="pcx-model-menu">
              <button className="pcx-model-trigger" onClick={() => setModelOpen((open) => !open)} aria-expanded={modelOpen}>
                <span>{providers.find((item) => item.id === 'anthropic')?.label || 'Claude'}</span>
                <b>{providers.filter((item) => item.enabled !== false).length}/3</b>
                <i>⌄</i>
              </button>
              {modelOpen && (
                <div className="pcx-model-dropdown">
                  {providers.map((item) => (
                    <button key={item.id} className={item.enabled !== false ? 'on' : ''} onClick={() => toggleProvider(item.id)}>
                      <span>{item.label}</span>
                      <small>{item.model}</small>
                      <b>{item.enabled !== false ? 'ATIVO' : 'OFF'}</b>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="pcx-effort" onClick={() => setEffort(EFFORTS[(EFFORTS.indexOf(effort) + 1) % EFFORTS.length])}>
              {effort}
            </button>
            <button className="pcx-command" onClick={() => setCommandOpen(true)}>⌘K</button>
          </div>
        </header>

        <McpContextBar servers={mcpServers} activeIds={mcpActive} onToggle={toggleMcp} />

        <section className="pcx-content">
          <section className="pcx-chat-panel">
            <div className="pcx-chat-scroll">
              {messages.length === 0 && !Object.keys(runs).length && (
                <div className="pcx-welcome">
                  <div className="pcx-welcome-mark">P</div>
                  <p>PRISM CODEX</p>
                  <h1>O que você quer fazer?</h1>
                  <span>Comece com uma pergunta, uma ideia ou um problema.</span>
                </div>
              )}

              {messages.map((message) => (
                <article className={`pcx-message ${message.role}`} key={message.id}>
                  <div className="pcx-message-label">{message.role === 'user' ? 'Você' : (message.provider || 'Prism')}</div>
                  <div className="pcx-message-text">{message.text}</div>
                  {message.tools?.length > 0 && <div className="pcx-message-meta">Ferramentas · {message.tools.map((tool) => tool.tool).filter(Boolean).join(', ')}</div>}
                </article>
              ))}

              {Object.keys(runs).length > 0 && <ParallelResponseGrid models={providers} runs={runs} />}
            </div>

            {error && (
              <div className="pcx-error">
                <strong>Não foi possível concluir</strong>
                <span>{error}</span>
              </div>
            )}

            <footer className="pcx-composer-wrap">
              <div className="pcx-composer">
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      send();
                    }
                  }}
                  placeholder={mode === 'vibe' ? 'Descreva o que você quer construir…' : 'Como posso ajudar você hoje?'}
                  rows={1}
                  disabled={running}
                />
                <div className="pcx-composer-bar">
                  <span>Enter envia · Shift + Enter quebra a linha</span>
                  <div>
                    <button className="pcx-replay" onClick={replayIntro}>Apresentação</button>
                    <button className="pcx-send" onClick={send} disabled={running || !prompt.trim()}>{running ? 'Processando…' : 'Enviar'}</button>
                  </div>
                </div>
              </div>
              <small className="pcx-composer-note">As respostas podem conter erros. Revise informações importantes.</small>
            </footer>
          </section>
        </section>
      </main>

      {commandOpen && (
        <div className="pcx-modal-backdrop" onMouseDown={() => setCommandOpen(false)}>
          <div className="pcx-command-palette" onMouseDown={(event) => event.stopPropagation()}>
            <div><span>BUSCAR CONVERSAS</span><kbd>ESC</kbd></div>
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Digite para filtrar…" />
            <button onClick={newSession}>+ Nova conversa</button>
            <button onClick={replayIntro}>Reabrir apresentação</button>
          </div>
        </div>
      )}
    </div>
  );
}
