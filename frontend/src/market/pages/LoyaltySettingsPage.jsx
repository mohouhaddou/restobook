import React, { useEffect, useRef, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { Toast } from '../../components/ui/Toast';
import { PremiumIcon } from '../../shared/components/ui/PremiumIcon';

const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' };
function Label({ children }) { return <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#374151' }}>{children}</label>; }

const MODES = [
  { key: 'none', icon: 'ban', label: 'Je ne participe pas', desc: 'Aucun point ni cashback distribué sur vos ventes.' },
  { key: 'default', icon: 'star', label: "J'utilise les règles iFilino", desc: 'Taux par défaut défini par iFilino (global ou par catégorie).' },
  { key: 'custom', icon: 'settings', label: 'Je crée mes propres règles', desc: 'Définissez votre propre taux, dans la limite autorisée par iFilino.' },
];

const STATUS_LABELS = {
  draft: { label: 'Brouillon', color: '#6b7280' },
  pending: { label: 'En attente de validation', color: '#d97706' },
  approved: { label: 'Approuvée et active', color: '#16a34a' },
  rejected: { label: 'Refusée', color: '#dc2626' },
  active: { label: 'Active', color: '#16a34a' },
};

export default function LoyaltySettingsPage() {
  const { get, patch, post } = useApi();
  const [settings, setSettings] = useState(null);
  const [mode, setMode] = useState('default');
  const [form, setForm] = useState({ points_rate: 10, cashback_pct: 0, min_order_amount: 0, monthly_budget_cap: '', valid_from: '', valid_until: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [kind, setKind] = useState('success');
  const [simAmount, setSimAmount] = useState('250');
  const [simResult, setSimResult] = useState(null);
  const [stats, setStats] = useState(null);
  const simDebRef = useRef(null);

  function notify(text, k = 'success') { setMsg(text); setKind(k); }

  async function load() {
    try {
      const d = await get('/loyalty/admin/settings');
      setSettings(d);
      setMode(d.mode);
      if (d.custom_rule) {
        setForm({
          points_rate: Number(d.custom_rule.points_rate), cashback_pct: Number(d.custom_rule.cashback_pct),
          min_order_amount: Number(d.custom_rule.min_order_amount),
          monthly_budget_cap: d.custom_rule.monthly_budget_cap ?? '',
          valid_from: d.custom_rule.valid_from || '', valid_until: d.custom_rule.valid_until || '',
        });
      }
    } catch (e) { notify(e.message, 'error'); }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { get('/loyalty/admin/stats').then(setStats).catch(() => {}); }, []);

  useEffect(() => {
    clearTimeout(simDebRef.current);
    if (!simAmount || Number(simAmount) <= 0) { setSimResult(null); return; }
    simDebRef.current = setTimeout(() => {
      post('/loyalty/admin/simulate', { amount: Number(simAmount) }).then(setSimResult).catch(() => {});
    }, 350);
    return () => clearTimeout(simDebRef.current);
  }, [simAmount]);

  const set = (f, v) => setForm(prev => ({ ...prev, [f]: v }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { mode };
      if (mode === 'custom') {
        payload.custom_rule = {
          points_rate: Number(form.points_rate), cashback_pct: Number(form.cashback_pct || 0),
          min_order_amount: Number(form.min_order_amount || 0),
          monthly_budget_cap: form.monthly_budget_cap ? Number(form.monthly_budget_cap) : null,
          valid_from: form.valid_from || null, valid_until: form.valid_until || null,
        };
      }
      await patch('/loyalty/admin/settings', payload);
      notify(mode === 'custom' ? 'Règle soumise — en attente de validation iFilino' : 'Mode de fidélité mis à jour');
      load();
    } catch (err) {
      if (err.message.includes('limites')) notify('Règle hors des limites autorisées par iFilino — vérifiez vos valeurs', 'error');
      else notify(err.message, 'error');
    }
    setSaving(false);
  }

  if (!settings) return <div className="text-secondary py-4">Chargement…</div>;

  const limits = settings.global_limits;
  const ruleStatus = settings.custom_rule ? STATUS_LABELS[settings.custom_rule.status] : null;

  return (
    <div style={{ maxWidth: 720 }}>
      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />
      <h4 className="fw-bold mb-1 d-inline-flex align-items-center gap-2"><PremiumIcon name="gem" size={22} /> Fidélité & Récompenses</h4>
      <p className="text-secondary small mb-4">Choisissez comment vos clients gagnent des points et du cashback chez vous.</p>

      {stats && (
        <div className="row g-3 mb-4">
          {[
            { label: 'Points distribués (mois)', value: stats.points_distributed_this_month },
            { label: 'Cashback distribué (mois)', value: `${stats.cashback_distributed_this_month.toFixed(2)} MAD` },
            { label: 'Commandes récompensées', value: stats.orders_with_reward_this_month },
          ].map(c => (
            <div key={c.label} className="col-4">
              <div className="card p-3 text-center border-0 shadow-sm">
                <div className="h5 fw-bold text-primary mb-0">{c.value}</div>
                <div className="text-secondary small">{c.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card p-3 border-0 shadow-sm mb-3">
        <div className="fw-semibold mb-3">Statut</div>
        <div className="d-flex flex-column gap-2">
          {MODES.map(m => (
            <label key={m.key} className="d-flex align-items-start gap-2 p-2 rounded" style={{ cursor: 'pointer', background: mode === m.key ? '#fff7ed' : 'transparent', border: `1.5px solid ${mode === m.key ? '#f97316' : '#e5e7eb'}` }}>
              <input type="radio" name="mode" checked={mode === m.key} onChange={() => setMode(m.key)} style={{ marginTop: 3 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 }}><PremiumIcon name={m.icon} size={16} /> {m.label}</div>
                <div className="text-secondary small">{m.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {mode !== 'custom' && (
          <div className="alert alert-light border small mt-3 mb-0">
            Taux effectif actuel : 1 point pour {settings.resolved_rule.points_rate} DH · {settings.resolved_rule.cashback_pct}% cashback
            {settings.resolved_rule.min_order_amount > 0 && ` · min. ${settings.resolved_rule.min_order_amount} DH`}
            {' '}({settings.resolved_rule.source === 'category' ? 'règle de votre catégorie' : 'règle globale iFilino'})
          </div>
        )}

        {mode === 'custom' && (
          <form onSubmit={save} className="mt-3 pt-3 border-top">
            {ruleStatus && (
              <div className="small mb-3" style={{ color: ruleStatus.color, fontWeight: 600 }}>
                {ruleStatus.label}
                {settings.custom_rule.status === 'rejected' && settings.custom_rule.rejection_reason && (
                  <div className="text-secondary fw-normal mt-1">Motif : {settings.custom_rule.rejection_reason}</div>
                )}
              </div>
            )}
            {settings.resolved_rule.fallback_applied && (
              <div className="alert alert-warning small py-2">
                Votre règle personnalisée a expiré — les règles par défaut s'appliquent en attendant une nouvelle soumission.
              </div>
            )}

            <div className="row g-3">
              <div className="col-md-6">
                <Label>1 point pour (DH)</Label>
                <input type="number" min={limits.min_points_rate} max={limits.max_points_rate} step="0.01" style={inp} value={form.points_rate} onChange={e => set('points_rate', e.target.value)} required />
                <div className="text-secondary" style={{ fontSize: 11, marginTop: 3 }}>Entre {limits.min_points_rate} et {limits.max_points_rate} DH</div>
              </div>
              <div className="col-md-6">
                <Label>Cashback (%)</Label>
                <input type="number" min="0" max={limits.max_cashback_pct} step="0.1" style={inp} value={form.cashback_pct} onChange={e => set('cashback_pct', e.target.value)} />
                <div className="text-secondary" style={{ fontSize: 11, marginTop: 3 }}>Maximum {limits.max_cashback_pct}%</div>
              </div>
              <div className="col-md-6">
                <Label>Montant minimum (DH)</Label>
                <input type="number" min="0" step="1" style={inp} value={form.min_order_amount} onChange={e => set('min_order_amount', e.target.value)} />
              </div>
              <div className="col-md-6">
                <Label>Budget mensuel max (DH)</Label>
                <input type="number" min="0" max={limits.max_monthly_budget_cap} step="1" style={inp} value={form.monthly_budget_cap} onChange={e => set('monthly_budget_cap', e.target.value)} placeholder="Illimité" />
              </div>
              <div className="col-md-6">
                <Label>Valide à partir du</Label>
                <input type="date" style={inp} value={form.valid_from} onChange={e => set('valid_from', e.target.value)} />
              </div>
              <div className="col-md-6">
                <Label>Valide jusqu'au</Label>
                <input type="date" style={inp} value={form.valid_until} onChange={e => set('valid_until', e.target.value)} />
              </div>
            </div>
          </form>
        )}

        <button onClick={save} disabled={saving} className="btn btn-primary btn-sm mt-3">
          {saving ? 'Enregistrement…' : (mode === 'custom' ? 'Soumettre pour validation' : 'Enregistrer')}
        </button>
      </div>

      <div className="card p-3 border-0 shadow-sm">
        <div className="fw-semibold mb-2 d-inline-flex align-items-center gap-2"><PremiumIcon name="calculator" size={18} /> Simulation</div>
        <div className="d-flex align-items-center gap-2 mb-3">
          <span className="small text-secondary">Commande de</span>
          <input type="number" min="1" style={{ ...inp, width: 100 }} value={simAmount} onChange={e => setSimAmount(e.target.value)} />
          <span className="small text-secondary">DH</span>
        </div>
        {simResult && (
          simResult.enabled ? (
            <div className="alert alert-light border mb-0">
              <div className="small text-secondary mb-1">Le client reçoit</div>
              <div className="fw-bold">+{simResult.points} points {simResult.cashback > 0 && `· +${simResult.cashback.toFixed(2)} DH cashback`}</div>
              <div className="small text-secondary mt-2">Coût cashback estimé : {simResult.estimated_cost.toFixed(2)} DH</div>
            </div>
          ) : (
            <div className="alert alert-secondary small mb-0">Aucune récompense pour ce montant (programme désactivé ou montant sous le minimum requis).</div>
          )
        )}
      </div>
    </div>
  );
}
