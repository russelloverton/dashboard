'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { usePolling } from '@/hooks/usePolling';
import { useConfig } from '@/hooks/useConfig';
import { WeatherIcon, IconDroplet, IconWind, IconSearch } from '@/lib/icons';
import { weatherCodeToText, formatTemp } from '@/lib/utils';

export default function Weather() {
  const config = useConfig();
  const [tab, setTab] = useState('today');
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
  const hourly = data?.hourly;
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
        <button className={`wh-tab ${tab === 'today' ? 'on' : ''}`} onClick={() => setTab('today')}>Today</button>
        <button className={`wh-tab ${tab === 'week' ? 'on' : ''}`} onClick={() => setTab('week')}>This week</button>
      </div>

      {/* Tab content */}
      {tab === 'today'
        ? <TodayChart hourly={hourly} unit={unit} format24={format24} />
        : <WeekList daily={daily} unit={unit} />
      }
    </div>
  );
}

/* ── Today: dual-axis line chart (temp line + precip bars) ── */
function TodayChart({ hourly, unit, format24 }) {
  const chartData = useMemo(() => {
    if (!hourly?.time) return null;
    const now = new Date();
    const start = hourly.time.findIndex(t => new Date(t) >= now);
    const end = Math.min(start + 18, hourly.time.length);
    return {
      times: hourly.time.slice(start, end),
      temps: hourly.temperature_2m.slice(start, end),
      precips: hourly.precipitation_probability.slice(start, end),
    };
  }, [hourly]);

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

  // Smooth curve via monotone cubic interpolation points
  const lineD = temps.map((t, i) => {
    const x = xOf(i);
    const y = yOf(t);
    return i === 0 ? `M${x},${y}` : `L${x},${y}`;
  }).join(' ');

  // Area fill
  const areaD = `${lineD} L${xOf(temps.length - 1)},${PAD.t + plotH} L${xOf(0)},${PAD.t + plotH} Z`;

  // Time labels (show every 3rd)
  const fmtHr = (iso) => {
    const d = new Date(iso);
    if (format24) return `${d.getHours().toString().padStart(2, '0')}:00`;
    const h = d.getHours();
    const h12 = h % 12 || 12;
    return `${h12}${h >= 12 ? 'p' : 'a'}`;
  };

  return (
    <div className="wh-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="wh-svg">
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-line)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--chart-line)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + f * plotH} y2={PAD.t + f * plotH} stroke="var(--grid-line)" strokeWidth="0.5" />
        ))}

        {/* Precip bars */}
        {precips.map((p, i) => {
          if (p <= 0) return null;
          const x = xOf(i);
          const barH = (p / 100) * plotH * 0.35;
          const bw = plotW / temps.length * 0.55;
          return <rect key={i} x={x - bw / 2} y={PAD.t + plotH - barH} width={bw} height={barH} rx="1.5" fill="var(--chart-precip)" opacity="0.55" />;
        })}

        {/* Area + line */}
        <path d={areaD} fill="url(#areaFill)" />
        <path d={lineD} fill="none" stroke="var(--chart-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points + labels every 3rd */}
        {temps.map((t, i) => {
          const x = xOf(i);
          const y = yOf(t);
          const show = i % 3 === 0;
          return show && (
            <g key={i}>
              <circle cx={x} cy={y} r="2.5" fill="var(--chart-line)" />
              <text x={x} y={y - 8} textAnchor="middle" className="chart-label">{Math.round(t)}°</text>
              <text x={x} y={H - 4} textAnchor="middle" className="chart-time">{fmtHr(times[i])}</text>
            </g>
          );
        })}

        {/* Precip labels where significant */}
        {precips.map((p, i) => {
          if (p < 10 || i % 3 !== 0) return null;
          const x = xOf(i);
          const barH = (p / 100) * plotH * 0.35;
          return <text key={`p${i}`} x={x} y={PAD.t + plotH - barH - 4} textAnchor="middle" className="chart-precip-label">{p}%</text>;
        })}
      </svg>
    </div>
  );
}

/* ── Week: compact list with temp range bars ── */
function WeekList({ daily, unit }) {
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
          <div key={d} className={`wk-row${isToday ? ' wk-today' : ''}`}>
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
