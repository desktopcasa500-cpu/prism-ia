const OPTIONS = [
  { id: 'low', label: 'Rápido', description: 'Responde com agilidade' },
  { id: 'medium', label: 'Equilibrado', description: 'Boa profundidade para a maioria das tarefas' },
  { id: 'high', label: 'Profundo', description: 'Mais análise e verificação' },
  { id: 'max', label: 'Máximo', description: 'Prioriza precisão e revisão' },
  { id: 'ultracode', label: 'Ultracode', description: 'Orquestração máxima para engenharia' },
];

export default function ThinkingSelector({ value = 'medium', onChange, rank = 0, disabled = false }) {
  const selected = OPTIONS.find((item) => item.id === value) || OPTIONS[1];
  return (
    <details className="prism-thinking-wrap">
      <summary className="prism-thinking-trigger" aria-label="Selecionar nível de pensamento">
        <span className="prism-thinking-icon" aria-hidden="true">◐</span>
        <span>{selected.label}</span>
      </summary>
      <div className="prism-thinking-menu" role="menu">
        <div className="prism-thinking-menu__head">
          <strong>Pensamento</strong>
          <span>Escolha o esforço usado pela resposta</span>
        </div>
        {OPTIONS.map((item) => {
          const locked = item.id === 'ultracode' && rank < 4;
          return (
            <button
              key={item.id}
              type="button"
              className={`prism-thinking-option ${item.id === value ? 'active' : ''}`}
              disabled={disabled || locked}
              onClick={(event) => { event.preventDefault(); onChange?.(item.id); event.currentTarget.closest('details')?.removeAttribute('open'); }}
            >
              <span className="prism-thinking-option__copy"><strong>{item.label}</strong><small>{item.description}</small></span>
              {(locked || item.id === value) ? <span className="prism-thinking-option__state">{locked ? 'Upgrade' : 'Atual'}</span> : null}
            </button>
          );
        })}
      </div>
    </details>
  );
}
