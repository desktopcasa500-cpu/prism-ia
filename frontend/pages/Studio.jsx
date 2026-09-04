import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';

const skills = [
  ['Construção de jogos', '3D', 'Assets, gameplay, shaders e arquitetura'],
  ['Frontend artesanal', 'Web', 'React, acessibilidade, motion e design systems'],
  ['Pesquisa profunda', 'Research', 'Busca, síntese e comparação de fontes'],
  ['Code review', 'Engineering', 'Análise estrutural, bugs e refatoração'],
  ['Direção visual', 'Design', 'Composição, tipografia, ritmo e identidade'],
  ['Dados e SQL', 'Data', 'Modelagem, queries e exploração'],
];

const files = ['src/App.jsx', 'src/pages/Chat.jsx', 'src/pages/Studio.jsx', 'src/styles.css', 'backend/src/routes/chat.js'];

function getMcpIcon(type) {
  if (type === 'github') return 'GH';
  if (type === 'database') return 'DB';
  if (type === 'filesystem') return 'FS';
  return 'MCP';
}

function normalizeMcpServer(server) {
  return {
    ...server,
    status: server.status || (server.builtin ? 'Configurado' : server.enabled ? 'Ativo' : 'Desativado'),
    detail: server.builtin ? 'Servidor MCP oficial do GitHub' : server.endpoint_url,
    tool_count: Number.isFinite(server.tool_count) ? server.tool_count : null,
  };
}

