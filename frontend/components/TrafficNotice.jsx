import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function TrafficNotice() {
  const [traffic, setTraffic] = useState(null);
  useEffect(() => {
    let active = true;
    let timer;
    const load = async () => {
      try { const result = await api.get('/traffic'); if (active) setTraffic(result); }
      catch { if (active) setTraffic(null); }
      if (active) timer = window.setTimeout(load, 10_000);
    };
    load();
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, []);
  if (!traffic?.warning) return null;
  return <div role="status" style={{ position: 'fixed', zIndex: 120, left: '50%', top: 66, transform: 'translateX(-50%)', maxWidth: 'min(760px, calc(100vw - 32px))', display: 'flex', flexDirection: 'column', gap: 3, padding: '9px 12px', border: '1px solid #6a522f', borderRadius: 9, background: '#201a14', color: '#eed29b', boxShadow: '0 12px 30px rgba(0,0,0,.25)', fontSize: 12 }}><strong>{traffic.warning}</strong><span style={{ color: '#a9967d', fontSize: 11 }}>{traffic.priority}</span></div>;
}
