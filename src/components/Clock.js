'use client';

import { useState, useEffect } from 'react';
import { useConfig } from '@/hooks/useConfig';

/**
 * Compact inline clock — sits in the dashboard header bar.
 * Uses tabular-nums to prevent jitter on width changes.
 */
export default function Clock() {
  const config = useConfig();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const format24 = config?.dashboard?.clock_format === 24;

  const h = time.getHours();
  const m = time.getMinutes().toString().padStart(2, '0');
  const s = time.getSeconds().toString().padStart(2, '0');

  let timeStr;
  let period = '';
  if (format24) {
    timeStr = `${h.toString().padStart(2, '0')}:${m}`;
  } else {
    period = h >= 12 ? ' PM' : ' AM';
    const h12 = h % 12 || 12;
    timeStr = `${h12}:${m}`;
  }

  const dateStr = time.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="header-clock" id="widget-clock">
      <span className="header-clock-time">
        {timeStr}
        <span className="header-clock-sec">:{s}</span>
        {period && <span className="header-clock-period">{period}</span>}
      </span>
      <span className="header-clock-divider">·</span>
      <span className="header-clock-date">{dateStr}</span>
    </div>
  );
}
