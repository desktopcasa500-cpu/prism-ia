export default function ThinkingPanel({ summary, elapsedMs = 0, status = 'idle', defaultOpen = false }) {
  if (!summary && status === 'idle') return null;
  return <details className="cx-thinking" open={defaultOpen || status === 'running'}>
    <summary>
      <span className="cx-thinking-glyph">∴</span>
      <span className="cx-thinking-label">{status === 'running' ? 'ANALISANDO' : 'THINKING'}</span>
      <span className="cx-thinking-time">{(elapsedMs / 1000).toFixed(1)}s</span>
      <span className="cx-thinking-chevron">⌄</span>
    </summary>
    <div className="cx-thinking-body">{summary || 'Processando análise de alto nível…'}</div>
  </details>;
}
