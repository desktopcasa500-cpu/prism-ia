import { useMemo } from 'react';

const ORDER = ['Hoje', 'Ontem', 'Últimos 7 dias', 'Este mês', 'Mais antigas'];

function groupSessions(sessions = []) {
  const map = new Map(ORDER.map((label) => [label, []]));
  const now = Date.now();
  for (const session of sessions) {
    const date = new Date(session.updated_at || session.created_at || now);
    const diff = Math.floor((now - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86400000);
    const label = diff === 0 ? 'Hoje' : diff === 1 ? 'Ontem' : diff < 7 ? 'Últimos 7 dias' : diff < 30 ? 'Este mês' : 'Mais antigas';
    map.get(label).push(session);
  }
  return ORDER.map((label) => ({ label, items: map.get(label) })).filter((group) => group.items.length);
}

export default function PrismReleaseSidebar({
  mode,
  sessions,
  activeId,
  onNew,
  onOpen,
  onMode,
  onHome,
  onCodex,
  onProjects,
  onArtifacts,
  onSettings,
  onProfile,
  usage,
  user,
  collapsed,
  onCollapse,
  mobileOpen,
  onMobileOpen,
}) {
  const groups = useMemo(() => groupSessions(sessions), [sessions]);
  const dailyPercent = Math.min(100, Number(usage?.daily?.percentage ?? usage?.percentage ?? 0));
  const initial = String(user?.name || 'P').slice(0, 1).toUpperCase();

  return <aside className={`prism-release-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
    <div className="prism-release-sidebar__top">
      <button className="prism-sidebar-mobile-toggle" onClick={() => onMobileOpen?.(false)} aria-label="Fechar navegação">×</button>
      <button className="prism-release-brand" onClick={onHome} aria-label="Prism IA">
        <span className="prism-star" />
        <span className="prism-brand-text">Prism IA</span>
      </button>
      <button className="prism-sidebar-toggle" onClick={() => onCollapse?.(!collapsed)} aria-label={collapsed ? 'Expandir navegação' : 'Recolher navegação'}>{collapsed ? '→' : '←'}</button>
    </div>

    {!collapsed && <div className="prism-sidebar-switch">
      <button className={mode === 'home' ? 'active' : ''} onClick={() => onMode?.('home')}>Home</button>
      <button className={mode === 'codex' ? 'active' : ''} onClick={() => onMode?.('codex')}>Codex</button>
    </div>}

    <button className="prism-sidebar-new" onClick={onNew}>+ <span>Nova conversa</span></button>

    <nav className="prism-sidebar-nav" aria-label="Prism IA">
      <button onClick={onProjects}><span>Projetos</span><span className="prism-collapsed-only">P</span></button>
      <button onClick={onArtifacts}><span>Artefatos</span><span className="prism-collapsed-only">A</span></button>
      <button onClick={onCodex}><span>Codex</span><span className="prism-collapsed-only">C</span></button>
      <button onClick={onSettings}><span>Configurações</span><span className="prism-collapsed-only">S</span></button>
    </nav>

    {!collapsed && <div className="prism-sidebar-history">
      {groups.map((group) => <section key={group.label}>
        <h4>{group.label}</h4>
        {group.items.map((session) => <button key={session.id} className={session.id === activeId ? 'active' : ''} onClick={() => onOpen?.(session.id)} title={session.title || 'Nova conversa'}>{session.title || 'Nova conversa'}</button>)}
      </section>)}
    </div>}

    <div className="prism-sidebar-bottom">
      {!collapsed && <div className="prism-usage-mini">
        <div className="prism-usage-mini__row"><span>Uso diário</span><strong>{dailyPercent}%</strong></div>
        <div className="prism-usage-mini__bar"><b style={{ width: `${dailyPercent}%` }} /></div>
        <span>{usage?.daily?.remaining ?? usage?.remaining ?? 0} restantes</span>
      </div>}
      <button className="prism-profile-mini" onClick={onProfile}>
        <span className="prism-profile-avatar">{initial}</span>
        <span className="prism-profile-mini__meta"><strong>{user?.name || 'Você'}</strong><span>{user?.plan || 'Grátis'}</span></span>
      </button>
    </div>
  </aside>;
}
