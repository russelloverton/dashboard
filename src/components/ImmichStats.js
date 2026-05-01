'use client';

import { usePolling } from '@/hooks/usePolling';
import { formatBytes } from '@/lib/utils';
import { IconCamera, IconFilm, IconHardDrive } from '@/lib/icons';

export default function ImmichStats() {
  const { data, error, loading } = usePolling('/api/immich', 60 * 60 * 1000);

  if (loading && !data) return <div className="panel panel-compact"><div className="p-empty">Loading…</div></div>;
  if (error && !data) return <div className="panel panel-compact"><div className="p-empty">Immich offline</div></div>;

  return (
    <div className="panel panel-compact">
      <div className="imm-row">
        <span className="imm-item"><IconCamera size={13} />{(data?.photos || 0).toLocaleString()}</span>
        <span className="imm-item"><IconFilm size={13} />{(data?.videos || 0).toLocaleString()}</span>
        <span className="imm-item"><IconHardDrive size={13} />{formatBytes(data?.usage || 0)}</span>
      </div>
    </div>
  );
}
