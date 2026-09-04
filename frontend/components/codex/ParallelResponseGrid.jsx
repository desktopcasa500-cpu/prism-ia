import ThinkingPanel from './ThinkingPanel.jsx';

const LABELS = { running: 'Gerando', fulfilled: 'Pronto', rejected: 'Falhou', error: 'Falhou' };

export default function ParallelResponseGrid({ models = [], runs = {} }) {
  const activeModels = models.filter((item) => item.enabled !== false);
  if (!activeModels.length) return null;

  return <section className="pcx-grid" aria-label="Respostas comparadas">
    {activeModels.map((model) => {
      const run = runs[model.id] || { status: 'running', text: '' };
      const failed = run.status === 'rejected' || run.status === 'error';
      const elapsed = Number(run.elapsed_ms || 0);
      return <article className="pcx-card" key={model.id}>
        <header className="pcx-card-head">
          <div><strong>{model.label}</strong><small>{model.model}</small></div>
          <span className="pcx-card-status">{LABELS[run.status] || 'Aguardando'}</span>
        </header>
        {run.thinking_summary && <ThinkingPanel summary={run.thinking_summary} elapsedMs={elapsed} status={run.status === 'running' ? 'running' : 'idle'} />}
        <div className="pcx-card-body">
          {failed ? <p className="pcx-card-error">{run.error || 'Este modelo não respondeu.'}</p>
            : run.text ? <div className="pcx-card-text">{run.text}</div>
              : <div className="pcx-card-wait" aria-live="polite"><i/><i/><i/></div>}
        </div>
        <footer className="pcx-card-foot">
          <span>{elapsed ? `${(elapsed / 1000).toFixed(1)} s` : '—'}</span>
          {Array.isArray(run.tools_used) && run.tools_used.length > 0 && <span>{run.tools_used.length} ferramenta{run.tools_used.length === 1 ? '' : 's'}</span>}
        </footer>
      </article>;
    })}
  </section>;
}
