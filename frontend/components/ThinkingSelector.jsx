import { useEffect, useRef, useState } from 'react';

const OPTIONS = [
  { id: 'low', label: 'Rápido', detail: 'Menor latência' },
  { id: 'medium', label: 'Equilibrado', detail: 'Qualidade e velocidade' },
  { id: 'high', label: 'Profundo', detail: 'Mais análise e contexto' },
  { id: 'max', label: 'Máximo', detail: 'Prioriza o raciocínio' },
  { id: 'ultracode', label: 'Ultracode', detail: 'Máximo para programação', rank: 4 },
];

const LABELS = Object.fromEntries(OPTIONS.map((option) => [option.id, option.label]));

export default function ThinkingSelector({ value = 'medium', onChange, rank = 0, disabled = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = OPTIONS.find((option) => option.id === value) || OPTIONS[1];

  useEffect(() => {
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  function choose(option) {
    if (option.rank !== undefined && rank < option.rank) return;
    onChange?.(option.id);
    setOpen(false);
  }

  return (
    <div className="prism-thinking-wrap" ref={rootRef}>
      <button
        type="button"
        className="prism-thinking-trigger"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Nível de pensamento"
      >
        <span className="prism-thinking-icon" aria-hidden="true">✦</span>
        <span>Pensamento</span>
        <strong>{LABELS[selected.id]}</strong>
        <span className="prism-thinking-chevron" aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div className="prism-thinking-menu" role="menu" aria-label="Nível de pensamento">
          <div className="prism-thinking-menu__head">
            <strong>Nível de pensamento</strong>
            <span>Controla quanto o modelo analisa antes de responder.</span>
          </div>
          {OPTIONS.map((option) => {
            const locked = option.rank !== undefined && rank < option.rank;
            return (
              <button
                type="button"
                key={option.id}
                role="menuitem"
                className={`prism-thinking-option ${option.id === selected.id ? 'active' : ''}`}
                onClick={() => choose(option)}
                disabled={disabled || locked}
              >
                <span className="prism-thinking-option__copy">
                  <strong>{option.label}</strong>
                  <small>{option.detail}</small>
                </span>
                <span className="prism-thinking-option__state">{locked ? 'Upgrade' : option.id === selected.id ? 'Atual' : ''}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
