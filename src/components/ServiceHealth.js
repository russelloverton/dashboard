'use client';

import { usePolling } from '@/hooks/usePolling';
import { IconActivity } from '@/lib/icons';

export default function ServiceHealth() {
  const { data, loading } = usePolling('/api/health', 30 * 1000);
  const services = Array.isArray(data) ? data : [];

  if (loading && services.length === 0) {
    return <div className="panel"><div className="p-label"><IconActivity size={12}/> Services</div><div className="p-empty">Checking…</div></div>;
  }

  if (services.length === 0) return null;

  return (
    <div className="panel">
      <div className="p-label"><IconActivity size={12}/> Services</div>
      <div className="services-grid">
        {services.map(s => (
          <div key={s.name} className="svc-item">
            <span className={`st-dot ${s.status === 'up' ? 'dot-up' : 'dot-dn'}`} />
            <span className={`svc-name ${s.status !== 'up' ? 'svc-dn' : ''}`}>{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
