import { useEffect } from 'react';

export const INTRO_KEY = 'prism_codex_intro_v9_seen';

/**
 * Compatibility shim: the Codex presentation is opened explicitly
 * from the sidebar, so it must never block the workspace on startup.
 */
export default function PrismCodexIntro({ onComplete }) {
  useEffect(() => {
    onComplete?.();
  }, [onComplete]);

  return null;
}
