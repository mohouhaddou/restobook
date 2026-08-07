import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { Toast } from '../../components/ui/Toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { DashboardIcon } from '../../shared/components/ui/DashboardIcon';
import { PremiumIcon } from '../../shared/components/ui/PremiumIcon';

const BUSINESS_TYPE_LABELS = {
  restaurant: 'Restaurant', cafe: 'Café', cantine: 'Cantine', hanout: 'Hanout / Épicerie',
  boulangerie: 'Boulangerie', patisserie: 'Pâtisserie', boucherie: 'Boucherie',
  pharmacie: 'Pharmacie', autre: 'Autre / Supermarché',
};

const TABS = [
  { key: 'overview', label: 'Vue générale', icon: 'chart' },
  { key: 'global', label: 'Config globale', icon: 'globe' },
  { key: 'categories', label: 'Règles par catégorie', icon: 'tags' },
  { key: 'pending', label: 'Approbations', icon: 'clock' },
  { key: 'limits', label: 'Limites', icon: 'lock' },
];

const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 };
function Label({ children }) { return <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#374151' }}>{children}</label>; }

function OverviewTab() {
  const { get } = useApi();
  const [data, setData] = useState(null);

  useEffect(() => { get('/superadmin/loyalty/overview').then(setData).catch(() => {}); }, []);

  if (!data) return <div className="text-secondary py-4">Chargement…</div>;

  const cards = [
    { label: 'Commerces participants', value: data.participating_count },
    { label: 'Non participants', value: data.non_participating_count },
    { label: 'Points distribués (mois)', value: data.points_distributed_this_month },
    { label: 'Cashback distribué (mois)', value: `${data.cashback_distributed_this_month.toFixed(2)} MAD` },
  ];

  return (
    <div>
      <div className="row g-3 mb-4">
        {cards.map(c => (
          <div key={c.label} className="col-6 col-md-3">
            <div className="card p-3 text-center border-0 shadow-sm">
              <div className="h4 fw-bold text-primary mb-0">{c.value}</div>
              <div className="text-secondary small">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <div className="card p-3 border-0 shadow-sm">
            <div className="fw-semibold mb-2">Top commerces (cashback distribué)</div>
            {data.top_businesses.length === 0 ? <EmptyState icon="store" title="Aucune donnée" /> : (
              <table className="table table-sm mb-0">
                <tbody>
                  {data.top_businesses.map(b => (
                    <tr key={b.id}><td>{b.name}</td><td className="text-end fw-semibold">{Number(b.cashback_distributed).toFixed(2)} MAD</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="col-md-6">
          <div className="card p-3 border-0 shadow-sm">
            <div className="fw-semibold mb-2">Top clients (points gagnés)</div>
            {data.top_customers.length === 0 ? <EmptyState icon="user" title="Aucune donnée" /> : (
              <table className="table table-sm mb-0">
                <tbody>
                  {data.top_customers.map(c => (
                    <tr key={c.id}><td>{c.nom}</td><td className="text-end fw-semibold">{c.points_earned} pts</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RuleForm({ initial, onSubmit, submitLabel }) {
  const [form, setForm] = useState(initial || { points_rate: 1, cashback_pct: 0, min_order_amount: 0, monthly_budget_cap: '', valid_from: '', valid_until: '' });
  const set = (f, v) => setForm(prev => ({ ...prev, [f]: v }));

  function submit(e) {
    e.preventDefault();
    onSubmit({
      points_rate: Number(form.points_rate),
      cashback_pct: Number(form.cashback_pct || 0),
      min_order_amount: Number(form.min_order_amount || 0),
      monthly_budget_cap: form.monthly_budget_cap ? Number(form.monthly_budget_cap) : null,
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
    });
  }

  return (
    <form onSubmit={submit} className="row g-3">
      <div className="col-md-3">
        <Label>1 point pour (DH)</Label>
        <input type="number" min="0.01" step="0.01" style={inp} value={form.points_rate} onChange={e => set('points_rate', e.target.value)} required />
      </div>
      <div className="col-md-3">
        <Label>Cashback (%)</Label>
        <input type="number" min="0" max="100" step="0.1" style={inp} value={form.cashback_pct} onChange={e => set('cashback_pct', e.target.value)} />
      </div>
      <div className="col-md-3">
        <Label>Montant minimum (DH)</Label>
        <input type="number" min="0" step="1" style={inp} value={form.min_order_amount} onChange={e => set('min_order_amount', e.target.value)} />
      </div>
      <div className="col-md-3">
        <Label>Budget mensuel max (DH)</Label>
        <input type="number" min="0" step="1" style={inp} value={form.monthly_budget_cap} onChange={e => set('monthly_budget_cap', e.target.value)} placeholder="Illimité" />
      </div>
      <div className="col-md-6">
        <Label>Valide à partir du</Label>
        <input type="date" style={inp} value={form.valid_from} onChange={e => set('valid_from', e.target.value)} />
      </div>
      <div className="col-md-6">
        <Label>Valide jusqu'au</Label>
        <input type="date" style={inp} value={form.valid_until} onChange={e => set('valid_until', e.target.value)} />
      </div>
      <div className="col-12">
        <button type="submit" className="btn btn-primary btn-sm">{submitLabel}</button>
      </div>
    </form>
  );
}

function GlobalConfigTab({ notify }) {
  const { get, put } = useApi();
  const [rule, setRule] = useState(null);

  const load = () => get('/superadmin/loyalty/global-rule').then(d => setRule(d.rule)).catch(() => {});
  useEffect(() => { load(); }, []);

  async function save(fields) {
    try {
      await put('/superadmin/loyalty/global-rule', fields);
      notify('Règle globale mise à jour');
      load();
    } catch (e) { notify(e.message, 'error'); }
  }

  if (rule === null) return <div className="text-secondary py-4">Chargement…</div>;

  return (
    <div className="card p-3 border-0 shadow-sm">
      <div className="fw-semibold mb-3">Règle globale iFilino (par défaut, tous commerces)</div>
      {rule && (
        <div className="alert alert-light border small mb-3">
          Actuellement : 1 point pour {Number(rule.points_rate)} DH · {Number(rule.cashback_pct)}% cashback
          {rule.min_order_amount > 0 && ` · min. ${Number(rule.min_order_amount)} DH`}
        </div>
      )}
      <RuleForm initial={rule} onSubmit={save} submitLabel="Enregistrer la règle globale" />
    </div>
  );
}

function CategoryRulesTab({ notify }) {
  const { get, put } = useApi();
  const [types, setTypes] = useState([]);
  const [rules, setRules] = useState({});
  const [editing, setEditing] = useState(null);

  const load = () => get('/superadmin/loyalty/category-rules').then(d => { setTypes(d.business_types); setRules(d.rules); }).catch(() => {});
  useEffect(() => { load(); }, []);

  async function save(businessType, fields) {
    try {
      await put(`/superadmin/loyalty/category-rules/${businessType}`, fields);
      notify(`Règle "${BUSINESS_TYPE_LABELS[businessType]}" mise à jour`);
      setEditing(null);
      load();
    } catch (e) { notify(e.message, 'error'); }
  }

  return (
    <div className="row g-3">
      {types.map(bt => {
        const rule = rules[bt];
        return (
          <div key={bt} className="col-md-6">
            <div className="card p-3 border-0 shadow-sm h-100">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="fw-semibold">{BUSINESS_TYPE_LABELS[bt]}</div>
                <button className="btn btn-sm btn-outline-primary" onClick={() => setEditing(editing === bt ? null : bt)}>
                  {editing === bt ? 'Fermer' : (rule ? 'Modifier' : 'Configurer')}
                </button>
              </div>
              {rule ? (
                <div className="small text-secondary">1 pt / {Number(rule.points_rate)} DH · {Number(rule.cashback_pct)}% cashback</div>
              ) : (
                <div className="small text-secondary">Aucune règle — la règle globale s'applique</div>
              )}
              {editing === bt && (
                <div className="mt-3 pt-3 border-top">
                  <RuleForm initial={rule} onSubmit={(fields) => save(bt, fields)} submitLabel="Enregistrer" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PendingTab({ notify }) {
  const { get, post } = useApi();
  const [rules, setRules] = useState([]);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');

  const load = () => get('/superadmin/loyalty/pending').then(d => setRules(d.rules || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  async function approve(id) {
    try { await post(`/superadmin/loyalty/pending/${id}/approve`, {}); notify('Règle approuvée'); load(); }
    catch (e) { notify(e.message, 'error'); }
  }
  async function reject(id) {
    if (!reason.trim()) { notify('Un motif de refus est requis', 'error'); return; }
    try { await post(`/superadmin/loyalty/pending/${id}/reject`, { reason }); notify('Règle refusée'); setRejecting(null); setReason(''); load(); }
    catch (e) { notify(e.message, 'error'); }
  }

  if (!rules.length) return <EmptyState icon="check" title="Aucune règle en attente" subtitle="Toutes les demandes commerçant ont été traitées." />;

  return (
    <div className="d-flex flex-column gap-3">
      {rules.map(r => (
        <div key={r.id} className="card p-3 border-0 shadow-sm">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="fw-semibold">{r.organization?.name || `Organisation #${r.organization_id}`}</div>
              <div className="small text-secondary">
                1 pt / {Number(r.points_rate)} DH · {Number(r.cashback_pct)}% cashback
                {r.min_order_amount > 0 && ` · min. ${Number(r.min_order_amount)} DH`}
                {r.monthly_budget_cap && ` · plafond ${Number(r.monthly_budget_cap)} DH/mois`}
              </div>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-success" onClick={() => approve(r.id)}>Approuver</button>
              <button className="btn btn-sm btn-outline-danger" onClick={() => setRejecting(rejecting === r.id ? null : r.id)}>Refuser</button>
            </div>
          </div>
          {rejecting === r.id && (
            <div className="mt-3 pt-3 border-top d-flex gap-2">
              <input style={inp} placeholder="Motif du refus…" value={reason} onChange={e => setReason(e.target.value)} />
              <button className="btn btn-sm btn-danger" onClick={() => reject(r.id)}>Confirmer</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function LimitsTab({ notify }) {
  const { get, put } = useApi();
  const [limits, setLimits] = useState(null);

  useEffect(() => { get('/superadmin/loyalty/limits').then(d => setLimits(d.limits)).catch(() => {}); }, []);

  async function save(e) {
    e.preventDefault();
    try {
      const { id, updated_by, createdAt, updatedAt, ...fields } = limits;
      await put('/superadmin/loyalty/limits', fields);
      notify('Limites mises à jour');
    } catch (e2) { notify(e2.message, 'error'); }
  }

  if (!limits) return <div className="text-secondary py-4">Chargement…</div>;
  const set = (f, v) => setLimits(prev => ({ ...prev, [f]: v }));

  return (
    <div className="card p-3 border-0 shadow-sm" style={{ maxWidth: 560 }}>
      <div className="fw-semibold mb-1">Bornes imposées aux commerçants</div>
      <div className="small text-secondary mb-3">Aucune règle personnalisée ne peut dépasser ces limites, quel que soit le commerce.</div>
      <form onSubmit={save} className="row g-3">
        <div className="col-md-6">
          <Label>Cashback max (%)</Label>
          <input type="number" min="0" max="100" step="0.1" style={inp} value={limits.max_cashback_pct} onChange={e => set('max_cashback_pct', e.target.value)} />
        </div>
        <div className="col-md-6">
          <Label>Budget mensuel max (DH)</Label>
          <input type="number" min="0" style={inp} value={limits.max_monthly_budget_cap} onChange={e => set('max_monthly_budget_cap', e.target.value)} />
        </div>
        <div className="col-md-6">
          <Label>Taux le plus généreux autorisé (DH/pt)</Label>
          <input type="number" min="0.01" step="0.01" style={inp} value={limits.min_points_rate} onChange={e => set('min_points_rate', e.target.value)} />
        </div>
        <div className="col-md-6">
          <Label>Taux le moins généreux autorisé (DH/pt)</Label>
          <input type="number" min="0.01" step="0.01" style={inp} value={limits.max_points_rate} onChange={e => set('max_points_rate', e.target.value)} />
        </div>
        <div className="col-md-6">
          <Label>Durée de validité max (jours)</Label>
          <input type="number" min="1" style={inp} value={limits.max_expiration_days} onChange={e => set('max_expiration_days', e.target.value)} />
        </div>
        <div className="col-12">
          <button type="submit" className="btn btn-primary btn-sm">Enregistrer les limites</button>
        </div>
      </form>
    </div>
  );
}

export default function LoyaltyProgramPage() {
  const [tab, setTab] = useState('overview');
  const [msg, setMsg] = useState('');
  const [kind, setKind] = useState('success');
  const notify = (text, k = 'success') => { setMsg(text); setKind(k); };

  return (
    <div>
      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />
      <h4 className="fw-bold mb-3 d-inline-flex align-items-center gap-2"><PremiumIcon name="gem" size={22} /> Programme Fidélité</h4>

      <div className="d-flex gap-2 mb-4 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`btn btn-sm d-inline-flex align-items-center gap-1 ${tab === t.key ? 'btn-primary' : 'btn-outline-secondary'}`}>
            <DashboardIcon icon={t.icon} size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'global' && <GlobalConfigTab notify={notify} />}
      {tab === 'categories' && <CategoryRulesTab notify={notify} />}
      {tab === 'pending' && <PendingTab notify={notify} />}
      {tab === 'limits' && <LimitsTab notify={notify} />}
    </div>
  );
}
