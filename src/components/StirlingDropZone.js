'use client';

import { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { IconUpload } from '@/lib/icons';

export default function StirlingDropZone() {
  const config = useConfig();
  const [over, setOver] = useState(false);
  const url = config?.external_urls?.stirling || 'https://pdf.squidball.xyz';

  return (
    <div className="panel panel-compact">
      <div className={`stir-zone${over ? ' stir-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); window.open(url, '_blank'); }}
        onClick={() => window.open(url, '_blank')} role="button" tabIndex={0}>
        <IconUpload size={14} />
        <span>PDF → Stirling</span>
      </div>
    </div>
  );
}
