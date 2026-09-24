import { useEffect, useState } from 'react';

const STORAGE_KEY = 'prism-workspace-theme';

function systemTheme() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readMode() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  } catch {
    return 'system';
  }
}

export function useWorkspaceTheme() {
  const [mode, setMode] = useState(readMode);
  const [system, setSystem] = useState(systemTheme);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
  }, [mode]);

  useEffect(() => {
    if (mode !== 'system') return undefined;
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;
    const update = () => setSystem(media.matches ? 'dark' : 'light');
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, [mode]);

  const theme = mode === 'system' ? system : mode;
  const cycleMode = () => setMode((current) => (
    current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system'
  ));

  return { mode, theme, cycleMode };
}
