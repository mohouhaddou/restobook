import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApi } from '../../hooks/useApi';
import { useInfraSocket } from '../../shared/hooks/useInfraSocket';
import { InfraLayout } from './InfraLayout';

const RANGES = [
  { key: '24h', label: '24 heures' },
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
  { key: '90d', label: '90 jours' },
  { key: '1y', label: '1 an' },
];

function fmtBytes(n) {
  if (n == null) return '—';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}
function fmtDuration(s) {
  if (s == null) return '—';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}j ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--il-border)', fontSize: 13 }}>
      <span style={{ color: 'var(--il-muted)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: 'var(--il-text)' }}>{value}</span>
    </div>
  );
}

export default function InfraServerPage() {
  const { get } = useApi();
  const [server, setServer] = useState(null);
  const [range, setRange] = useState('24h');
  const [points, setPoints] = useState([]);

  useEffect(() => { get('/superadmin/infra/server').then(setServer).catch(() => {}); }, []);
  useInfraSocket({ onMetrics: (d) => setServer(d.server) });

  useEffect(() => {
    get(`/superadmin/infra/history?range=${range}`).then(d => {
      setPoints((d.points || []).map(p => ({
        t: new Date(p.captured_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        cpu: p.cpu_pct != null ? Number(p.cpu_pct) : null,
        mem: p.mem_pct != null ? Number(p.mem_pct) : null,
      })));
    }).catch(() => setPoints([]));
  }, [range]);

  return (
    <InfraLayout title="Serveur" icon="🖥️">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 14, marginBottom: 20 }}>
        <div className="if-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--il-muted)', marginBottom: 8, fontWeight: 700 }}>CPU / RAM / Swap</div>
          <Row label="CPU" value={server?.cpu_pct != null ? `${server.cpu_pct}%` : '—'} />
          <Row label="RAM" value={server ? `${server.mem_pct}% (${fmtBytes(server.mem_used_bytes)} / ${fmtBytes(server.mem_total_bytes)})` : '—'} />
          <Row label="Swap" value={server ? `${server.swap_pct}% (${fmtBytes(server.swap_used_bytes)} / ${fmtBytes(server.swap_total_bytes)})` : '—'} />
        </div>
        <div className="if-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--il-muted)', marginBottom: 8, fontWeight: 700 }}>Charge système</div>
          <Row label="Charge (1 min)" value={server?.load1 ?? '—'} />
          <Row label="Charge (5 min)" value={server?.load5 ?? '—'} />
          <Row label="Charge (15 min)" value={server?.load15 ?? '—'} />
        </div>
        <div className="if-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--il-muted)', marginBottom: 8, fontWeight: 700 }}>Divers</div>
          <Row label="Uptime" value={fmtDuration(server?.uptime_s)} />
          <Row label="Processus" value={server?.process_count ?? '—'} />
          <Row label="Température CPU" value={server?.cpu_temp_c != null ? `${server.cpu_temp_c}°C` : 'Non disponible sur ce serveur'} />
        </div>
      </div>

      <div className="if-card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontWeight: 800, color: 'var(--il-text)' }}>Historique CPU / RAM</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {RANGES.map(r => (
              <button key={r.key} onClick={() => setRange(r.key)}
                className={`if-btn if-btn-sm ${range === r.key ? 'if-btn-primary' : 'if-btn-outline'}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {points.length < 2 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--il-muted)', fontSize: 13 }}>
            Pas encore assez d'historique pour cette période — une ligne est enregistrée toutes les 5 minutes.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="srv-cpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF8A00" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#FF8A00" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="srv-mem" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--il-border)" />
              <XAxis dataKey="t" tick={{ fontSize: 10, fill: 'var(--il-muted)' }} minTickGap={40} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--il-muted)' }} width={35} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: 'var(--il-card)', border: '1px solid var(--il-border)', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="cpu" name="CPU %" stroke="#FF8A00" fill="url(#srv-cpu)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="mem" name="RAM %" stroke="#2563EB" fill="url(#srv-mem)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </InfraLayout>
  );
}
