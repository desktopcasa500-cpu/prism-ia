const WINDOW_MS = 60_000;
const MAX_QUEUE = 100;
const DEFAULT_RPM_LIMIT = Math.max(10, Number(process.env.PRISM_RPM_LIMIT || 120));
const PLAN_PRIORITY = Object.freeze({ free: 0, 'Grátis': 0, base: 1, Base: 1, medium: 2, Medium: 2, pro: 3, Pro: 3, enterprise: 4, Empresarial: 4 });

const recentStarts = [];
const activeRequests = new Set();
const waiters = [];

function now() { return Date.now(); }
function prune() {
  const cutoff = now() - WINDOW_MS;
  while (recentStarts.length && recentStarts[0] < cutoff) recentStarts.shift();
}
function priorityOf(plan) { return PLAN_PRIORITY[plan] ?? 0; }
function levelFor(rpm, limit) {
  if (rpm >= limit) return 'critical';
  if (rpm >= limit * 0.85) return 'high';
  if (rpm >= limit * 0.70) return 'elevated';
  return 'normal';
}
function sortQueue(a, b) {
  if (a.priority !== b.priority) return b.priority - a.priority;
  return a.sequence - b.sequence;
}
function processQueue() {
  while (waiters.length) {
    prune();
    const activeCap = Math.max(4, Number(process.env.PRISM_MAX_CONCURRENT_GENERATIONS || 12));
    if (activeRequests.size >= activeCap) return;
    waiters.sort(sortQueue);
    const waiter = waiters.shift();
    const token = Symbol('traffic-request');
    activeRequests.add(token);
    recentStarts.push(now());
    waiter.resolve(() => {
      if (!activeRequests.delete(token)) return;
      processQueue();
    });
  }
}

export function trafficSnapshot() {
  prune();
  const limit = DEFAULT_RPM_LIMIT;
  const rpm = recentStarts.length;
  const level = levelFor(rpm, limit);
  const queuePosition = waiters.length ? Math.max(1, waiters.slice().sort(sortQueue).findIndex((item) => item.sequence >= Number.MAX_SAFE_INTEGER) + 1) : 0;
  const etaMinutes = Math.max(0, Math.ceil(Math.max(0, activeRequests.size - 3) / 3));
  return { rpm, rpmLimit: limit, level, active: activeRequests.size, queueLength: waiters.length, etaMinutes, queuePosition };
}

export function canAcceptTraffic() {
  prune();
  return waiters.length < MAX_QUEUE;
}

export async function acquireTrafficSlot(plan) {
  prune();
  const activeCap = Math.max(4, Number(process.env.PRISM_MAX_CONCURRENT_GENERATIONS || 12));
  if (waiters.length >= MAX_QUEUE) return { ok: false, status: 503, code: 'TRAFFIC_QUEUE_FULL', error: 'Tráfego alto neste momento. Aguarde alguns minutos e tente novamente.', traffic: trafficSnapshot() };
  const token = Symbol('traffic-request');
  if (activeRequests.size < activeCap && waiters.length === 0) {
    activeRequests.add(token);
    recentStarts.push(now());
    return { ok: true, release: () => { if (!activeRequests.delete(token)) return; processQueue(); }, traffic: trafficSnapshot() };
  }
  const priority = priorityOf(plan);
  const sequence = Number(process.env.PRISM_TRAFFIC_SEQUENCE || 0) + waiters.length + recentStarts.length + activeRequests.size + 1;
  return new Promise((resolve) => {
    waiters.push({ priority, sequence, resolve });
    processQueue();
  }).then((release) => ({ ok: true, release, traffic: trafficSnapshot() }));
}

export function priorityForPlan(plan) { return priorityOf(plan); }
export function trafficStatusMessage(snapshot = trafficSnapshot()) {
  if (snapshot.level === 'critical' || snapshot.level === 'high' || snapshot.level === 'elevated') return `Tráfego alto neste momento. Aguarde ${Math.max(1, snapshot.etaMinutes)} minuto(s) ou faça upgrade para ter prioridade na fila.`;
  return '';
}
