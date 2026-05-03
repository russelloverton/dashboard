'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { usePolling } from '@/hooks/usePolling';
import { useConfig } from '@/hooks/useConfig';
import { IconCheck, IconPlay, IconCircle, IconArrowUpRight, IconPlus } from '@/lib/icons';

function formatDueDate(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor((d - now) / 86400000);
  if (diff < 0) return { label: 'Overdue', cls: 'tk-due-overdue' };
  if (diff === 0) return { label: 'Today', cls: 'tk-due-today' };
  if (diff === 1) return { label: 'Tomorrow', cls: 'tk-due-tomorrow' };
  if (diff < 7) return { label: d.toLocaleDateString('en-US', { weekday: 'short' }), cls: 'tk-due-week' };
  return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), cls: 'tk-due-later' };
}

export default function SuperProductivity() {
  const config = useConfig();
  const { data, error, loading, refetch } = usePolling('/api/tasks', 2 * 60 * 1000);
  const spUrl = config?.external_urls?.super_productivity || 'https://tasks.squidball.xyz';

  const [newTask, setNewTask] = useState('');
  const [creating, setCreating] = useState(false);
  const [writeError, setWriteError] = useState(null);
  // optimistic overrides: id → isDone value while the server request is in-flight
  const [optimistic, setOptimistic] = useState({});
  const [showDone, setShowDone] = useState(false);
  const [filterProject, setFilterProject] = useState(null); // null = show all
  const inputRef = useRef(null);

  const toggleTask = useCallback(async (id, currentDone) => {
    const next = !currentDone;
    setOptimistic(prev => ({ ...prev, [id]: next }));
    setWriteError(null);
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isDone: next }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      refetch();
    } catch (e) {
      setOptimistic(prev => { const s = { ...prev }; delete s[id]; return s; });
      setWriteError('Save failed — check SP connection');
    }
  }, [refetch]);

  const createTask = useCallback(async (e) => {
    e.preventDefault();
    const raw = newTask.trim();
    if (!raw) return;
    setCreating(true);
    setWriteError(null);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setNewTask('');
      refetch();
    } catch (e) {
      setWriteError('Could not add task — check SP connection');
    } finally {
      setCreating(false);
    }
  }, [newTask, refetch]);

  const allTasks = useMemo(() => (data?.tasks || []).map(t =>
    t.id in optimistic ? { ...t, isDone: optimistic[t.id] } : t
  ), [data, optimistic]);

  if (loading && !data) return <div className="panel"><div className="p-label">Tasks</div><div className="p-empty">Loading…</div></div>;
  if (error && !data) return <div className="panel"><a href={spUrl} target="_blank" rel="noopener noreferrer" className="p-label p-link">Tasks <IconArrowUpRight size={10} /></a><div className="p-empty">Unavailable</div></div>;

  const projects = data?.projects || [];
  const undone = allTasks.filter(t => !t.isDone);
  const done = allTasks.filter(t => t.isDone);

  // Apply project filter
  let filtered = showDone ? allTasks : undone;
  if (filterProject) {
    filtered = filtered.filter(t => t.projectId === filterProject);
  }

  const MAX_VISIBLE = 7;
  const overflow = filtered.length > MAX_VISIBLE;
  const visibleTasks = filtered.slice(0, MAX_VISIBLE);

  return (
    <div className="panel">
      <div className="p-head">
        <a href={spUrl} target="_blank" rel="noopener noreferrer" className="p-label p-link" style={{ marginBottom: 0 }}>
          Tasks {undone.length > 0 && <span className="feed-count">{undone.length}</span>} <IconArrowUpRight size={10} />
        </a>
        {done.length > 0 && (
          <button
            className="tk-toggle-done"
            onClick={() => setShowDone(!showDone)}
            title={showDone ? 'Hide completed' : 'Show completed'}
          >
            {showDone ? 'Hide done' : `${done.length} done`}
          </button>
        )}
      </div>

      {/* Project filter pills */}
      {projects.length > 1 && (
        <div className="tk-projects">
          <button
            className={`fc${!filterProject ? ' fc-on' : ''}`}
            onClick={() => setFilterProject(null)}
          >All</button>
          {projects.map(p => (
            <button
              key={p.id}
              className={`fc${filterProject === p.id ? ' fc-on' : ''}`}
              onClick={() => setFilterProject(filterProject === p.id ? null : p.id)}
            >{p.name}</button>
          ))}
        </div>
      )}

      {writeError && <div className="tk-write-error">{writeError}</div>}
      <div className="tasks-scroll">
        {visibleTasks.length === 0 && <div className="p-empty">All clear ✨</div>}
        {visibleTasks.map(t => {
          const due = formatDueDate(t.plannedAt);
          const pending = t.id in optimistic;
          return (
            <div key={t.id} className={`tk${t.inProgress ? ' tk-active' : ''}${t.isDone ? ' tk-done' : ''}`}>
              <button
                className={`tk-icon${t.isDone ? ' tk-icon-done' : ''}`}
                onClick={() => toggleTask(t.id, t.isDone)}
                disabled={pending}
                title={t.isDone ? 'Mark undone' : 'Mark done'}
                style={{ cursor: 'pointer', border: 'none' }}
              >
                {pending
                  ? <span className="tk-spinner" />
                  : t.isDone ? <IconCheck size={10} />
                  : t.inProgress ? <IconPlay size={8} />
                  : <IconCircle size={10} />
                }
              </button>
              <span className="tk-text">{t.title}</span>
              {t.projectName && !filterProject && (
                <span className="tk-project">{t.projectName}</span>
              )}
              {due && <span className={`tk-due ${due.cls}`}>{due.label}</span>}
            </div>
          );
        })}
        {overflow && (
          <a href={spUrl} target="_blank" rel="noopener noreferrer" className="tk-overflow">
            +{filtered.length - MAX_VISIBLE} more in Super Productivity →
          </a>
        )}
      </div>

      {/* Quick-add input — supports SP short syntax */}
      <form className="tk-add" onSubmit={createTask}>
        <IconPlus size={14} />
        <input
          ref={inputRef}
          className="tk-add-input"
          type="text"
          placeholder="Add task…  +Project #tag 30m"
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          disabled={creating}
        />
      </form>
    </div>
  );
}
