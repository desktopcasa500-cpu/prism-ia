import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';

function dayGroup(value) {
  const date = new Date(value || Date.now());
  const now = new Date();
  const start = (item) => new Date(item.getFullYear(), item.getMonth(), item.getDate()).getTime();
  const delta = Math.round((start(now) - start(date)) / 86400000);
  if (delta === 0) return 'Hoje';
  if (delta === 1) return 'Ontem';
  if (delta < 7) return 'Últimos 7 dias';
  if (delta < 30) return 'Este mês';
  return 'Mais antigas';
}

export default function CodexSidebar({ sessions = [], activeId, query = '', onQuery, onNew, onOpen, onRename, onDelete, onReplay, onMode, onPlans, onHome = () => { window.location.href = '/chat'; }, onCodex = () => {}, onArtifacts = () => {}, onSettings = () => {}, mode = 'chat' }) {
  const [usagePct, setUsagePct] = useState(0);
  const [usageLabel, setUsageLabel] = useState('0% usado');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const usage = await api.get('/chat/usage');
        if (!mounted) return;
        const percentage = Math.max(0, Math.min(100, Number(usage?.percentage ?? usage?.daily?.percentage ?? 0)));
        setUsagePct(percentage);
        setUsageLabel(`${percentage}% usado`);
      } catch {
        if (mounted) { setUsagePct(0); setUsageLabel('0% usado'); }
      }
    };
    load();
    const timer = window.setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  const visible = sessions.filter((session) => !query || String(session.title || '').toLowerCase().includes(query.toLowerCase()));
  const groups = useMemo(() => visible.reduce((acc, session) => {
    const key = dayGroup(session.updated_at || session.created_at);
    (acc[key] ||= []).push(session);
    return acc;
  }, {}), [visible]);

  return <aside className="pcx-sidebar unified-sidebar">
    <div className="pcx-brand unified-brand">
      <button className="pcx-brand-button" onClick={onHome} aria-label="Ir para Home">
        <img className="pcx-brand-mark" src="/prism-logo.svg" alt="" aria-hidden="true" />
        <span><strong>Prism IA</strong><small>Codex</small></span>
      </button>
    </div>

    <div className="app-switcher pcx-app-switcher" role="navigation" aria-label="Alternar aplicativo">
      <button className="app-switch" onClick={onHome}>Home</button>
      <button className="app-switch active" onClick={onCodex}>Codex</button>
    </div>

    <button className="pcx-new unified-new" onClick={onNew} aria-label="Nova conversa"><span className="pcx-new-plus">+</span><span>Novo</span></button>

    <nav className="home-section-nav pcx-unified-nav" aria-label="Prism">
      <button onClick={() => onMode?.('chat')} className={mode === 'chat' ? 'active' : ''}><span className="nav-glyph">▱</span><span>Projetos</span></button>
      <button onClick={onArtifacts}><span className="nav-glyph">▤</span><span>Artefatos</span></button>
      <button onClick={() => onMode?.('vibe')} className={mode === 'vibe' ? 'active' : ''}><span className="nav-glyph">&lt;/&gt;</span><span>Código</span><b>Upgrade</b></button>
      <button onClick={onSettings}><span className="nav-glyph">□</span><span>Personalizar</span></button>
    </nav>

    <div className="pcx-history-search unified-search">
      <span>⌕</span><input value={query} onChange={(event) => onQuery?.(event.target.value)} placeholder="Buscar conversas" aria-label="Buscar conversas" /><kbd>⌘K</kbd>
    </div>

    <div className="pcx-history unified-history">
      <div className="pcx-history-head"><span>Conversas</span><b>{visible.length || ''}</b></div>
      {Object.entries(groups).map(([group, items]) => <section key={group}><div className="pcx-group-label">{group}</div>{items.map((session) => <div className={`pcx-session ${session.id === activeId ? 'active' : ''}`} key={session.id}><button className="pcx-session-open" onClick={() => onOpen?.(session.id)}>{session.title || 'Nova conversa'}</button><div className="pcx-session-actions"><button onClick={() => onRename?.(session)} aria-label="Renomear conversa">Editar</button><button onClick={() => onDelete?.(session)} aria-label="Excluir conversa">Excluir</button></div></div>)}</section>)}
      {!visible.length && <p className="pcx-muted">Suas conversas aparecem aqui.</p>}
    </div>

    <div className="sidebar-bottom unified-sidebar-bottom">
      <div className="sidebar-usage" title={usageLabel}><div className="sidebar-usage-head"><span>Uso</span><strong>{usageLabel}</strong></div><div className="usage-track"><span style={{ width: `${usagePct}%` }} /></div></div>
      <button className="profile-button" onClick={onSettings}><span className="avatar">P</span><span className="profile-text"><strong>Prism Codex</strong><small>Configurações</small></span></button>
      <button className="pcx-presentation-link" onClick={onReplay}>Apresentação · TAFF 2.0</button>
      <button className="pcx-plans-link" onClick={onPlans}>Planos</button>
    </div>
  </aside>;
}
