import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useInfraSocket } from '../../shared/hooks/useInfraSocket';
import { Toast } from '../../components/ui/Toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { EmptyState } from '../../components/ui/EmptyState';
import { InfraLayout } from './InfraLayout';

function fmtDuration(s) {
  if (s == null) return '—';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}j ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

const KIND_LABEL = { pm2: 'Process PM2', system: 'Service système' };

function StatusDot({ status }) {
  const online = status === 'online';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
      color: online ? 'var(--il-success)' : 'var(--il-danger)',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: online ? 'var(--il-success)' : 'var(--il-danger)', display: 'inline-block' }} />
      {online ? 'En ligne' : 'Hors ligne'}
    </span>
  );
}

export default function InfraServicesPage() {
  const { get, post } = useApi();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(''); const [kind, setKind] = useState('success');
  const [pendingAction, setPendingAction] = useState(null); // { name, action, label }
  const [expanded, setExpanded] = useState(null);
  const [logs, setLogs] = useState([]);

  function load() {
    get('/superadmin/infra/services').then(d => { setServices(d.services || []); setLoading(false); }).catch(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  useInfraSocket({
    onMetrics: (data) => setServices(data.services || []),
    onServiceChanged: () => load(),
  });

  async function runAction() {
    if (!pendingAction) return;
    const { name, action } = pendingAction;
    setPendingAction(null);
    try {
      await post(`/superadmin/infra/services/${encodeURIComponent(name)}/${action}`, {});
      setMsg(`Action "${action}" appliquée à ${name}.`); setKind('success');
      load();
    } catch (e) { setMsg(e.message); setKind('error'); }
  }

  async function viewLogs(name) {
    setExpanded(name);
    try {
      const d = await get(`/superadmin/infra/services/${encodeURIComponent(name)}/logs?limit=100`);
      setLogs(d.lines || []);
    } catch { setLogs([]); }
  }

  const pm2Services = services.filter(s => s.kind === 'pm2');
  const systemServices = services.filter(s => s.kind === 'system');

  function ServiceCard(s) {
    return (
      <div key={s.id} className="if-card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--il-text)' }}>{s.name}</div>
            <div style={{ fontSize: 11, color: 'var(--il-muted)' }}>{KIND_LABEL[s.kind] || s.kind}{s.version ? ` · v${s.version}` : ''}</div>
          </div>
          <StatusDot status={s.status} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, fontSize: 12, color: 'var(--il-text2)', marginBottom: 12 }}>
          <div>PID : {s.pid ?? '—'}</div>
          <div>Uptime : {fmtDuration(s.uptime_s)}</div>
          <div>CPU : {s.cpu_pct != null ? `${s.cpu_pct}%` : '—'}</div>
          <div>RAM : {s.mem_mb != null ? `${s.mem_mb} Mo` : '—'}</div>
          <div>Redémarrages : {s.restarts ?? '—'}</div>
          <div>Temps de réponse : {s.response_time_ms != null ? `${s.response_time_ms}ms` : '—'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {s.kind === 'pm2' && (
            <>
              <button className="if-btn if-btn-outline if-btn-sm" onClick={() => viewLogs(s.name)}>Voir détails</button>
              <button className="if-btn if-btn-outline if-btn-sm" onClick={() => setPendingAction({ name: s.name, action: 'reload', label: 'recharger' })}>Reload</button>
              <button className="if-btn if-btn-primary if-btn-sm" onClick={() => setPendingAction({ name: s.name, action: 'restart', label: 'redémarrer' })}>🔄 Redémarrer</button>
            </>
          )}
        </div>
        {expanded === s.name && (
          <div style={{ marginTop: 12, background: 'var(--il-bg2, #F9FAFB)', borderRadius: 10, padding: 10, maxHeight: 220, overflowY: 'auto' }}>
            {logs.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--il-muted)' }}>Aucun log récent.</div>
            ) : logs.slice(-40).map((l, i) => (
              <div key={i} style={{ fontSize: 11, fontFamily: 'monospace', color: l.level === 'ERROR' || l.level === 'CRITICAL' ? 'var(--il-danger)' : 'var(--il-text2)', whiteSpace: 'pre-wrap', marginBottom: 2 }}>
                {l.text}
              </div>
            ))}
            <button className="if-btn if-btn-outline if-btn-sm" style={{ marginTop: 8 }} onClick={() => setExpanded(null)}>Fermer</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <InfraLayout title="Services" icon="🧩">
      {loading ? (
        <div style={{ color: 'var(--il-muted)' }}>Chargement…</div>
      ) : services.length === 0 ? (
        <EmptyState title="Aucun service détecté" />
      ) : (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-muted)', textTransform: 'uppercase', marginBottom: 10 }}>Processus applicatifs (PM2)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 14, marginBottom: 24 }}>
            {pm2Services.map(ServiceCard)}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-muted)', textTransform: 'uppercase', marginBottom: 10 }}>Services système</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 14 }}>
            {systemServices.map(ServiceCard)}
          </div>
        </>
      )}

      <ConfirmModal
        show={!!pendingAction}
        title={`${pendingAction?.label === 'reload' ? 'Recharger' : 'Redémarrer'} le service`}
        message={pendingAction ? `Confirmez-vous vouloir ${pendingAction.label} "${pendingAction.name}" ? Le service sera brièvement indisponible.` : ''}
        confirmLabel={pendingAction?.action === 'reload' ? 'Recharger' : 'Redémarrer'}
        confirmClass="btn-warning"
        onCancel={() => setPendingAction(null)}
        onConfirm={runAction}
      />
      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />
    </InfraLayout>
  );
}
