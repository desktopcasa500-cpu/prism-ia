import { useCallback, useRef, useState } from 'react';
import { api } from './api.js';

const DEFAULTS = [
  { id: 'anthropic', label: 'Anthropic', model: 'claude-3-7-sonnet-latest' },
  { id: 'openai', label: 'OpenAI', model: 'gpt-4.1' },
  { id: 'gemini', label: 'Gemini', model: 'gemini-2.5-pro' },
];

export function useParallelModels(initial = DEFAULTS) {
  const [models, setModels] = useState(initial);
  const [runs, setRuns] = useState({});
  const [running, setRunning] = useState(false);
  const abortRef = useRef(null);

  const setModelEnabled = useCallback((id, enabled) => {
    setModels((current) => current.map((item) => item.id === id ? { ...item, enabled } : item));
  }, []);

  const send = useCallback(async ({ sessionId, prompt, effort = 'high', context = '', mcpServerIds = [] }) => {
    const selected = models.filter((item) => item.enabled !== false);
    if (!selected.length) throw new Error('Ative pelo menos um modelo.');
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    const started = performance.now();
    setRuns(Object.fromEntries(selected.map((item) => [item.id, {
      provider: item.id,
      label: item.label,
      model: item.model,
      status: 'running',
      text: '',
      thinking: '',
      elapsedMs: 0,
      error: null,
    }])));

    try {
      const tasks = selected.map(async (item) => {
        const result = await api.post('/chat/parallel', {
          sessionId,
          content: prompt,
          effort,
          context,
          models: [{ provider: item.id, model: item.model }],
          mcpServerIds,
        }, { timeout: 180000, signal: controller.signal });
        return { ...result.results?.[0], provider: item.id, label: item.label, model: item.model, elapsedMs: performance.now() - started };
      });

      const settled = await Promise.allSettled(tasks);
      const next = {};
      settled.forEach((entry, index) => {
        const item = selected[index];
        if (entry.status === 'fulfilled') {
          next[item.id] = { ...runs[item.id], ...entry.value, status: 'completed', elapsedMs: entry.value?.elapsedMs || performance.now() - started };
        } else {
          next[item.id] = { ...runs[item.id], status: entry.reason?.name === 'AbortError' ? 'cancelled' : 'error', error: entry.reason?.message || 'Falha no provedor', elapsedMs: performance.now() - started };
        }
      });
      setRuns(next);
      return next;
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [models, runs]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { models, setModels, setModelEnabled, runs, running, send, stop };
}
