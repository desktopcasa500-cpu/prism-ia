import PrismIcon from './PrismIcon.jsx';

export default function WorkspaceThemeButton({ theme, mode = 'system', onToggle }) {
  const label = mode === 'system' ? 'sistema' : mode === 'dark' ? 'escuro' : 'claro';
  return (
    <button
      className="prism-agent-theme-toggle"
      type="button"
      onClick={onToggle}
      aria-label={'Tema: ' + label}
      title={'Tema: ' + label}
    >
      <PrismIcon name={theme === 'dark' ? 'moon' : 'sun'} size={14} />
    </button>
  );
}
