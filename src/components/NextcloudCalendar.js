'use client';

import { usePolling } from '@/hooks/usePolling';
import { IconArrowUpRight } from '@/lib/icons';

export default function NextcloudCalendar() {
  const { data, error, loading } = usePolling('/api/calendar', 10 * 60 * 1000);

  if (loading && !data) return <div className="panel"><div className="p-label">Calendar</div><div className="p-empty">Loading…</div></div>;
  if (error && !data) return <div className="panel"><div className="p-label">Calendar</div><div className="p-empty">Unavailable</div></div>;

  const events = Array.isArray(data) ? data : [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const grouped = {};
  events.forEach(ev => {
    const key = new Date(ev.start).toDateString();
    if (!grouped[key]) grouped[key] = { date: new Date(ev.start), events: [] };
    grouped[key].events.push(ev);
  });
  const days = Object.values(grouped).sort((a, b) => a.date - b.date);

  const fmtTime = (s, e, allDay) => {
    if (allDay) return 'All day';
    const f = d => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${f(s)} – ${f(e)}`;
  };

  return (
    <div className="panel">
      <div className="p-label">Calendar</div>
      <div className="cal-scroll">
        {days.length === 0 && <div className="p-empty">Nothing upcoming</div>}
        {days.map(day => (
          <div key={day.date.toISOString()} className="cal-day">
            <div className={`cal-dh${day.date.toDateString() === today.toDateString() ? ' cal-today' : ''}`}>
              {day.date.toDateString() === today.toDateString() ? 'Today' : day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            {day.events.map((ev, i) => (
              <div key={i} className="cal-ev">
                <span className="cal-dot" style={{ background: ev.calendarColor || 'var(--accent)' }} />
                <div className="cal-ev-body">
                  <span className="cal-ev-title">{ev.title}</span>
                  <span className="cal-ev-time">{fmtTime(ev.start, ev.end, ev.allDay)}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
