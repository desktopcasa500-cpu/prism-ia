import ThinkingPanel from './ThinkingPanel.jsx';

const STATUS = {
  running: 'GERANDO',
  completed: 'PRONTO',
  error: 'FALHOU',
  rejected: 'FALHOU',
  cancelled: 'CANCELADO',
};

export default function ParallelResponseGrid({ runs = {}, models = [] }) {
  return <section className="cx-grid" aria-label="Respostas paralelas dos modelos">
    {models.filter((model) => model.enabled !== false).map((model) => {
      const run = runs[model.id] || { status: 'running', text: '', elapsedMs: 0 };
      return <article className={`cx-card cx-card-${run.status}`} key={model.id}>
        <header className="cx-card-head">
          <div><span className="cx-card-index">{String(models.indexOf(model) + 1).padStart(2, '0')}</span><strong>{model.label}</strong></div>
          <span className="cx-card-status">{STATUS[run.status] || 'AGUARDANDO'}</span>
        </header>
        {run.thinking_summary && <ThinkingPanel summary={run.thinking_summary} elapsedMs={run.elapsed_ms || run.elapsedMs || 0} status={run.status === 'running' ? 'running' : 'idle'} />}
        {run.status === 'running' && <div className="cx-skeleton"><i/><i/><i/><i/></div>}
        {run.status === 'error' || run.status === 'rejected' ? <div className="cx-error">{run.error || 'O provedor não respondeu.'}</div> : <div className="cx-card-body">{run.text || (run.status === 'running' ? 'Aguardando a resposta…' : 'Sem conteúdo.')}</div>}
        <footer className="cx-card-foot">
          <span>{run.model}</span>
          <span>{((run.elapsed_ms || run.elapsedMs || 0) / 1000).toFixed(1)}s</span>
        </footer>
      </article>;
    })}
  </section>;
}
