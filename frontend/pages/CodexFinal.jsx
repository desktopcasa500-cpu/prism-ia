import { useEffect, useMemo, useState } from 'react';
import CodexStable from './CodexStable.jsx';
import './codex-final.css';

export default function CodexFinal() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const className = useMemo(() => `codex-final ${mounted ? 'is-ready' : ''}`, [mounted]);
  return <div className={className}><CodexStable /></div>;
}
