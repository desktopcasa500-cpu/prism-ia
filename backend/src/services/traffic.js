const WINDOW_MS = 60_000;
const MAX_QUEUE = 100;
const DEFAULT_RPM_LIMIT = Math.max(10, Number(process.env.PRISM_RPM_LIMIT || 120));
const PLAN_PRIORITY = Object.freeze({ free: 0, 'Grátis': 0, base: 1, Base: 1, medium: 2, Medium: 2, pro: 3, Pro: 3, enterprise: 4, Empresarial: 4 });

const recentStarts = [];
const activeRequests = new Set();
const waiters = [];
let sequence = 0;

function now() { return Date.now(); }
function prune() { const cutoff = now() - WINDOW_MS; while (recentStarts.length && recentStarts[0] < cutoff) recentStarts.shift(); }
function priorityOf(plan) { return PLAN_PRIORITY[plan] ?? 0; }
function levelFor(rpm, limit) { if (rpm >= limit) return 'critical'; if (rpm >= limit * 0.85) return 'high'; if (rpm >= limit * 0.70) return 'elevated'; return 'normal'; }
function sortQueue(a, b) { if (a.priority !== b.priority) return b.priority - a.priority; return a.sequence - b.sequence; }
function processQueue() {
  while (waiters.length) {
    const activeCap = Math.max(4, Number(process.env.PRISM_MAX_CONCURRENT_GENERATIONS || 12));
    if (activeRequests.size >= activeCap) return;
    waiters.sort(sortQueue);
    const waiter = waiters.shift();
    const token = Symbol('traffic-request');
    activeRequests.add(token);
    recentStarts.push(now());
    waiter.resolve(() => { if (!activeRequests.delete(token)) return; processQueue(); });
  }
}

export function trafficSnapshot() {
  prune();
  const limit = DEFAULT_RPM_LIMIT;
  const rpm = recentStarts.length;
  const level = levelFor(rpm, limit);
  const queue = [...waiters].sort(sortQueue);
  const etaMinutes = Math.max(0, Math.ceil(Math.max(0, activeRequests.size - 3) / 3));
  return { rpm, rpmLimit: limit, level, active: activeRequests.size, queueLength: queue.length, etaMinutes, queuePosition: queue.length ? 1 : 0 };
}

export async function acquireTrafficSlot(plan, signal = null) {
  prune();
  const activeCap = Math.max(4, Number(process.env.PRISM_MAX_CONCURRENT_GENERATIONS || 12));
  if (signal?.aborted) return { ok: false, status: 499, code: 'TRAFFIC_REQUEST_ABORTED', error: 'Solicitação cancelada.' };
  if (waiters.length >= MAX_QUEUE) return { ok: false, status: 503, code: 'TRAFFIC_QUEUE_FULL', error: 'Tráfego alto neste momento. Aguarde alguns minutos e tente novamente.', traffic: trafficSnapshot() };
  const token = Symbol('traffic-request');
  if (activeRequests.size < activeCap && waiters.length === 0) {
    activeRequests.add(token);
    recentStarts.push(now());
    return { ok: true, release: () => { if (!activeRequests.delete(token)) return; processQueue(); }, traffic: trafficSnapshot() };
  }
  let item;
  const promise = new Promise((resolve, reject) => {
    item = { priority: priorityOf(plan), sequence: ++sequence, resolve, reject, aborted: false, onAbort: null };
    item.onAbort = () => {
      if (item.aborted) return;
      item.aborted = true;
      const index = waiters.indexOf(item);
      if (index >= 0) waiters.splice(index, 1);
      reject(Object.assign(new Error('Solicitação cancelada.'), { code: 'TRAFFIC_REQUEST_ABORTED', status: 499 }));
      processQueue();
    };
    signal?.addEventListener('abort', item.onAbort, { once: true });
    waiters.push(item);
    processQueue();
  });
  try {
    const release = await promise;
    return { ok: true, release, traffic: trafficSnapshot() };
  } finally {
    if (item?.onAbort) signal?.removeEventListener('abort', item.onAbort);
  }
}

export function priorityForPlan(plan) { return priorityOf(plan); }
export function trafficStatusMessage(snapshot = trafficSnapshot()) {
  if (['critical', 'high', 'elevated'].includes(snapshot.level)) return `Tráfego alto neste momento. Aguarde ${Math.max(1, snapshot.etaMinutes)} minuto(s) ou faça upgrade para ter prioridade na fila.`;
  return '';
}
