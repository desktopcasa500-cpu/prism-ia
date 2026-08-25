import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

const initialMcp = [
  { name: 'Arquivos locais', type: 'filesystem', status: 'Pronto', detail: 'Arquivos e pastas do workspace' },
  { name: 'GitHub', type: 'github', status: 'Conectar', detail: 'Repositórios, issues e pull requests' },
  { name: 'Banco de dados', type: 'database', status: 'Conectar', detail: 'Consultas e inspeção de schema' },
  { name: 'Servidor personalizado', type: 'custom', status: 'Adicionar', detail: 'Endpoint MCP compatível' },
];

const skills = [
  ['Construção de jogos', '3D', 'Assets, gameplay, shaders e arquitetura'],
  ['Frontend artesanal', 'Web', 'React, acessibilidade, motion e design systems'],
  ['Pesquisa profunda', 'Research', 'Busca, síntese e comparação de fontes'],
  ['Code review', 'Engineering', 'Análise estrutural, bugs e refatoração'],
  ['Direção visual', 'Design', 'Composição, tipografia, ritmo e identidade'],
  ['Dados e SQL', 'Data', 'Modelagem, queries e exploração'],
];

const files = ['src/App.jsx', 'src/pages/Chat.jsx', 'src/pages/Studio.jsx', 'src/styles.css', 'backend/src/routes/chat.js'];

