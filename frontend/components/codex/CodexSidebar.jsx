function dayGroup(value) {
  const date = new Date(value || Date.now());
  const now = new Date();
  const start = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const delta = Math.round((start(now) - start(date)) / 86400000);
  if (delta === 0) return 'HOJE';
  if (delta === 1) return 'ONTEM';
  if (delta < 7) return 'ÚLTIMOS 7 DIAS';
  return 'MAIS ANTIGOS';
}

export default function CodexSidebar({ sessions, activeId, query, onQuery, onNew, onOpen, onRename, onDelete }) {
  const visible = sessions.filter((session) => !query || String(session.title || '').toLowerCase().includes(query.toLowerCase()));
  const groups = visible.reduce((acc, session) => {
    const key = dayGroup(session.updated_at || session.created_at);
    (acc[key] ||= []).push(session);
    return acc;
  }, {});

  return <aside className="cx-sidebar">
    <div className="cx-brand"><span className="cx-brand-mark">P</span><div><strong>PRISM</strong><small>CODEX</small></div></div>
    <button className="cx-new" onClick={onNew}>+ NOVO CHAT</button>
    <label className="cx-search"><span>⌕</span><input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Buscar conversas"/><kbd>⌘K</kbd></label>
    <div className="cx-history">
      {Object.entries(groups).map(([group, items]) => <section key={group}><div className="cx-group-label">{group}</div>{items.map((session) => <div className={`cx-session ${session.id === activeId ? 'active' : ''}`} key={session.id}>
        <button onClick={() => onOpen(session.id)}>{session.title || 'Nova conversa'}</button>
        <div className="cx-session-actions"><button aria-label="Renomear" onClick={() => onRename(session)}>↗</button><button aria-label="Excluir" onClick={() => onDelete(session)}>×</button></div>
      </div>)}</section>)}
      {!visible.length && <p className="cx-empty">Nenhuma conversa encontrada.</p>}
    </div>
    <div className="cx-sidebar-bottom"><span>SESSION</span><strong>isolada por chat</strong></div>
  </aside>;
}
