import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useInfraSocket } from '../../shared/hooks/useInfraSocket';
import { Sparkline } from '../../shared/components/infra/Sparkline';
import { HealthScoreCircle } from '../../shared/components/infra/HealthScoreCircle';
import { InfraLayout } from './InfraLayout';
import { DashboardIcon } from '../../shared/components/ui/DashboardIcon';
import { PremiumIcon } from '../../shared/components/ui/PremiumIcon';

const HISTORY_LEN = 40; // ~4 minutes de points à 6s d'intervalle

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

function pushHistory(ref, value) {
  ref.current = [...ref.current.slice(-(HISTORY_LEN - 1)), value];
  return ref.current;
}

function MetricCard({ icon, label, value, unit, history, color, sub }) {
  return (
    <div className="if-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <DashboardIcon icon={icon} size={18} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--il-text)' }}>
        {value != null ? value : '—'}{value != null && unit ? <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--il-muted)' }}> {unit}</span> : null}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--il-muted)', marginTop: 2 }}>{sub}</div>}
      {history && <div style={{ marginTop: 8 }}><Sparkline data={history} color={color} /></div>}
    </div>
  );
}

export default function InfraDashboardPage() {
  const { get } = useApi();
  const [health, setHealth] = useState(null);
  const [server, setServer] = useState(null);
  const [services, setServices] = useState([]);
  const [connected, setConnected] = useState(false);

  const cpuHist = useRef([]);
  const memHist = useRef([]);
  const netHist = useRef([]);
  const [, forceRerender] = useState(0);

  useEffect(() => {
    get('/superadmin/infra/health').then(setHealth).catch(() => {});
    get('/superadmin/infra/server').then(setServer).catch(() => {});
    get('/superadmin/infra/services').then(d => setServices(d.services || [])).catch(() => {});
  }, []);

  useInfraSocket({
    onMetrics: (data) => {
      setConnected(true);
      setServer(data.server);
      setHealth(h => ({ ...(h || {}), score: data.health.score, color: data.health.color, label: data.health.label, breakdown: data.health.breakdown }));
      setServices(data.services || []);
      if (data.server.cpu_pct != null) pushHistory(cpuHist, data.server.cpu_pct);
      if (data.server.mem_pct != null) pushHistory(memHist, data.server.mem_pct);
      forceRerender(n => n + 1);
    },
  });

  const servicesOnline = services.filter(s => s.status === 'online').length;
  const servicesDown = services.length - servicesOnline;

  return (
    <InfraLayout title="Infrastructure" icon="🖥️">
      {!connected && (
        <div style={{ marginBottom: 16, padding: '8px 14px', background: 'var(--il-primary-lighter)', borderRadius: 10, fontSize: 12, color: 'var(--il-text2)', display: 'inline-flex', alignItems: 'center', gap: 8 }}><PremiumIcon name="clock" size={14} /> Connexion temps réel en cours… (les valeurs ci-dessous sont le dernier instantané chargé)</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, marginBottom: 24, alignItems: 'center' }}>
        <div className="if-card" style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
          <HealthScoreCircle score={health?.score ?? 0} color={health?.color ?? 'green'} label={health?.label ?? '—'} breakdown={health?.breakdown} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))', gap: 10 }}>
          <div className="if-card" style={{ padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: servicesDown > 0 ? 'var(--il-danger)' : 'var(--il-success)' }}>{servicesOnline}/{services.length}</div>
            <div style={{ fontSize: 11, color: 'var(--il-muted)' }}>Services en ligne</div>
          </div>
          <div className="if-card" style={{ padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--il-text)' }}>{fmtDuration(server?.uptime_s)}</div>
            <div style={{ fontSize: 11, color: 'var(--il-muted)' }}>Uptime serveur</div>
          </div>
          <div className="if-card" style={{ padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--il-text)' }}>{server?.process_count ?? '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--il-muted)' }}>Processus système</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 14 }}>
        <MetricCard icon="⚙️" label="CPU" value={server?.cpu_pct} unit="%" history={cpuHist.current} color="#FF8A00" sub={server?.load1 != null ? `Charge : ${server.load1}` : null} />
        <MetricCard icon="🧠" label="RAM" value={server?.mem_pct} unit="%" history={memHist.current} color="#2563EB" sub={server ? `${fmtBytes(server.mem_used_bytes)} / ${fmtBytes(server.mem_total_bytes)}` : null} />
        <MetricCard icon="💾" label="Swap" value={server?.swap_pct} unit="%" color="#7C3AED" sub={server ? `${fmtBytes(server.swap_used_bytes)} / ${fmtBytes(server.swap_total_bytes)}` : null} />
        <MetricCard icon="🌡️" label="Température CPU" value={server?.cpu_temp_c} unit="°C" color="#DC2626" sub={server?.cpu_temp_c == null ? 'Non disponible sur ce serveur' : null} />
        <MetricCard icon="📈" label="Charge (1 min)" value={server?.load1} color="#16A34A" />
        <MetricCard icon="⏱️" label="Uptime" value={fmtDuration(server?.uptime_s)} color="#0EA5E9" />
      </div>

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Link to="/infrastructure/server" className="if-btn if-btn-outline if-btn-sm">Voir le détail serveur →</Link>
      </div>
    </InfraLayout>
  );
}
