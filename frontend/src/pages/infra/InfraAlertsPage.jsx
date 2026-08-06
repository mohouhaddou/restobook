import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useInfraSocket } from '../../shared/hooks/useInfraSocket';
import { Toast } from '../../components/ui/Toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { InfraLayout } from './InfraLayout';

const SEVERITY_COLOR = { info: '#2563EB', warning: '#D97706', critical: '#DC2626' };
const STATUS_LABEL = { active: 'Active', resolved: 'Résolue', acknowledged: 'Prise en compte' };
const TABS = [
  { key: 'active', label: 'Actives' },
  { key: '', label: 'Toutes' },
  { key: 'resolved', label: 'Résolues' },
];

export default function InfraAlertsPage() {
  const { get, post, patch } = useApi();
  const [tab, setTab] = useState('active');
  const [alerts, setAlerts] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(''); const [kind, setKind] = useState('success');
  const [editingRule, setEditingRule] = useState(null); // { id, threshold }

  function load() {
    setLoading(true);
    const qs = tab ? `?status=${tab}` : '';
    Promise.all([
      get(`/superadmin/infra/alerts${qs}`),
      get('/superadmin/infra/alerts/rules'),
    ]).then(([a, r]) => { setAlerts(a.alerts || []); setRules(r.rules || []); }).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [tab]);

  useInfraSocket({
    onAlert: () => load(),
    onAlertResolved: () => load(),
  });

  async function acknowledge(id) {
    try {
      await post(`/superadmin/infra/alerts/${id}/acknowledge`, {});
      setMsg('Alerte prise en compte.'); setKind('success');
      load();
    } catch (e) { setMsg(e.message); setKind('error'); }
  }

  async function saveRule(rule) {
    try {
      await patch(`/superadmin/infra/alerts/rules/${rule.id}`, { threshold: Number(editingRule.threshold), enabled: rule.enabled });
      setEditingRule(null);
      setMsg('Règle mise à jour.'); setKind('success');
      load();
    } catch (e) { setMsg(e.message); setKind('error'); }
  }

  async function toggleRule(rule) {
    try {
      await patch(`/superadmin/infra/alerts/rules/${rule.id}`, { enabled: !rule.enabled });
      load();
    } catch (e) { setMsg(e.message); setKind('error'); }
  }

  return (
    <InfraLayout title="Alertes" icon="🚨">
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.key || 'all'} onClick={() => setTab(t.key)} className={`if-btn if-btn-sm ${tab === t.key ? 'if-btn-primary' : 'if-btn-outline'}`}>{t.label}</button>
        ))}
      </div>

      <div className="if-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
        {loading ? (
          <div style={{ padding: 20, color: 'var(--il-muted)' }}>Chargement…</div>
        ) : alerts.length === 0 ? (
          <EmptyState icon="✅" title="Aucune alerte" subtitle="Tout va bien de ce côté." />
        ) : alerts.map(a => (
          <div key={a.id} style={{ padding: '14px 18px', borderBottom: '1px solid var(--il-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: SEVERITY_COLOR[a.severity] }} />
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--il-text)' }}>{a.description}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--il-muted)' }}>
                {new Date(a.createdAt || a.created_at).toLocaleString('fr-FR')} · origine : {a.origin} · {STATUS_LABEL[a.status]}
              </div>
            </div>
            {a.status === 'active' && (
              <button className="if-btn if-btn-outline if-btn-sm" onClick={() => acknowledge(a.id)}>✓ Prendre en compte</button>
            )}
          </div>
        ))}
      </div>

      <div className="if-card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 14, color: 'var(--il-text)' }}>Règles d'alerte</div>
        {rules.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--il-border)', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--il-text)' }}>{r.label}</div>
              <div style={{ fontSize: 11, color: 'var(--il-muted)' }}>{r.metric_path} {r.operator} {r.threshold}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {editingRule?.id === r.id ? (
                <>
                  <input className="if-input" style={{ width: 90 }} type="number" value={editingRule.threshold} onChange={e => setEditingRule({ ...editingRule, threshold: e.target.value })} />
                  <button className="if-btn if-btn-primary if-btn-sm" onClick={() => saveRule(r)}>OK</button>
                  <button className="if-btn if-btn-outline if-btn-sm" onClick={() => setEditingRule(null)}>Annuler</button>
                </>
              ) : (
                <button className="if-btn if-btn-outline if-btn-sm" onClick={() => setEditingRule({ id: r.id, threshold: r.threshold })}>Modifier le seuil</button>
              )}
              <button className={`if-btn if-btn-sm ${r.enabled ? 'if-btn-primary' : 'if-btn-outline'}`} onClick={() => toggleRule(r)}>
                {r.enabled ? 'Activée' : 'Désactivée'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />
    </InfraLayout>
  );
}
