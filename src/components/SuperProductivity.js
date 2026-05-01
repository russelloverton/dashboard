'use client';

import { usePolling } from '@/hooks/usePolling';
import { useConfig } from '@/hooks/useConfig';
import { IconCheck, IconPlay, IconCircle, IconArrowUpRight } from '@/lib/icons';

export default function SuperProductivity() {
  const config = useConfig();
  const { data, error, loading } = usePolling('/api/tasks', 2 * 60 * 1000);
  const spUrl = config?.external_urls?.super_productivity || 'https://tasks.squidball.xyz';

  if (loading && !data) return <div className="panel"><div className="p-label">Tasks</div><div className="p-empty">Loading…</div></div>;
  if (error && !data) return <div className="panel"><a href={spUrl} target="_blank" rel="noopener noreferrer" className="p-label p-link">Tasks <IconArrowUpRight size={10} /></a><div className="p-empty">Unavailable</div></div>;

  const tasks = data?.tasks || [];

  return (
    <div className="panel">
      <a href={spUrl} target="_blank" rel="noopener noreferrer" className="p-label p-link">Tasks <IconArrowUpRight size={10} /></a>
      <div className="tasks-scroll">
        {tasks.length === 0 && <div className="p-empty">Nothing today</div>}
        {tasks.map(t => (
          <div key={t.id} className={`tk${t.inProgress ? ' tk-active' : ''}${t.isDone ? ' tk-done' : ''}`}>
            <span className={`tk-icon${t.isDone ? ' tk-icon-done' : ''}`}>
              {t.isDone ? <IconCheck size={10} /> : t.inProgress ? <IconPlay size={8} /> : <IconCircle size={10} />}
            </span>
            <span className="tk-text">{t.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
