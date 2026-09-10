import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function TrafficNotice() {
  const [traffic, setTraffic] = useState(null);
  useEffect(() => {
    let active = true;
    let timer = null;
    const load = async () => {
      try { const result = await api.get('/traffic'); if (active) setTraffic(result); } catch { if (active) setTraffic(null); }
      if (active) timer = window.setTimeout(load, 10_000);
    };
    load();
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, []);
  if (!traffic?.warning) return null;
  return <div className="prism-traffic-notice" role="status"><strong>{traffic.warning}</strong><span>{traffic.priority}</span></div>;
}
