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
        <span aria-hidden="true">◐</span>
        <span>{selected.label}</span>
      </summary>
      <div className="prism-thinking-menu" role="menu">
        <div className="prism-thinking-menu__title">Pensamento</div>
        {OPTIONS.map((item) => {
          const locked = item.id === 'ultracode' && rank < 4;
          return (
            <button
              key={item.id}
              type="button"
              className={item.id === value ? 'active' : ''}
              disabled={disabled || locked}
              onClick={() => onChange?.(item.id)}
            >
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
              {locked ? <b>Upgrade</b> : item.id === value ? <b>Atual</b> : null}
            </button>
          );
        })}
      </div>
    </details>
  );
}
