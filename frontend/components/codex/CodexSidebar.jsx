function dayGroup(value) {
  const date = new Date(value || Date.now());
  const now = new Date();
  const start = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const delta = Math.round((start(now) - start(date)) / 86400000);
  if (delta === 0) return 'Hoje';
  if (delta === 1) return 'Ontem';
  if (delta < 7) return 'Últimos 7 dias';
  return 'Mais antigos';
}

export default function CodexSidebar({ sessions = [], activeId, query = '', onQuery, onNew, onOpen, onRename, onDelete, onReplay, onMode, onPlans, mode = 'chat' }) {
  const visible = sessions.filter((session) => !query || String(session.title || '').toLowerCase().includes(query.toLowerCase()));
  const groups = visible.reduce((acc, session) => {
    const key = dayGroup(session.updated_at || session.created_at);
    (acc[key] ||= []).push(session);
    return acc;
  }, {});

  return <aside className="pcx-sidebar">
    <div className="pcx-brand"><span className="pcx-brand-mark">P</span><div><strong>Prism IA</strong><small>Codex</small></div></div>
    <button className="pcx-new" onClick={onNew}>+ <span>Novo chat</span></button>
    <nav className="pcx-nav" aria-label="Navegação do Codex">
      <button className={mode === 'chat' ? 'active' : ''} onClick={() => onMode?.('chat')}>Conversa</button>
      <button className={mode === 'vibe' ? 'active' : ''} onClick={() => onMode?.('vibe')}>Vibe Code <small>quando necessário</small></button>
      <button onClick={onPlans}>Planos <small>free</small></button>
      <button onClick={onReplay}>Apresentação</button>
    </nav>
    <label className="pcx-history-search"><span>⌕</span><input value={query} onChange={(event) => onQuery?.(event.target.value)} placeholder="Buscar" aria-label="Buscar conversas"/><kbd>⌘K</kbd></label>
    <div className="pcx-history">
      <div className="pcx-history-head"><span>Conversas</span><b>{visible.length || ''}</b></div>
      {Object.entries(groups).map(([group, items]) => <section key={group}>
        <div className="pcx-group-label">{group}</div>
        {items.map((session) => <div className={`pcx-session ${session.id === activeId ? 'active' : ''}`} key={session.id}>
          <button className="pcx-session-open" onClick={() => onOpen?.(session.id)}>{session.title || 'Nova conversa'}</button>
          <div className="pcx-session-actions"><button onClick={() => onRename?.(session)} aria-label="Renomear conversa">…</button><button onClick={() => onDelete?.(session)} aria-label="Excluir conversa">×</button></div>
        </div>)}
      </section>)}
      {!visible.length && <p className="pcx-muted">Nenhuma conversa encontrada.</p>}
    </div>
    <div className="pcx-sidebar-foot"><button onClick={onReplay}>Apresentação do Codex</button><div className="pcx-session-note"><span>SESSÃO</span><strong>Contexto isolado</strong></div></div>
  </aside>;
}
