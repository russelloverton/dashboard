'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { usePolling } from '@/hooks/usePolling';
import { useConfig } from '@/hooks/useConfig';
import { WeatherIcon, IconDroplet, IconWind, IconSearch } from '@/lib/icons';
import { weatherCodeToText, formatTemp } from '@/lib/utils';

export default function Weather() {
  const config = useConfig();
  const [tab, setTab] = useState('today');
  const [selectedDay, setSelectedDay] = useState(null);
  const [location, setLocation] = useState(null); // { name, lat, lon }
  const [isEditingLoc, setIsEditingLoc] = useState(false);
  const searchRef = useRef(null);

  // Load saved location on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('weather_loc');
      if (saved) setLocation(JSON.parse(saved));
    } catch(e){}
  }, []);

  const lat = location?.lat || '';
  const lon = location?.lon || '';
  const queryUrl = (lat && lon) ? `/api/weather?lat=${lat}&lon=${lon}` : '/api/weather';
  
  const { data, error, loading } = usePolling(queryUrl, 15 * 60 * 1000);
  const unit = config?.weather?.units || 'fahrenheit';
  const format24 = config?.dashboard?.clock_format === 24;

  const handleSearch = async (e) => {
    e.preventDefault();
    const query = searchRef.current?.value?.trim();
    if (!query) {
      setIsEditingLoc(false);
      return;
    }
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1`);
      const geo = await res.json();
      if (geo.results?.[0]) {
        const result = geo.results[0];
        const newLoc = { 
          name: `${result.name}${result.admin1 ? `, ${result.admin1}` : ''}`,
          lat: result.latitude,
          lon: result.longitude 
        };
        setLocation(newLoc);
        localStorage.setItem('weather_loc', JSON.stringify(newLoc));
      }
    } catch(e) {
      console.error('Geocoding failed', e);
    }
    setIsEditingLoc(false);
  };

  if ((loading && !data) || (error && !data)) {
    return (
      <div className="weather-hero">
        <div className="weather-hero-placeholder">{loading ? 'Loading weather…' : 'Weather unavailable'}</div>
      </div>
    );
  }

  const current = data?.current;
  const minutely_15 = data?.minutely_15;
  const daily = data?.daily;
  const displayName = location?.name || config?.weather?.location_name || 'Set Location';

  return (
    <div className="weather-hero">
      {/* Current conditions row */}
      <div className="wh-current">
        <div className="wh-temp-group">
          <WeatherIcon code={current?.weather_code} size={38} className="wh-icon" />
          <div className="wh-temp-col">
            {isEditingLoc ? (
              <form onSubmit={handleSearch} className="wh-loc-form">
                <IconSearch size={10} className="wh-loc-icon" />
                <input ref={searchRef} type="text" className="wh-loc-input" placeholder="City or Zip..." autoFocus onBlur={() => setTimeout(() => setIsEditingLoc(false), 150)} />
              </form>
            ) : (
              <span className="wh-location" onClick={() => setIsEditingLoc(true)} title="Click to change location">{displayName}</span>
            )}
            <span className="wh-temp">{formatTemp(current?.temperature_2m, unit)}</span>
          </div>
        </div>
        <div className="wh-meta">
          <span className="wh-desc">{weatherCodeToText(current?.weather_code)}</span>
          <span className="wh-feels">Feels {formatTemp(current?.apparent_temperature, unit)}</span>
        </div>
        <div className="wh-stats">
          <span><IconWind size={12} /> {Math.round(current?.wind_speed_10m || 0)} {unit === 'celsius' ? 'km/h' : 'mph'}</span>
          <span><IconDroplet size={12} /> {current?.relative_humidity_2m}%</span>
          <span>UV {current?.uv_index ?? '—'}</span>
          <span>↑{formatTemp(daily?.temperature_2m_max?.[0], unit)} ↓{formatTemp(daily?.temperature_2m_min?.[0], unit)}</span>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="wh-tabs">
        <button className={`wh-tab ${tab === 'today' && !selectedDay ? 'on' : ''}`} onClick={() => { setTab('today'); setSelectedDay(null); }}>Today</button>
        <button className={`wh-tab ${tab === 'week' || selectedDay ? 'on' : ''}`} onClick={() => { setTab('week'); setSelectedDay(null); }}>This week</button>
      </div>

      {/* Tab content */}
      {tab === 'today'
        ? <TodayChart minutely_15={minutely_15} selectedDay={selectedDay} unit={unit} format24={format24} />
        : <WeekList daily={daily} unit={unit} onSelectDay={(d) => { setSelectedDay(d); setTab('today'); }} />
      }
    </div>
  );
}

/* ── Today: dual-axis line chart (temp line + precip bars) ── */
function TodayChart({ minutely_15, selectedDay, unit, format24 }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const chartData = useMemo(() => {
    if (!minutely_15?.time) return null;
    const now = new Date();
    let start, end;
    
    if (selectedDay) {
      // Find start of selected day
      const targetDate = new Date(selectedDay);
      targetDate.setHours(0, 0, 0, 0);
      start = minutely_15.time.findIndex(t => new Date(t) >= targetDate);
      if (start === -1) start = 0;
      end = Math.min(start + 96, minutely_15.time.length); // 24 hours * 4
    } else {
      // Live 'today' view
      start = minutely_15.time.findIndex(t => new Date(t) >= now);
      if (start === -1) start = 0;
      if (start >= 2) start -= 2; // start 30 minutes before now
      else if (start === 1) start -= 1;
      end = Math.min(start + 72, minutely_15.time.length); // 18 hours * 4
    }

    return {
      times: minutely_15.time.slice(start, end),
      temps: minutely_15.temperature_2m.slice(start, end),
      precips: minutely_15.precipitation_probability.slice(start, end),
    };
  }, [minutely_15, selectedDay]);

  if (!chartData || chartData.temps.length < 3) return null;

  const { times, temps, precips } = chartData;
  const W = 580, H = 150;
  const PAD = { t: 20, b: 22, l: 8, r: 8 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const tMin = Math.min(...temps) - 1;
  const tMax = Math.max(...temps) + 1;
  const tRange = tMax - tMin || 1;

  const xOf = (i) => PAD.l + (i / (temps.length - 1)) * plotW;
  const yOf = (t) => PAD.t + (1 - (t - tMin) / tRange) * plotH;

  // Catmull-Rom to Bezier for perfectly smooth curves
  const getSpline = (points) => {
    if (points.length < 2) return '';
    let d = `M${points[0].x},${points[0].y}`;
    const tension = 0.15; // smoothness factor
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? i : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  };

  const pts = temps.map((t, i) => ({ x: xOf(i), y: yOf(t) }));
  const lineD = getSpline(pts);
  const areaD = `${lineD} L${xOf(temps.length - 1)},${PAD.t + plotH} L${xOf(0)},${PAD.t + plotH} Z`;

  // Time formatting (Forced 12-hour format for chart readability)
  const fmtTime = (iso, includeMin) => {
    const d = new Date(iso);
    const m = d.getMinutes().toString().padStart(2, '0');
    const h = d.getHours();
    const h12 = h % 12 || 12;
    return `${h12}${includeMin ? `:${m}` : ''}${h >= 12 ? 'p' : 'a'}`;
  };

  // Calculate Y-axis grid lines (multiples of 10, fallback to 5)
  let gridTemps = [];
  let step = 10;
  let startGrid = Math.ceil(tMin / step) * step;
  for (let t = startGrid; t <= tMax; t += step) {
    gridTemps.push(t);
  }
  if (gridTemps.length === 0) {
    step = 5;
    startGrid = Math.ceil(tMin / step) * step;
    for (let t = startGrid; t <= tMax; t += step) {
      gridTemps.push(t);
    }
  }

  return (
    <div className="wh-chart" style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="wh-svg" onMouseLeave={() => setHoverIndex(null)}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-line)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--chart-line)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines with Y-axis labels */}
        {gridTemps.map(gt => {
          const y = yOf(gt);
          return (
            <g key={gt}>
              <line x1={PAD.l} x2={W - PAD.r - 20} y1={y} y2={y} stroke="var(--text-3)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
              <text x={W - PAD.r} y={y + 3} textAnchor="end" className="chart-time" fill="var(--text-3)">{gt}°</text>
            </g>
          );
        })}

        {/* Precip bars */}
        {precips.map((p, i) => {
          if (p <= 0) return null;
          const x = xOf(i);
          const barH = (p / 100) * plotH * 0.35;
          const bw = (plotW / temps.length) * 0.8;
          return <rect key={i} x={x - bw / 2} y={PAD.t + plotH - barH} width={bw} height={barH} rx="1" fill="var(--chart-precip)" opacity="0.4" />;
        })}

        {/* Area + smooth line */}
        <path d={areaD} fill="url(#areaFill)" />
        <path d={lineD} fill="none" stroke="var(--chart-line)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* X-Axis Time Labels - Show every 8th point (every 2 hours) */}
        {temps.map((t, i) => {
          if (i % 8 !== 0) return null;
          return <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle" className="chart-time">{fmtTime(times[i], false)}</text>;
        })}

        {/* Hover Crosshair */}
        {hoverIndex !== null && (
          <g>
            <line x1={xOf(hoverIndex)} x2={xOf(hoverIndex)} y1={PAD.t} y2={PAD.t + plotH} stroke="var(--text-3)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={xOf(hoverIndex)} cy={yOf(temps[hoverIndex])} r="3.5" fill="var(--bg-color)" stroke="var(--chart-line)" strokeWidth="2" />
          </g>
        )}

        {/* Invisible Hit Zones */}
        {temps.map((t, i) => (
          <rect 
            key={`hit-${i}`} 
            x={xOf(i) - (plotW / temps.length) / 2} 
            y={0} 
            width={plotW / temps.length} 
            height={H} 
            fill="transparent" 
            onMouseEnter={() => setHoverIndex(i)}
            style={{ cursor: 'crosshair' }}
          />
        ))}
      </svg>
      
      {/* HTML Tooltip Overlay */}
      {hoverIndex !== null && (
        <div 
          className="wh-tooltip" 
          style={{ 
            left: `${(xOf(hoverIndex) / W) * 100}%`, 
            top: `${(yOf(temps[hoverIndex]) / H) * 100}%` 
          }}
        >
          <div className="wht-time">{fmtTime(times[hoverIndex], true)}</div>
          <div className="wht-temp">{Math.round(temps[hoverIndex])}°</div>
          {precips[hoverIndex] > 0 && <div className="wht-precip"><IconDroplet size={10} /> {precips[hoverIndex]}%</div>}
        </div>
      )}
    </div>
  );
}

/* ── Week: compact list with temp range bars ── */
function WeekList({ daily, unit, onSelectDay }) {
  if (!daily?.time) return null;
  const days = daily.time.slice(0, 7);
  const allMin = Math.min(...(daily.temperature_2m_min || []));
  const allMax = Math.max(...(daily.temperature_2m_max || []));
  const range = allMax - allMin || 1;

  return (
    <div className="wh-week">
      {days.map((d, i) => {
        const dt = new Date(d);
        const isToday = i === 0;
        const lo = daily.temperature_2m_min[i];
        const hi = daily.temperature_2m_max[i];
        const pct = daily.precipitation_probability_max?.[i] || 0;
        const left = ((lo - allMin) / range) * 100;
        const width = Math.max(((hi - lo) / range) * 100, 3);
        return (
          <div key={d} className={`wk-row${isToday ? ' wk-today' : ''}`} onClick={() => onSelectDay(d)} style={{ cursor: 'pointer' }}>
            <span className="wk-day">{isToday ? 'Today' : dt.toLocaleDateString('en-US', { weekday: 'short' })}</span>
            <WeatherIcon code={daily.weather_code?.[i]} size={14} className="wk-icon" />
            <span className="wk-lo">{formatTemp(lo, unit)}</span>
            <div className="wk-bar"><div className="wk-fill" style={{ left: `${left}%`, width: `${width}%` }} /></div>
            <span className="wk-hi">{formatTemp(hi, unit)}</span>
            {pct > 0 ? <span className="wk-pct"><IconDroplet size={9} />{pct}%</span> : <span className="wk-pct" />}
          </div>
        );
      })}
    </div>
  );
}
