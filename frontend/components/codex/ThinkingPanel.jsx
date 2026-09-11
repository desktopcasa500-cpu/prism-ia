export default function ThinkingPanel({ summary, elapsedMs = 0, status = 'idle', defaultOpen = false }) {
  if (!summary && status === 'idle') return null;
  return <details className="pcx-thinking" open={defaultOpen || status === 'running'}>
    <summary>
      <span>{status === 'running' ? 'Pensando' : 'Resumo'}</span>
      <small>{(elapsedMs / 1000).toFixed(1)}s</small>
      <b>⌄</b>
    </summary>
    <div className="pcx-thinking-body">{summary || 'Analisando…'}</div>
  </details>;
}