export default function Studio() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [mcp, setMcp] = useState(initialMcp);
  const [activeSkill, setActiveSkill] = useState(null);
  const [command, setCommand] = useState('');
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState('');

  const stats = useMemo(() => ({
    files: files.length,
    skills: skills.length,
    connected: mcp.filter((item) => item.status === 'Pronto').length,
    credits: user?.plan === 'pro' ? '∞' : '8.420',
  }), [mcp, user]);

  function connect(index) {
    setMcp((items) => items.map((item, i) => i === index ? { ...item, status: 'Pronto' } : item));
    setToast('Integração preparada para este workspace.');
    window.setTimeout(() => setToast(''), 2200);
  }

  function runCommand(event) {
    event.preventDefault();
    if (!command.trim()) return;
    setRunning(true);
    window.setTimeout(() => { setRunning(false); setToast('Tarefa adicionada ao fluxo do Prism.'); setCommand(''); window.setTimeout(() => setToast(''), 2200); }, 900);
  }

  return (
    <div className="studio-page">
      <header className="studio-topbar">
        <div className="studio-brand"><Link to="/chat" className="brand"><span className="brand-mark">P</span><span>Prism</span></Link><span className="studio-divider">/</span><span>Studio</span></div>
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
            <div className="metric-grid"><Metric value={stats.files} label="arquivos no contexto" /><Metric value={stats.skills} label="skills disponíveis" /><Metric value={stats.connected} label="integrações conectadas" /><Metric value={stats.credits} label="créditos restantes" /></div>
            <div className="studio-grid two"><Panel title="Continue de onde parou"><div className="resume-card"><div className="resume-icon">↗</div><div><strong>Reconstrução do Prism IA</strong><p>Revisar arquitetura, corrigir deploy e preparar a próxima versão.</p><span>Atualizado há poucos minutos</span></div><button className="button button-warm" onClick={() => setTab('files')}>Abrir</button></div></Panel><Panel title="Atalhos"><div className="shortcut-grid"><Shortcut keyName="⌘ K" text="Comando rápido" /><Shortcut keyName="⌘ P" text="Abrir arquivo" /><Shortcut keyName="⌘ J" text="Nova conversa" /><Shortcut keyName="⌘ ⇧ M" text="Gerenciar MCP" /></div></Panel></div>
            <Panel title="Fluxo de trabalho"><div className="flow"><Flow n="01" title="Conversa" text="Defina o que quer construir." /><Flow n="02" title="Planejamento" text="Prism separa o trabalho em etapas." /><Flow n="03" title="Execução" text="Skills e ferramentas entram no momento certo." /><Flow n="04" title="Artifact" text="O resultado fica editável e versionado." /></div></Panel>
          </>}

          {tab === 'files' && <Panel title="Explorer"><div className="file-tree">{files.map((file, index) => <button key={file} className="file-row" onClick={() => setToast(`Abrindo ${file}`)}><span>{index === 0 ? '◆' : '◇'}</span>{file}<small>{index === 0 ? 'principal' : 'JSX'}</small></button>)}</div><div className="code-preview"><div className="code-bar"><span>App.jsx</span><span>React · 128 linhas</span></div><pre>{`import { Routes, Route } from 'react-router-dom';\n\nexport default function App() {\n  return (\n    <Routes>\n      <Route path="/chat" element={<Chat />} />\n      <Route path="/studio" element={<Studio />} />\n    </Routes>\n  );\n}`}</pre></div></Panel>}

          {tab === 'skills' && <div className="skill-grid">{skills.map(([name, category, description]) => <article className={`skill-card ${activeSkill === name ? 'active' : ''}`} key={name} onClick={() => setActiveSkill(name)}><div className="skill-glyph">{name.slice(0, 1)}</div><div><small>{category}</small><h3>{name}</h3><p>{description}</p></div><button className="skill-action">{activeSkill === name ? 'Ativa' : 'Usar'}</button></article>)}</div>}

          {tab === 'mcp' && <><div className="mcp-intro"><div><span className="eyebrow">Model Context Protocol</span><h2>Ferramentas externas, dentro do fluxo.</h2><p>O Prism organiza servidores MCP por projeto. A interface abaixo gerencia o catálogo; credenciais e endpoints reais ficam no ambiente seguro do servidor.</p></div><button className="button button-warm" onClick={() => connect(3)}>+ Adicionar servidor</button></div><div className="mcp-list">{mcp.map((item, index) => <article className="mcp-card" key={item.name}><div className="mcp-symbol">{item.type === 'github' ? 'GH' : item.type === 'database' ? 'DB' : item.type === 'filesystem' ? 'FS' : 'MCP'}</div><div className="mcp-main"><div><h3>{item.name}</h3><p>{item.detail}</p></div><span className={`connection ${item.status === 'Pronto' ? 'ready' : ''}`}>{item.status}</span></div><button className="button" onClick={() => connect(index)}>{item.status === 'Pronto' ? 'Configurar' : 'Conectar'}</button></article>)}</div></>}

          {tab === 'artifacts' && <div className="artifact-grid"><Artifact title="Prism Landing" type="Site" meta="React · 18 arquivos" /><Artifact title="Tanque 3D" type="Jogo" meta="Three.js · 42 assets" /><Artifact title="Research notes" type="Documento" meta="12 fontes · 8 páginas" /><Artifact title="Dashboard" type="Interface" meta="React · 24 componentes" /></div>}

          {tab === 'models' && <div className="model-workbench"><div className="model-list">{['Prism Nano 1.0A','Prism Mini 1.0A','Prism Edge 1.0A','Prism Tex 1.0A','Prism Taff 2.0'].map((name, index) => <button key={name} className={index === 4 ? 'model-selected' : ''}><span>0{index + 1}</span><strong>{name}</strong><small>{['Rápido','Equilibrado','Código','Contexto','Projetos complexos'][index]}</small></button>)}</div><div className="model-detail"><div className="eyebrow">Modelo selecionado</div><h2>Prism Taff 2.0</h2><p>Orquestração para trabalhos longos, código, criação de jogos e tarefas que precisam de planejamento em várias etapas.</p><div className="detail-lines"><div><span>Raciocínio</span><b>MAX</b></div><div><span>Contexto</span><b>128k</b></div><div><span>Ferramentas</span><b>MCP · Skills · Artifacts</b></div></div></div></div>}

          {tab === 'activity' && <Panel title="Linha do tempo"><div className="timeline">{['Workspace criado','Skill Code Review ativada','GitHub conectado','Artifact Prism Landing atualizado','Conversa iniciada'].map((item, i) => <div className="timeline-row" key={item}><span>0{i + 1}</span><div><strong>{item}</strong><small>{i + 1} min atrás · Prism</small></div></div>)}</div></Panel>}

          <form className="studio-command" onSubmit={runCommand}><span>⌘</span><input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="Diga ao Prism o que fazer neste workspace…" /><button className="button button-warm" disabled={running}>{running ? 'Executando…' : 'Executar'}</button></form>
          {toast && <div className="studio-toast">{toast}</div>}
        </main>
      </div>
    </div>
  );
}

function Metric({ value, label }) { return <div className="metric"><strong>{value}</strong><span>{label}</span></div>; }
function Panel({ title, children }) { return <section className="studio-panel"><div className="panel-head"><h2>{title}</h2><span>Prism</span></div>{children}</section>; }
function Shortcut({ keyName, text }) { return <button className="shortcut"><kbd>{keyName}</kbd><span>{text}</span></button>; }
function Flow({ n, title, text }) { return <div className="flow-item"><span>{n}</span><div><strong>{title}</strong><p>{text}</p></div></div>; }
function Artifact({ title, type, meta }) { return <article className="artifact-card"><div className="artifact-thumb"><span>{type}</span><b>PR</b></div><small>{type}</small><h3>{title}</h3><p>{meta}</p><button className="button">Abrir artifact</button></article>; }
