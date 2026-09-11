import { useMemo } from 'react';

const GROUPS = ['Hoje', 'Ontem', 'Últimos 7 dias', 'Mais antigas'];
const PLACEHOLDER_TITLE = 'Nova conversa';

function groupSessions(sessions = [], activeId) {
  const now = Date.now();
  const seen = new Set();
  const trimmed = sessions
    .filter((session) => session?.id)
    .filter((session) => {
      const title = String(session.title || PLACEHOLDER_TITLE).trim();
      if (title === PLACEHOLDER_TITLE && session.id !== activeId) return false;
      const key = `${title.toLowerCase()}|${String(session.updated_at || session.created_at || '')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 18);

  const buckets = new Map(GROUPS.map((label) => [label, []]));
  for (const session of trimmed) {
    const date = new Date(session.updated_at || session.created_at || now);
    const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const diff = Math.max(0, Math.floor((now - midnight) / 86400000));
    const label = diff === 0 ? 'Hoje' : diff === 1 ? 'Ontem' : diff < 7 ? 'Últimos 7 dias' : 'Mais antigas';
    buckets.get(label).push(session);
  }
  return GROUPS.map((label) => ({ label, items: buckets.get(label) })).filter((group) => group.items.length);
}

function PrismLogo() {
  return (
    <svg className="prism-logo" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="22.5" fill="#1f1f1d" />
      <path d="M24 6.5 27.9 20.1 41.5 24l-13.6 3.9L24 41.5l-3.9-13.6L6.5 24l13.6-3.9L24 6.5Z" fill="url(#prism-logo-gradient)" />
      <defs>
        <linearGradient id="prism-logo-gradient" x1="24" y1="7" x2="24" y2="41" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff7a3d" />
          <stop offset=".28" stopColor="#fff" />
          <stop offset=".72" stopColor="#fff" />
          <stop offset="1" stopColor="#ff7a3d" />
        </linearGradient>
      </defs>
    </svg>
  );
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
  const groups = useMemo(() => groupSessions(sessions, activeId), [sessions, activeId]);
  const dailyPercent = Math.min(100, Math.max(0, Number(usage?.daily?.percentage ?? usage?.percentage ?? 0)));
  const initial = String(user?.name || 'P').slice(0, 1).toUpperCase();

  return (
    <aside className={`prism-release-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="prism-release-sidebar__top">
        <button className="prism-sidebar-mobile-toggle" type="button" onClick={() => onMobileOpen?.(false)} aria-label="Fechar navegação">×</button>
        <button className="prism-release-brand" type="button" onClick={onHome} aria-label="Prism IA">
          <PrismLogo />
          <span className="prism-brand-text">Prism IA</span>
        </button>
        <button className="prism-sidebar-toggle" type="button" onClick={() => onCollapse?.(!collapsed)} aria-label={collapsed ? 'Expandir navegação' : 'Recolher navegação'}>
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {!collapsed && (
        <div className="prism-sidebar-mode" role="tablist" aria-label="Área de trabalho">
          <button type="button" className={mode === 'home' ? 'active' : ''} onClick={() => onMode?.('home')}>Chat</button>
          <button type="button" className={mode === 'codex' ? 'active' : ''} onClick={() => onMode?.('codex')}>Codex</button>
        </div>
      )}

      <button type="button" className="prism-sidebar-new" onClick={onNew}>
        <span className="prism-sidebar-new__plus">+</span>
        <span>Nova conversa</span>
      </button>

      <nav className="prism-sidebar-nav" aria-label="Navegação principal">
        <button type="button" onClick={onProjects}><span>Projetos</span><span className="prism-collapsed-only">P</span></button>
        <button type="button" onClick={onArtifacts}><span>Artefatos</span><span className="prism-collapsed-only">A</span></button>
        <button type="button" onClick={onCodex}><span>Codex</span><span className="prism-collapsed-only">C</span></button>
        <button type="button" onClick={onSettings}><span>Configurações</span><span className="prism-collapsed-only">S</span></button>
      </nav>

      {!collapsed && (
        <div className="prism-sidebar-history">
          {groups.map((group) => (
            <section key={group.label}>
              <h4>{group.label}</h4>
              <div className="prism-sidebar-history__items">
                {group.items.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className={session.id === activeId ? 'active' : ''}
                    onClick={() => onOpen?.(session.id)}
                    title={session.title || PLACEHOLDER_TITLE}
                  >
                    {session.title || PLACEHOLDER_TITLE}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="prism-sidebar-bottom">
        {!collapsed && (
          <div className="prism-usage-mini">
            <div className="prism-usage-mini__row"><span>Uso diário</span><strong>{dailyPercent.toFixed(dailyPercent % 1 ? 2 : 0)}%</strong></div>
            <div className="prism-usage-mini__bar"><b style={{ width: `${dailyPercent}%` }} /></div>
            <span>{usage?.daily?.remaining ?? usage?.remaining ?? 0} restantes</span>
          </div>
        )}
        <button type="button" className="prism-profile-mini" onClick={onProfile}>
          <span className="prism-profile-avatar">{initial}</span>
          <span className="prism-profile-mini__meta"><strong>{user?.name || 'Você'}</strong><span>{user?.plan || 'Grátis'}</span></span>
        </button>
      </div>
    </aside>
  );
}
