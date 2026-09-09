import PrismCodexIntroBrutalist from './PrismCodexIntroBrutalist.jsx';

export default function TaffPresentation() {
  const close = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  };

  return <PrismCodexIntroBrutalist onComplete={close} />;
}
