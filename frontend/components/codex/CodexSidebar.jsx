import { useMemo } from 'react';

function dayGroup(value) {
  const date = new Date(value || Date.now());
  const now = new Date();
  const start = (item) => new Date(item.getFullYear(), item.getMonth(), item.getDate()).getTime();
  const delta = Math.floor((start(now) - start(date)) / 86400000);
  if (delta === 0) return 'Hoje';
  if (delta === 1) return 'Ontem';
  if (delta < 7) return 'Últimos 7 dias';
  if (delta < 30) return 'Este mês';
  return 'Mais antigas';
}

export default function CodexSidebar({ sessions = [], activeId, query = '', onQuery, onNew, onOpen, onRename, onDelete, onReplay, onMode, onPlans, onHome, onArtifacts, onSettings, onProjects, mode = 'chat' }) {
  const visible = sessions.filter((session) => !query || String(session.title || '').toLowerCase().includes(query.toLowerCase()));
  const groups = useMemo(() => visible.reduce((acc, session) => { const key = dayGroup(session.updated_at || session.created_at); (acc[key] ||= []).push(session); return acc; }, {}), [visible]);

  return <aside className="codex-sidebar-rebuilt">
    <div className="codex-brand-row"><button type="button" className="codex-brand" onClick={onHome} aria-label="Ir para Home"><img src="/prism-logo.svg" alt="" aria-hidden="true" /><span>Prism IA</span></button></div>
    <div className="codex-app-switcher" role="navigation" aria-label="Alternar aplicativo"><button type="button" onClick={onHome}>Home</button><button type="button" className="active">Codex</button></div>
    <button type="button" className="codex-new" onClick={onNew} aria-label="Nova conversa"><span>+</span><span>Novo</span></button>
    <nav className="codex-navigation" aria-label="Navegação principal">
      <button type="button" className={mode === 'chat' ? 'active' : ''} onClick={() => onMode?.('chat')}>Conversa</button>
      <button type="button" className={mode === 'vibe' ? 'active' : ''} onClick={() => onMode?.('vibe')}>Código</button>
      <button type="button" onClick={onProjects}>Projetos</button>
      <button type="button" onClick={onArtifacts}>Artefatos</button>
      <button type="button" onClick={onSettings}>Personalizar</button>
    </nav>
    <div className="codex-sidebar-divider" />
    <label className="codex-search"><span>⌕</span><input value={query} onChange={(event) => onQuery?.(event.target.value)} placeholder="Buscar conversas" aria-label="Buscar conversas" /><kbd>⌘K</kbd></label>
    <div className="codex-history">
      <div className="codex-history-title"><span>Conversas</span><b>{visible.length || ''}</b></div>
      {Object.entries(groups).map(([group, items]) => <section key={group}><div className="codex-history-group">{group}</div>{items.map((session) => <div className={`codex-session ${session.id === activeId ? 'active' : ''}`} key={session.id}><button type="button" className="codex-session-open" onClick={() => onOpen?.(session.id)}>{session.title || 'Nova conversa'}</button><div className="codex-session-actions"><button type="button" onClick={() => onRename?.(session)} aria-label="Renomear conversa">Editar</button><button type="button" onClick={() => onDelete?.(session)} aria-label="Excluir conversa">Excluir</button></div></div>)}</section>)}
      {!visible.length && <p className="codex-empty-history">Suas conversas aparecem aqui.</p>}
    </div>
    <div className="codex-sidebar-footer"><button type="button" onClick={onPlans}>Planos</button><button type="button" onClick={onReplay}>Apresentação · TAFF 2.0</button></div>
  </aside>;
}