export default function Studio() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [mcp, setMcp] = useState([]);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpBusy, setMcpBusy] = useState(null);
  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  const [mcpToolsModal, setMcpToolsModal] = useState(null);
  const [mcpToolsLoading, setMcpToolsLoading] = useState(false);
  const [mcpForm, setMcpForm] = useState({ name: '', endpoint_url: '', token: '' });
  const [mcpError, setMcpError] = useState('');
  const [activeSkill, setActiveSkill] = useState(null);
  const [command, setCommand] = useState('');
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState('');

  const stats = useMemo(() => ({
    files: files.length,
    skills: skills.length,
    connected: mcp.filter((item) => item.status === 'Conectado').length + mcp.filter((item) => item.builtin && item.status === 'Configurado').length,
    credits: user?.plan === 'pro' ? '∞' : '8.420',
  }), [mcp, user]);

  const showToast = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  }, []);

  const loadMcp = useCallback(async () => {
    setMcpLoading(true);
    setMcpError('');
    try {
      const result = await api.get('/mcp');
      const servers = Array.isArray(result.servers) ? result.servers.map(normalizeMcpServer) : [];
      setMcp(servers);
    } catch (error) {
      if (error.status === 401 || error.status === 403) { logout(); navigate('/login', { replace: true }); return; }
      setMcpError(error.message || 'Não foi possível carregar os servidores MCP.');
    } finally {
      setMcpLoading(false);
    }
  }, [logout, navigate]);

  useEffect(() => { loadMcp(); }, [loadMcp]);

  async function testMcp(server) {
    setMcpBusy(server.id);
    setMcpError('');
    try {
      const result = await api.post(`/mcp/${encodeURIComponent(server.id)}/test`, {}, { timeout: 60_000 });
      setMcp((items) => items.map((item) => item.id === server.id ? {
        ...item,
        status: 'Conectado',
        tool_count: result.tool_count,
        transport: result.transport,
      } : item));
      showToast(`${server.name}: ${result.tool_count} ferramenta${result.tool_count === 1 ? '' : 's'} disponível${result.tool_count === 1 ? '' : 'is'}.`);
    } catch (error) {
      setMcp((items) => items.map((item) => item.id === server.id ? { ...item, status: 'Erro' } : item));
      setMcpError(error.message || 'O servidor MCP não respondeu.');
    } finally {
      setMcpBusy(null);
    }
  }

  async function viewMcpTools(server) {
    setMcpToolsLoading(true);
    setMcpToolsModal({ name: server.name, tools: [], transport: server.transport || '' });
    setMcpError('');
    try {
      const result = await api.get(`/mcp/${encodeURIComponent(server.id)}/tools`);
      setMcpToolsModal({ name: server.name, tools: Array.isArray(result.tools) ? result.tools : [], transport: result.transport || '' });
      setMcp((items) => items.map((item) => item.id === server.id ? { ...item, status: 'Conectado', tool_count: result.tools?.length || 0, transport: result.transport } : item));
    } catch (error) {
      setMcpToolsModal(null);
      setMcpError(error.message || 'Não foi possível carregar as ferramentas deste MCP.');
    } finally {
      setMcpToolsLoading(false);
    }
  }

  async function deleteMcp(server) {
    if (server.builtin || mcpBusy) return;
    if (!window.confirm(`Remover “${server.name}” deste workspace?`)) return;
    setMcpBusy(server.id);
    try {
      await api.delete(`/mcp/${encodeURIComponent(server.id)}`);
      setMcp((items) => items.filter((item) => item.id !== server.id));
      showToast('Servidor MCP removido.');
    } catch (error) {
      setMcpError(error.message || 'Não foi possível remover o servidor.');
    } finally {
      setMcpBusy(null);
    }
  }

  async function addMcp(event) {
    event.preventDefault();
    if (mcpBusy) return;
    setMcpBusy('new');
    setMcpError('');
    try {
      const result = await api.post('/mcp', mcpForm, { timeout: 60_000 });
      const server = normalizeMcpServer({ ...result.server, status: 'Conectado', tool_count: result.tool_count, transport: result.transport });
      setMcp((items) => [server, ...items.filter((item) => item.id !== server.id)]);
      setMcpForm({ name: '', endpoint_url: '', token: '' });
      setMcpModalOpen(false);
      showToast(`${server.name}: conexão verificada.`);
    } catch (error) {
      setMcpError(error.message || 'Não foi possível adicionar o servidor MCP.');
    } finally {
      setMcpBusy(null);
    }
  }

  async function runCommand(event) {
    event.preventDefault();
    const content = command.trim();
    if (!content || running) return;
    setRunning(true);
    setMcpError('');
    try {
      const model = localStorage.getItem('prism-model') || 'prism-mini-1.0';
      const effort = localStorage.getItem('prism-effort') || 'medium';
      const created = await api.post('/chat/sessions', { title: content.replace(/\s+/g, ' ').slice(0, 64) });
      const sessionId = created.session?.id;
      if (!sessionId) throw new Error('Não foi possível iniciar o workspace de conversa.');
      await api.post(`/chat/sessions/${encodeURIComponent(sessionId)}/messages`, { content, model, effort }, { timeout: 180_000 });
      setCommand('');
      navigate('/chat');
    } catch (error) {
      if (error.status === 401 || error.status === 403) { logout(); navigate('/login', { replace: true }); return; }
      showToast(error.message || 'Não foi possível executar o comando.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="studio-page">
      <header className="studio-topbar">
        <div className="studio-brand"><Link to="/chat" className="brand"><span className="brand-mark" aria-hidden="true"><span /></span><span>Prism</span></Link><span className="studio-divider">/</span><span>Studio</span></div>
        <div className="studio-top-actions"><span className="studio-status"><i /> workspace pessoal</span><Link className="button" to="/chat">Voltar ao chat</Link></div>
      </header>

      <div className="studio-layout">
        <aside className="studio-nav">
          <div className="studio-project"><span className="project-dot" /> prism-ia <small>main</small></div>
          <nav>
            {[
              ['overview', 'Visão geral'], ['files', 'Arquivos'], ['skills', 'Skills'], ['mcp', 'MCP & integrações'], ['artifacts', 'Artifacts'], ['models', 'Modelos'], ['activity', 'Atividade'],
            ].map(([key, label]) => <button key={key} className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}>{label}</button>)}
          </nav>
          <div className="studio-nav-foot"><div className="avatar">{(user?.name || 'P').slice(0, 1).toUpperCase()}</div><div><strong>{user?.name || 'Usuário'}</strong><span>{user?.plan || 'free'} · {stats.credits} créditos</span></div></div>
        </aside>

        <main className="studio-content">
          <section className="studio-heading"><div><div className="eyebrow">Prism workspace</div><h1>{tab === 'overview' ? 'Seu espaço de criação.' : tab === 'mcp' ? 'Conecte o que o Prism precisa.' : tab === 'skills' ? 'Skills que entram quando fazem sentido.' : tab === 'artifacts' ? 'Coisas que o Prism construiu.' : 'Workspace'}</h1><p>Um ambiente para conversar, construir, testar e organizar projetos sem transformar tudo em um painel técnico.</p></div><div className="studio-orb"><span>01</span><b>PRISM</b></div></section>

          {tab === 'overview' && <>
            <div className="metric-grid"><Metric value={stats.files} label="arquivos no contexto" /><Metric value={stats.skills} label="skills disponíveis" /><Metric value={stats.connected} label="integrações ativas" /><Metric value={stats.credits} label="créditos restantes" /></div>
            <div className="studio-grid two"><Panel title="Continue de onde parou"><div className="resume-card"><div className="resume-icon">↗</div><div><strong>Reconstrução do Prism IA</strong><p>Revisar arquitetura, corrigir deploy e preparar a próxima versão.</p><span>Atualizado há poucos minutos</span></div><button className="button button-warm" onClick={() => setTab('files')}>Abrir</button></div></Panel><Panel title="Atalhos"><div className="shortcut-grid"><Shortcut keyName="⌘ K" text="Comando rápido" /><Shortcut keyName="⌘ P" text="Abrir arquivo" /><Shortcut keyName="⌘ J" text="Nova conversa" /><Shortcut keyName="⌘ ⇧ M" text="Gerenciar MCP" onClick={() => setTab('mcp')} /></div></Panel></div>
            <Panel title="Fluxo de trabalho"><div className="flow"><Flow n="01" title="Conversa" text="Defina o que quer construir." /><Flow n="02" title="Planejamento" text="Prism separa o trabalho em etapas." /><Flow n="03" title="Execução" text="Skills e ferramentas entram no momento certo." /><Flow n="04" title="Artifact" text="O resultado fica editável e versionado." /></div></Panel>
          </>}

          {tab === 'files' && <Panel title="Explorer"><div className="file-tree">{files.map((file, index) => <button key={file} className="file-row" onClick={() => showToast(`Abrindo ${file}`)}><span>{index === 0 ? '◆' : '◇'}</span>{file}<small>{index === 0 ? 'principal' : 'JSX'}</small></button>)}</div><div className="code-preview"><div className="code-bar"><span>App.jsx</span><span>React · 128 linhas</span></div><pre>{`import { Routes, Route } from 'react-router-dom';\n\nexport default function App() {\n  return (\n    <Routes>\n      <Route path="/chat" element={<Chat />} />\n      <Route path="/studio" element={<Studio />} />\n    </Routes>\n  );\n}`}</pre></div></Panel>}

          {tab === 'skills' && <div className="skill-grid">{skills.map(([name, category, description]) => <article className={`skill-card ${activeSkill === name ? 'active' : ''}`} key={name} onClick={() => setActiveSkill(name)}><div className="skill-glyph">{name.slice(0, 1)}</div><div><small>{category}</small><h3>{name}</h3><p>{description}</p></div><button className="skill-action" onClick={(event) => { event.stopPropagation(); setActiveSkill(name); }}>{activeSkill === name ? 'Ativa' : 'Usar'}</button></article>)}</div>}

          {tab === 'mcp' && <>
            <div className="mcp-intro"><div><span className="eyebrow">Model Context Protocol</span><h2>Ferramentas externas, dentro do fluxo.</h2><p>O Prism conecta servidores MCP reais, descobre as ferramentas publicadas por eles e entrega essas ferramentas ao modelo. Quando uma ferramenta corresponde ao pedido, a IA pode executá-la e usar o resultado antes de responder.</p></div><button className="button button-warm" onClick={() => { setMcpError(''); setMcpModalOpen(true); }}>Adicionar servidor</button></div>
            {mcpError && <div className="mcp-error" role="alert"><span>{mcpError}</span><button onClick={() => setMcpError('')}>Fechar</button></div>}
            <div className="mcp-list">
              {mcpLoading && <div className="mcp-empty">Carregando conexões...</div>}
              {!mcpLoading && !mcp.length && <div className="mcp-empty">Nenhum servidor MCP conectado a este workspace.</div>}
              {!mcpLoading && mcp.map((item) => <article className="mcp-card" key={item.id}><div className="mcp-symbol">{getMcpIcon(item.type)}</div><div className="mcp-main"><div><h3>{item.name}</h3><p>{item.detail}</p><div className="mcp-meta">{item.tool_count != null ? `${item.tool_count} ferramenta${item.tool_count === 1 ? '' : 's'}` : 'Ferramentas ainda não verificadas'}{item.transport ? ` · ${item.transport}` : ''}</div></div><span className={`connection ${item.status === 'Conectado' || item.status === 'Configurado' ? 'ready' : item.status === 'Erro' ? 'error' : ''}`}>{item.status}</span></div><div className="mcp-actions"><button className="button" onClick={() => testMcp(item)} disabled={mcpBusy === item.id}>{mcpBusy === item.id ? 'Testando...' : 'Testar conexão'}</button><button className="button mcp-tools-button" onClick={() => viewMcpTools(item)} disabled={mcpBusy === item.id || mcpToolsLoading}>Ferramentas</button>{!item.builtin && <button className="mcp-remove" onClick={() => deleteMcp(item)} disabled={Boolean(mcpBusy && mcpBusy !== item.id)}>Remover</button>}</div></article>)}
            </div>
          </>}

          {tab === 'artifacts' && <div className="artifact-grid"><Artifact title="Prism Landing" type="Site" meta="React · 18 arquivos" /><Artifact title="Tanque 3D" type="Jogo" meta="Three.js · 42 assets" /><Artifact title="Research notes" type="Documento" meta="12 fontes · 8 páginas" /><Artifact title="Dashboard" type="Interface" meta="React · 24 componentes" /></div>}

          {tab === 'models' && <div className="model-workbench"><div className="model-list">{['Prism Nano 1.0A','Prism Mini 1.0A','Prism Edge 1.0A','Prism Tex 1.0A','Prism Taff 2.0'].map((name, index) => <button key={name} className={index === 4 ? 'model-selected' : ''}><span>0{index + 1}</span><strong>{name}</strong><small>{['Rápido','Equilibrado','Código','Contexto','Projetos complexos'][index]}</small></button>)}</div><div className="model-detail"><div className="eyebrow">Modelo selecionado</div><h2>Prism Taff 2.0</h2><p>Orquestração para trabalhos longos, código, criação de jogos e tarefas que precisam de planejamento em várias etapas.</p><div className="detail-lines"><div><span>Raciocínio</span><b>MAX</b></div><div><span>Contexto</span><b>128k</b></div><div><span>Ferramentas</span><b>MCP · Skills · Artifacts</b></div></div></div></div>}

          {tab === 'activity' && <Panel title="Linha do tempo"><div className="timeline">{['Workspace criado','Skill Code Review ativada','GitHub conectado','Artifact Prism Landing atualizado','Conversa iniciada'].map((item, i) => <div className="timeline-row" key={item}><span>0{i + 1}</span><div><strong>{item}</strong><small>{i + 1} min atrás · Prism</small></div></div>)}</div></Panel>}

          <form className="studio-command" onSubmit={runCommand}><span>⌘</span><input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="Diga ao Prism o que fazer neste workspace..." disabled={running} /><button className="button button-warm" disabled={running || !command.trim()}>{running ? 'Executando...' : 'Executar'}</button></form>
        </main>
      </div>

      {mcpModalOpen && <div className="mcp-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMcpModalOpen(false); }}><form className="mcp-modal" onSubmit={addMcp}><div className="mcp-modal-head"><div><div className="eyebrow">Novo servidor</div><h2>Adicionar MCP</h2><p>A conexão é testada antes de ficar salva no workspace.</p></div><button type="button" className="mcp-modal-close" onClick={() => setMcpModalOpen(false)} aria-label="Fechar">×</button></div><label>Nome<input value={mcpForm.name} onChange={(event) => setMcpForm((form) => ({ ...form, name: event.target.value }))} placeholder="Meu servidor" autoFocus /></label><label>Endpoint MCP<input value={mcpForm.endpoint_url} onChange={(event) => setMcpForm((form) => ({ ...form, endpoint_url: event.target.value }))} placeholder="https://exemplo.com/mcp" inputMode="url" /></label><label>Bearer token <span>opcional</span><input type="password" value={mcpForm.token} onChange={(event) => setMcpForm((form) => ({ ...form, token: event.target.value }))} placeholder="Token do servidor" /></label><div className="mcp-modal-actions"><button type="button" className="button" onClick={() => setMcpModalOpen(false)}>Cancelar</button><button className="button button-warm" disabled={mcpBusy === 'new'}>{mcpBusy === 'new' ? 'Conectando...' : 'Conectar e salvar'}</button></div></form></div>}

      {mcpToolsModal && <div className="mcp-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMcpToolsModal(null); }}><section className="mcp-modal mcp-tools-modal"><div className="mcp-modal-head"><div><div className="eyebrow">Ferramentas descobertas</div><h2>{mcpToolsModal.name}</h2><p>{mcpToolsLoading ? 'Consultando o servidor agora...' : `${mcpToolsModal.tools.length} ferramenta${mcpToolsModal.tools.length === 1 ? '' : 's'} publicada${mcpToolsModal.tools.length === 1 ? '' : 's'}${mcpToolsModal.transport ? ` · ${mcpToolsModal.transport}` : ''}.`}</p></div><button type="button" className="mcp-modal-close" onClick={() => setMcpToolsModal(null)} aria-label="Fechar">×</button></div><div className="mcp-tool-list">{mcpToolsLoading ? <div className="mcp-empty">Lendo tools/list...</div> : mcpToolsModal.tools.length ? mcpToolsModal.tools.map((tool) => <article className="mcp-tool-row" key={tool.name}><strong>{tool.name}</strong><p>{tool.description || 'Sem descrição publicada pelo servidor.'}</p></article>) : <div className="mcp-empty">O servidor respondeu, mas não publicou ferramentas.</div>}</div></section></div>}
      {toast && <div className="studio-toast">{toast}</div>}
    </div>
  );
}

function Metric({ value, label }) { return <div className="metric"><strong>{value}</strong><span>{label}</span></div>; }
function Panel({ title, children }) { return <section className="studio-panel"><div className="panel-head"><h2>{title}</h2><span>Prism</span></div>{children}</section>; }
function Shortcut({ keyName, text, onClick }) { return <button className="shortcut" onClick={onClick}><kbd>{keyName}</kbd><span>{text}</span></button>; }
function Flow({ n, title, text }) { return <div className="flow-item"><span>{n}</span><div><strong>{title}</strong><p>{text}</p></div></div>; }
function Artifact({ title, type, meta }) { return <article className="artifact-card"><div className="artifact-thumb"><span>{type}</span><b>PR</b></div><small>{type}</small><h3>{title}</h3><p>{meta}</p><button className="button">Abrir artifact</button></article>; }
