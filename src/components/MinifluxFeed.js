'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { timeAgo } from '@/lib/utils';

export default function MinifluxFeed() {
  const config = useConfig();
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const rssUrl = config?.external_urls?.nextflux || 'https://rss.squidball.xyz';

  useEffect(() => {
    fetch('/api/miniflux/categories').then(r => r.json()).then(d => { if (Array.isArray(d)) setCategories(d); }).catch(() => {});
  }, []);

  const fetchEntries = useCallback(async () => {
    try {
      const url = activeCat ? `/api/miniflux/entries?category_id=${activeCat}` : '/api/miniflux/entries';
      const res = await fetch(url);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setEntries(d.entries || []); setTotal(d.total || 0); setError(null);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [activeCat]);

  useEffect(() => {
    fetchEntries();
    const t = setInterval(fetchEntries, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchEntries]);

  if (loading && !entries.length) return <div className="panel"><div className="p-label">Headlines</div><div className="p-empty">Loading…</div></div>;
  if (error && !entries.length) return <div className="panel"><div className="p-label">Headlines</div><div className="p-empty">Feed unavailable</div></div>;

  return (
    <div className="panel panel-feed">
      <div className="p-label">Headlines {total > 0 && <span className="feed-count">{total}</span>}</div>
      {categories.length > 0 && (
        <div className="feed-cats">
          <button className={`fc${!activeCat ? ' fc-on' : ''}`} onClick={() => setActiveCat(null)}>All</button>
          {categories.map(c => <button key={c.id} className={`fc${activeCat === c.id ? ' fc-on' : ''}`} onClick={() => setActiveCat(c.id)}>{c.title}</button>)}
        </div>
      )}
      <div className="feed-scroll">
        {entries.map(e => (
          <a key={e.id} className="feed-row" href={`${rssUrl}/feed/${e.feed_id}/article/${e.id}`} target="_blank" rel="noopener noreferrer">
            <span className="feed-title">{e.title}</span>
            <span className="feed-meta"><span className="feed-src">{e.feed_title}</span> · {timeAgo(e.published_at)}</span>
          </a>
        ))}
        {!entries.length && <div className="p-empty">All caught up</div>}
      </div>
    </div>
  );
}
