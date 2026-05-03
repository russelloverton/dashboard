'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { formatBytes } from '@/lib/utils';
import { IconCpu, IconActivity, IconHardDrive, IconArrowUpRight, IconArrowDownRight, IconClock, IconThermometer } from '@/lib/icons';

export default function SystemStats() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState({ cpu: [], mem: [] });
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const fetchAll = useCallback(async () => {
    try {
      const endpoints = ['cpu', 'mem', 'fs', 'sensors', 'network', 'load', 'uptime', 'gpu', 'diskio'];
      const responses = await Promise.all(endpoints.map(ep => fetch(`/api/glances/${ep}`)));
      const [cpu, mem, fs, sensors, network, load, uptime, gpu, diskio] = await Promise.all(responses.map(r => r.json()));
      
      if (!mountedRef.current) return;
      
      if (cpu.error && mem.error) {
        throw new Error(cpu.detail || mem.detail || 'Glances unavailable');
      }

      setData({ cpu, mem, fs, sensors, network, load, uptime, gpu, diskio });
      setHistory(prev => ({
        cpu: [...prev.cpu.slice(-59), cpu.total || 0],
        mem: [...prev.mem.slice(-59), mem.percent || 0]
      }));
      setError(null);
    } catch (e) {
      if (mountedRef.current) setError(e.message);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchAll();
    const t = setInterval(fetchAll, 5000);
    return () => { mountedRef.current = false; clearInterval(t); };
  }, [fetchAll]);

  if (error && !data) return <div className="panel"><div className="p-label"><IconCpu size={12}/> System</div><div className="p-empty">Unavailable</div></div>;
  if (!data) return <div className="panel"><div className="p-label"><IconCpu size={12}/> System</div><div className="p-empty">Loading…</div></div>;

  const disk = Array.isArray(data.fs) ? (data.fs.find(d => d.mnt_point === '/') || data.fs[0]) : null;
  const temp = Array.isArray(data.sensors) ? data.sensors.find(s =>
    s.label?.toLowerCase().includes('cpu') || s.label?.toLowerCase().includes('core') ||
    s.label?.toLowerCase().includes('package') || s.type === 'temperature_core'
  ) : null;

  // Find primary network interface — exclude loopback, pick highest traffic
  const primaryNet = Array.isArray(data.network)
    ? [...data.network]
        .filter(n => n.interface_name !== 'lo')
        .sort((a, b) => (b.bytes_all_rate_per_sec || 0) - (a.bytes_all_rate_per_sec || 0))[0]
    : null;

  // Aggregate total Disk I/O across all physical drives (ignoring loop devices)
  let ioRead = 0;
  let ioWrite = 0;
  if (Array.isArray(data.diskio)) {
    data.diskio.forEach(d => {
      if (!d.disk_name?.startsWith('loop')) {
        ioRead += (d.read_bytes_rate_per_sec || 0);
        ioWrite += (d.write_bytes_rate_per_sec || 0);
      }
    });
  }

  // Parse uptime — Glances returns a string like "2 days, 18:52:29"
  const formatUptime = (uptime) => {
    if (!uptime) return '';
    const dayMatch = uptime.match(/(\d+) days?/);
    const timeMatch = uptime.match(/(\d+):(\d+):(\d+)/);
    const d = dayMatch ? parseInt(dayMatch[1]) : 0;
    const h = timeMatch ? parseInt(timeMatch[1]) : 0;
    const m = timeMatch ? parseInt(timeMatch[2]) : 0;
    return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
  };

  const rows = [
    { label: 'CPU', pct: data.cpu?.total || 0, cls: 'bar-cpu', spark: history.cpu },
    { label: 'RAM', pct: data.mem?.percent || 0, cls: 'bar-ram', detail: `${formatBytes(data.mem?.used || 0)}/${formatBytes(data.mem?.total || 0)}` },
  ];
  
  if (Array.isArray(data.gpu) && data.gpu.length > 0) {
    data.gpu.forEach((g, i) => {
      if (g.proc !== undefined) {
        rows.push({ label: `GPU${data.gpu.length > 1 ? i : ''}`, pct: g.proc, cls: 'bar-gpu' });
      }
    });
  }

  if (disk) rows.push({ label: 'Disk', pct: disk.percent || 0, cls: 'bar-disk', detail: `${formatBytes(disk.used || 0)}/${formatBytes(disk.size || 0)}` });

  return (
    <div className="panel panel-system">
      <div className="p-head">
        <span className="p-label"><IconActivity size={12}/> mike-trout</span>
        <div className="sys-meta">
          {data.uptime && <span title="Uptime"><IconClock size={10}/> {formatUptime(data.uptime)}</span>}
          {temp && <span title="CPU Temp"><IconThermometer size={10}/> {Math.round(temp.value)}°C</span>}
        </div>
      </div>
      
      <div className="sys-bars">
        {rows.map(r => (
          <div key={r.label} className="sys-row" title={r.detail}>
            <span className="sys-label">{r.label}</span>
            <div className="sys-bar"><div className={`sys-fill ${r.cls}`} style={{ width: `${r.pct}%` }} /></div>
            <span className="sys-pct" style={{ minWidth: '36px', textAlign: 'right' }}>{Math.round(r.pct)}%</span>
          </div>
        ))}
      </div>

      <Spark data={history.cpu} />

      <div className="sys-footer">
        {data.load && (
          <div className="sys-stat-box">
            <span className="sys-stat-title">Load Avg</span>
            <span className="sys-stat-val">{data.load.min1?.toFixed(2) || '0.00'} · {data.load.min5?.toFixed(2) || '0.00'}</span>
          </div>
        )}
        {(ioRead > 0 || ioWrite > 0) && (
          <div className="sys-stat-box">
            <span className="sys-stat-title">Disk I/O</span>
            <span className="sys-stat-val">
              <IconArrowDownRight size={9} className="net-down" /> {formatBytes(ioRead)}/s
              {' '}
              <IconArrowUpRight size={9} className="net-up" /> {formatBytes(ioWrite)}/s
            </span>
          </div>
        )}
        {primaryNet && (
          <div className="sys-stat-box" style={{ marginLeft: 'auto' }}>
            <span className="sys-stat-title">Net ({primaryNet.interface_name})</span>
            <span className="sys-stat-val">
              <IconArrowDownRight size={9} className="net-down" /> {formatBytes(primaryNet.bytes_recv_rate_per_sec || 0)}/s
              {' '}
              <IconArrowUpRight size={9} className="net-up" /> {formatBytes(primaryNet.bytes_sent_rate_per_sec || 0)}/s
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Spark({ data }) {
  const W = 180, H = 36, P = 2;
  const mn = 0, mx = 100;
  
  // Ensure we have exactly 60 data points (or whatever the array length is)
  const len = Math.max(data.length, 2);
  const pts = data.length > 0 ? data.map((v, i) => {
    const x = P + (i / (len - 1)) * (W - 2 * P);
    const y = H - P - ((v - mn) / (mx - mn)) * (H - 2 * P);
    return `${x},${y}`;
  }).join(' ') : "";
  
  const lastX = data.length > 0 ? P + ((data.length - 1) / (len - 1)) * (W - 2 * P) : P;
  const area = data.length > 0 ? `${P},${H - P} ${pts} ${lastX},${H - P}` : "";

  return (
    <div className="sys-spark-wrap" style={{ marginTop: '12px', marginBottom: '8px' }}>
      <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: '6px' }}>CPU History (60s)</div>
      <svg viewBox={`0 0 ${W + 24} ${H}`} className="spark" style={{ overflow: 'visible', width: '100%', height: 'auto', display: 'block' }}>
        {/* Grid lines */}
        <line x1="0" x2={W} y1={P} y2={P} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2 2" />
        <line x1="0" x2={W} y1={H/2} y2={H/2} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2 2" />
        <line x1="0" x2={W} y1={H-P} y2={H-P} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2 2" />
        
        {/* Labels perfectly centered on their respective lines */}
        <text x={W + 4} y={P} fontSize="7.5" fill="var(--text-3)" dominantBaseline="central">100%</text>
        <text x={W + 4} y={H/2} fontSize="7.5" fill="var(--text-3)" dominantBaseline="central">50%</text>
        <text x={W + 4} y={H-P} fontSize="7.5" fill="var(--text-3)" dominantBaseline="central">0%</text>

        {/* Data area and line */}
        <polygon points={area} fill="var(--accent)" opacity="0.08" />
        <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      </svg>
    </div>
  );
}
