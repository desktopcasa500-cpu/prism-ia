import ThinkingPanel from './ThinkingPanel.jsx';

const LABELS = { running: 'Gerando', fulfilled: 'Pronto', rejected: 'Falhou', error: 'Falhou' };

export default function ParallelResponseGrid({ models = [], runs = {} }) {
  const activeModels = models.filter((item) => item.enabled !== false);

  return (
    <section className="cx-compare" aria-label="Respostas dos modelos">
      {activeModels.map((model) => {
        const run = runs[model.id] || { status: 'running' };
        const elapsed = Number(run.elapsed_ms || 0);
        const failed = run.status === 'rejected' || run.status === 'error';

        return (
          <article className={`cx-compare-column ${failed ? 'is-error' : ''}`} key={model.id}>
            <header className="cx-compare-head">
              <div>
                <span>{model.label}</span>
                <small>{model.model}</small>
              </div>
              <span className="cx-compare-status">{LABELS[run.status] || 'Aguardando'}</span>
            </header>
            {run.thinking_summary && (
              <ThinkingPanel
                summary={run.thinking_summary}
                elapsedMs={elapsed}
                status={run.status === 'running' ? 'running' : 'idle'}
              />
            )}
            <div className="cx-compare-body">
              {failed ? (
                <p className="cx-compare-error">{run.error || 'Este modelo não respondeu.'}</p>
              ) : run.text ? (
                <div className="cx-compare-text">{run.text}</div>
              ) : (
                <div className="cx-compare-wait" aria-live="polite">
                  <i /><i /><i />
                </div>
              )}
            </div>
            <footer className="cx-compare-foot">
              <span>{elapsed ? `${(elapsed / 1000).toFixed(1)} s` : '—'}</span>
              {Array.isArray(run.tools_used) && run.tools_used.length > 0 && <span>{run.tools_used.length} ferramenta{run.tools_used.length > 1 ? 's' : ''}</span>}
            </footer>
          </article>
        );
      })}
    </section>
  );
}
