'use client';

import { useConfig } from '@/hooks/useConfig';

/**
 * Bookmarks — inline nav items in the topbar.
 * Favicon with name, horizontally arranged.
 */
export default function Bookmarks() {
  const config = useConfig();
  const bookmarks = config?.bookmarks || [];

  return (
    <div className="bookmarks-row">
      {bookmarks.map((bm, i) => (
        <a key={`${bm.name}-${i}`} className="bm" href={bm.url} target="_blank" rel="noopener noreferrer" title={bm.name}>
          <span className="bm-letter">{bm.name.charAt(0)}</span>
          <span className="bm-name">{bm.name}</span>
        </a>
      ))}
    </div>
  );
}
