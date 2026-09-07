import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';

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

function formatTokens(value) {
  const amount = Math.max(0, Number(value || 0));
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)} bi`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} mi`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)} mil`;
  return String(amount);
}

function intensity(tokens, max) {
  if (!tokens || !max) return 0;
  const ratio = Math.max(0, Math.min(1, tokens / max));
  if (ratio <= 0.08) return 1;
  if (ratio <= 0.3) return 2;
  if (ratio <= 0.62) return 3;
  return 4;
}

export default function CodexSidebar({ sessions = [], activeId, query = '', onQuery, onNew, onOpen, onRename, onDelete, onReplay, onMode, onPlans, onHome = () => { window.location.href = '/chat'; }, onCodex = () => {}, mode = 'chat' }) {
  const [usage, setUsage] = useState({ days: [], totalTokens: 0, activeDays: 0, maxDailyTokens: 0 });
  const [usageLoading, setUsageLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const result = await api.get('/chat/usage/history?days=35');
        if (mounted) setUsage(result || { days: [], totalTokens: 0, activeDays: 0, maxDailyTokens: 0 });
      } catch {
        if (mounted) setUsage({ days: [], totalTokens: 0, activeDays: 0, maxDailyTokens: 0 });
      } finally {
        if (mounted) setUsageLoading(false);
      }
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const visible = sessions.filter((session) => !query || String(session.title || '').toLowerCase().includes(query.toLowerCase()));
  const groups = useMemo(() => visible.reduce((acc, session) => {
    const key = dayGroup(session.updated_at || session.created_at);
    (acc[key] ||= []).push(session);
    return acc;
  }, {}), [visible]);

  return <aside className="pcx-sidebar">
    <div className="pcx-brand">
      <button className="pcx-brand-button" onClick={onCodex} aria-label="Abrir Prism Codex">
        <img className="pcx-brand-mark" src="/prism-logo.svg" alt="" aria-hidden="true" />
        <span><strong>Prism IA</strong><small>Codex</small></span>
      </button>
    </div>

    <div className="app-switcher pcx-app-switcher" role="navigation" aria-label="Alternar aplicativo">
      <button className="app-switch" onClick={onHome}>Home</button>
      <button className="app-switch active" onClick={onCodex}>Code</button>
    </div>

    <button className="pcx-new" onClick={onNew} aria-label="Nova sessão"><span className="pcx-new-plus">+</span><span>Novo</span></button>

    <div className="pcx-sidebar-section">
      <div className="pcx-sidebar-section-title">WORKSPACE</div>
      <nav className="pcx-nav" aria-label="Workspace">
        <button className={mode === 'chat' ? 'active' : ''} onClick={() => onMode?.('chat')}><span>Conversa</span><small>Chat</small></button>
        <button className={mode === 'vibe' ? 'active' : ''} onClick={() => onMode?.('vibe')}><span>Vibe Code</span><small>Build</small></button>
        <button onClick={onPlans}><span>Planos</span><small>Conta</small></button>
        <button onClick={onReplay}><span>Apresentação</span><small>TAFF 2.0</small></button>
      </nav>
    </div>

    <div className="pcx-usage-card" aria-label="Atividade dos últimos 35 dias">
      <div className="pcx-usage-head"><span>ATIVIDADE</span><strong>{usageLoading ? '—' : `${usage.activeDays} dias`}</strong></div>
      <div className="pcx-usage-grid">
        {(usage.days.length ? usage.days : Array.from({ length: 35 }, (_, index) => ({ day: `slot-${index}`, tokens: 0, active: false }))).map((day) => (
          <span key={day.day} className={`pcx-usage-cell level-${intensity(day.tokens, usage.maxDailyTokens)}`} title={`${day.day}${day.active ? ` · ${formatTokens(day.tokens)} tokens` : ' · sem uso'}`} />
        ))}
      </div>
      <div className="pcx-usage-total"><span>Tokens usados</span><strong>{usageLoading ? 'Carregando…' : formatTokens(usage.totalTokens)}</strong></div>
    </div>

    <label className="pcx-history-search"><span>⌕</span><input value={query} onChange={(event) => onQuery?.(event.target.value)} placeholder="Buscar" aria-label="Buscar conversas" /><kbd>⌘K</kbd></label>

    <div className="pcx-history">
      <div className="pcx-history-head"><span>Recentes</span><b>{visible.length || ''}</b></div>
      {Object.entries(groups).map(([group, items]) => (
        <section key={group}>
          <div className="pcx-group-label">{group}</div>
          {items.map((session) => (
            <div className={`pcx-session ${session.id === activeId ? 'active' : ''}`} key={session.id}>
              <button className="pcx-session-open" onClick={() => onOpen?.(session.id)}>{session.title || 'Nova conversa'}</button>
              <div className="pcx-session-actions">
                <button onClick={() => onRename?.(session)} aria-label="Renomear conversa">…</button>
                <button onClick={() => onDelete?.(session)} aria-label="Excluir conversa">×</button>
              </div>
            </div>
          ))}
        </section>
      ))}
      {!visible.length && <p className="pcx-muted">Nenhuma conversa encontrada.</p>}
    </div>

    <div className="pcx-sidebar-foot">
      <div className="pcx-sidebar-foot-card"><span>ESPAÇO</span><strong>Projeto ativo</strong></div>
      <button onClick={onReplay}>Apresentação do TAFF 2.0</button>
    </div>
  </aside>;
}
