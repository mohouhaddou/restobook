import React, { useState, useEffect } from 'react';
import { API } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { BRAND } from '../config/branding';

/* ══ HELPERS ════════════════════════════════════════════════════════════ */

function fmt(n) { return Number(n).toLocaleString('fr-FR'); }
function fmtLimit(n) { return n === -1 ? '∞' : fmt(n); }
function fmtPrice(n) { return Number(n) === 0 ? 'Gratuit' : `${fmt(n)} MAD`; }

const FEATURE_LABELS = {
  has_ai_features:        { label:'IA & Recommandations',     icon:'🤖' },
  has_exports:            { label:'Exports PDF / Excel',       icon:'📤' },
  has_advanced_dashboard: { label:'Dashboard avancé',          icon:'📊' },
  has_loyalty_module:     { label:'Module fidélité',           icon:'🌟' },
  has_delivery_module:    { label:'Module livraison',          icon:'🛵' },
  has_canteen_module:     { label:'Module cantine',            icon:'🏢' },
  has_nutrition_ai:       { label:'Nutrition IA',              icon:'🍎' },
  has_api_access:         { label:'Accès API',                 icon:'🔌' },
};

/* ══ PLAN CARD ══════════════════════════════════════════════════════════ */

function PlanCard({ plan, isCurrent, billing, onAssign, canAssign, orgOptions }) {
  const [showAssign, setShowAssign] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [expires, setExpires] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const price = billing === 'yearly' ? plan.price_yearly : plan.price_monthly;
  const isEnterprise = plan.slug === 'enterprise';
  const isFree = plan.slug === 'free_demo';

  async function handleAssign() {
    if (!selectedOrg) return;
    setSaving(true);
    try {
      const res = await fetch(API('/subscriptions/assign'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('rb_token')}` },
        body: JSON.stringify({ organization_id: parseInt(selectedOrg), plan_slug: plan.slug, billing_cycle: billing, expires_at: expires || null, notes }),
      });
      const data = await res.json();
      if (data.ok) { setShowAssign(false); onAssign && onAssign(); }
    } finally { setSaving(false); }
  }

  return (
    <div style={{
      background: 'var(--rb-card)', border: `2px solid ${isCurrent ? plan.color : 'var(--sb-border)'}`,
      borderRadius: 20, padding: 28, display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
      boxShadow: isCurrent ? `0 0 0 4px ${plan.color}22` : 'var(--rb-shadow)',
      transition: 'transform .2s, box-shadow .2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = isCurrent ? `0 0 0 4px ${plan.color}22` : 'var(--rb-shadow)'; }}
    >
      {/* Popular badge */}
      {plan.is_popular && (
        <div style={{ position: 'absolute', top: 16, right: 16, background: plan.color, color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Populaire
        </div>
      )}
      {isCurrent && (
        <div style={{ position: 'absolute', top: plan.is_popular ? 44 : 16, right: 16, background: 'var(--rb-green)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>
          ● Actuel
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 34, marginBottom: 8 }}>{plan.icon}</div>
        <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--rb-text)', marginBottom: 4 }}>{plan.name}</div>
        <div style={{ fontSize: 13, color: 'var(--rb-muted)', lineHeight: 1.4 }}>{plan.description}</div>
      </div>

      {/* Price */}
      <div style={{ marginBottom: 22 }}>
        {isEnterprise ? (
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: plan.color }}>Sur devis</div>
            <div style={{ fontSize: 12, color: 'var(--rb-muted)', marginTop: 2 }}>Tarification personnalisée</div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: plan.color }}>{isFree ? 'Gratuit' : `${fmt(price)}`}</span>
              {!isFree && <span style={{ fontSize: 13, color: 'var(--rb-muted)' }}>MAD / {billing === 'yearly' ? 'an' : 'mois'}</span>}
            </div>
            {billing === 'yearly' && !isFree && (
              <div style={{ fontSize: 11, color: 'var(--rb-green)', fontWeight: 700, marginTop: 2 }}>
                Économie de {fmt(plan.price_monthly * 12 - plan.price_yearly)} MAD/an
              </div>
            )}
          </div>
        )}
      </div>

      {/* Limits */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, padding: '14px', background: 'var(--rb-bg)', borderRadius: 12, border: '1px solid var(--sb-border)' }}>
        {[
          ['🏪', 'Restaurants', fmtLimit(plan.max_restaurants)],
          ['👥', 'Utilisateurs', fmtLimit(plan.max_users)],
          ['📦', 'Commandes/mois', fmtLimit(plan.max_orders_per_month)],
        ].map(([icon, label, val]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--rb-muted)' }}>{icon} {label}</span>
            <span style={{ fontWeight: 700, color: val === '∞' ? 'var(--rb-green)' : 'var(--rb-text)' }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Features */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 22, flex: 1 }}>
        {Object.entries(FEATURE_LABELS).map(([key, { label, icon }]) => {
          const has = !!plan[key];
          return (
            <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <span style={{ width: 18, textAlign: 'center' }}>{has ? '✅' : '❌'}</span>
              <span style={{ color: has ? 'var(--rb-text)' : 'var(--rb-muted)', textDecoration: has ? 'none' : 'line-through', opacity: has ? 1 : .5 }}>
                {icon} {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      {canAssign && (
        <div>
          {!showAssign ? (
            <button onClick={() => setShowAssign(true)} style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: plan.color, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'opacity .15s, transform .1s' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}>
              Assigner ce plan
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <select value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}
                style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--sb-border)', background: 'var(--rb-bg)', color: 'var(--rb-text)', fontSize: 13 }}>
                <option value="">— Sélectionner une organisation —</option>
                {orgOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <input type="date" value={expires} onChange={e => setExpires(e.target.value)} placeholder="Date d'expiration (optionnel)"
                style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--sb-border)', background: 'var(--rb-bg)', color: 'var(--rb-text)', fontSize: 13 }} />
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes internes (optionnel)" rows={2}
                style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--sb-border)', background: 'var(--rb-bg)', color: 'var(--rb-text)', fontSize: 13, resize: 'none' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowAssign(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--sb-border)', background: 'transparent', color: 'var(--rb-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Annuler
                </button>
                <button onClick={handleAssign} disabled={!selectedOrg || saving} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: plan.color, color: '#fff', fontSize: 13, fontWeight: 700, cursor: selectedOrg ? 'pointer' : 'default', opacity: !selectedOrg || saving ? .6 : 1 }}>
                  {saving ? '…' : 'Confirmer'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!canAssign && !isCurrent && (
        <div style={{ textAlign: 'center', padding: '10px', background: 'var(--rb-bg)', borderRadius: 10, fontSize: 13, color: 'var(--rb-muted)' }}>
          Contactez votre administrateur pour changer de plan
        </div>
      )}
      {!canAssign && isCurrent && (
        <div style={{ textAlign: 'center', padding: '10px', background: `${plan.color}15`, borderRadius: 10, fontSize: 13, fontWeight: 700, color: plan.color }}>
          ● Plan actif
        </div>
      )}
    </div>
  );
}

/* ══ USAGE BAR ═══════════════════════════════════════════════════════════ */

function UsageBar({ label, icon, used, limit, color }) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : Math.min(100, (used / limit) * 100);
  const danger = pct >= 90;
  const warn = pct >= 70;
  const barColor = danger ? 'var(--rb-red, #EF4444)' : warn ? '#F59E0B' : color || 'var(--rb-green)';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--rb-muted)', fontWeight: 500 }}>{icon} {label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: unlimited ? 'var(--rb-green)' : danger ? barColor : 'var(--rb-text)' }}>
          {unlimited ? `${fmt(used)} / ∞` : `${fmt(used)} / ${fmt(limit)}`}
        </span>
      </div>
      <div style={{ height: 8, background: 'var(--rb-bg)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: unlimited ? '8%' : `${pct}%`, background: barColor, borderRadius: 8, transition: 'width .6s ease', backgroundImage: unlimited ? 'repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(255,255,255,.25) 4px,rgba(255,255,255,.25) 8px)' : 'none' }} />
      </div>
      {danger && !unlimited && <div style={{ fontSize: 11, color: barColor, marginTop: 3, fontWeight: 600 }}>⚠️ Limite presque atteinte — envisagez une mise à niveau</div>}
    </div>
  );
}

/* ══ SUBSCRIPTIONS ADMIN TABLE ══════════════════════════════════════════ */

function AdminTable({ subs, plans, orgOptions, onRefresh }) {
  const [cancelling, setCancelling] = useState(null);

  async function cancel(id, orgId) {
    setCancelling(id);
    await fetch(API(`/subscriptions/${id}/cancel`), { method: 'PATCH', headers: { Authorization: `Bearer ${localStorage.getItem('rb_token')}` } });
    onRefresh();
    setCancelling(null);
  }

  const STATUS_COLORS = { active: 'var(--rb-green)', trial: '#F59E0B', cancelled: '#EF4444', expired: '#94A3B8', pending: '#3B82F6' };
  const STATUS_LABELS = { active: 'Actif', trial: 'Essai', cancelled: 'Annulé', expired: 'Expiré', pending: 'En attente' };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--sb-border)' }}>
            {['Organisation','Plan','Statut','Facturation','Début','Expiration','Actions'].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--rb-muted)', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subs.map(s => (
            <tr key={s.id} style={{ borderBottom: '1px solid var(--sb-border)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--rb-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <td style={{ padding: '12px' }}>
                <div style={{ fontWeight: 600, color: 'var(--rb-text)' }}>{s.organization?.name || '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--rb-muted)' }}>{s.organization?.type}</div>
              </td>
              <td style={{ padding: '12px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: `${s.plan?.color || '#64748B'}18`, color: s.plan?.color || '#64748B' }}>
                  {s.plan?.icon} {s.plan?.name}
                </span>
              </td>
              <td style={{ padding: '12px' }}>
                <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${STATUS_COLORS[s.status] || '#64748B'}18`, color: STATUS_COLORS[s.status] || '#64748B' }}>
                  ● {STATUS_LABELS[s.status] || s.status}
                </span>
              </td>
              <td style={{ padding: '12px', color: 'var(--rb-text)', textTransform: 'capitalize' }}>{s.billing_cycle || '—'}</td>
              <td style={{ padding: '12px', color: 'var(--rb-muted)' }}>{s.started_at ? new Date(s.started_at).toLocaleDateString('fr-FR') : '—'}</td>
              <td style={{ padding: '12px', color: s.expires_at && new Date(s.expires_at) < new Date() ? '#EF4444' : 'var(--rb-muted)' }}>
                {s.expires_at ? new Date(s.expires_at).toLocaleDateString('fr-FR') : '∞'}
              </td>
              <td style={{ padding: '12px' }}>
                {s.status !== 'cancelled' && (
                  <button onClick={() => cancel(s.id, s.organization_id)} disabled={cancelling === s.id}
                    style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #EF444480', background: 'transparent', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {cancelling === s.id ? '…' : 'Annuler'}
                  </button>
                )}
              </td>
            </tr>
          ))}
          {subs.length === 0 && (
            <tr><td colSpan={7} style={{ padding: '28px', textAlign: 'center', color: 'var(--rb-muted)', fontSize: 14 }}>Aucun abonnement trouvé</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ══ MAIN PAGE ══════════════════════════════════════════════════════════ */

export default function SubscriptionPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';

  const [plans, setPlans]         = useState([]);
  const [myData, setMyData]       = useState(null);
  const [allSubs, setAllSubs]     = useState([]);
  const [orgs, setOrgs]           = useState([]);
  const [billing, setBilling]     = useState('monthly');
  const [tab, setTab]             = useState('pricing');
  const [loading, setLoading]     = useState(true);

  async function fetchAll() {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('rb_token')}` };
      const [p, m] = await Promise.all([
        fetch(API('/subscriptions/plans')).then(r => r.json()),
        fetch(API('/subscriptions/my'), { headers }).then(r => r.json()),
      ]);
      setPlans(p.plans || []);
      setMyData(m);

      if (isSuperAdmin) {
        const [a, o] = await Promise.all([
          fetch(API('/subscriptions/all'), { headers }).then(r => r.json()),
          fetch(API('/admin/orgs'), { headers }).then(r => r.json()),
        ]);
        setAllSubs(a.subscriptions || []);
        setOrgs(o.orgs || o.organizations || []);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  const currentPlan = myData?.plan;
  const usage       = myData?.usage || {};
  const status      = myData?.status || 'trial';
  const trialEnd    = myData?.trial_ends_at;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', flexDirection: 'column', gap: 14 }}>
      <div className="spinner-border" style={{ width: 36, height: 36, borderColor: 'var(--rb-orange)', borderRightColor: 'transparent' }} />
      <span style={{ fontSize: 13, color: 'var(--rb-muted)' }}>Chargement des plans…</span>
    </div>
  );

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--rb-text)', margin: '0 0 6px', letterSpacing: -.5 }}>
          💳 Abonnement
        </h1>
        <p style={{ color: 'var(--rb-muted)', fontSize: 15, margin: 0 }}>
          Gérez votre plan {BRAND.APP_NAME} et vos fonctionnalités disponibles.
        </p>
      </div>

      {/* ── Banner plan actuel ── */}
      {!isSuperAdmin && currentPlan && (
        <div style={{ background: `${currentPlan.color}12`, border: `1.5px solid ${currentPlan.color}40`, borderRadius: 16, padding: '20px 24px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 34 }}>{currentPlan.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--rb-text)', marginBottom: 2 }}>
              Plan actuel : <span style={{ color: currentPlan.color }}>{currentPlan.name}</span>
              <span style={{ marginLeft: 10, fontSize: 11, background: status === 'trial' ? '#F59E0B18' : `${currentPlan.color}18`, color: status === 'trial' ? '#F59E0B' : currentPlan.color, padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                ● {status === 'trial' ? 'Essai gratuit' : status === 'active' ? 'Actif' : status}
              </span>
            </div>
            {status === 'trial' && trialEnd && (
              <div style={{ fontSize: 12, color: '#F59E0B', fontWeight: 600 }}>
                ⏳ Essai se termine le {new Date(trialEnd).toLocaleDateString('fr-FR')}
              </div>
            )}
            <div style={{ fontSize: 13, color: 'var(--rb-muted)', marginTop: 2 }}>{currentPlan.description}</div>
          </div>
          <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: currentPlan.color }}>{fmtLimit(currentPlan.max_orders_per_month)}</div>
              <div style={{ fontSize: 11, color: 'var(--rb-muted)' }}>cmd/mois</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: currentPlan.color }}>{fmtLimit(currentPlan.max_users)}</div>
              <div style={{ fontSize: 11, color: 'var(--rb-muted)' }}>utilisateurs</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Usage ── */}
      {!isSuperAdmin && currentPlan && (
        <div style={{ background: 'var(--rb-card)', border: '1px solid var(--sb-border)', borderRadius: 16, padding: '20px 24px', marginBottom: 28 }}>
          <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700, color: 'var(--rb-text)' }}>📊 Utilisation ce mois</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20 }}>
            <UsageBar label="Commandes" icon="📦" used={usage.orders_this_month || 0} limit={currentPlan.max_orders_per_month} color={currentPlan.color} />
            <UsageBar label="Utilisateurs" icon="👥" used={usage.users || 0} limit={currentPlan.max_users} color={currentPlan.color} />
            <UsageBar label="Restaurants" icon="🏪" used={usage.restaurants || 1} limit={currentPlan.max_restaurants} color={currentPlan.color} />
          </div>
        </div>
      )}

      {/* ── Tabs (superadmin only) ── */}
      {isSuperAdmin && (
        <div style={{ display: 'flex', gap: 0, marginBottom: 28, background: 'var(--rb-card)', borderRadius: 12, padding: 4, border: '1px solid var(--sb-border)', width: 'fit-content' }}>
          {[['pricing','📋 Plans'],['manage','⚙️ Gérer les abonnements']].map(([v,l]) => (
            <button key={v} onClick={() => setTab(v)} style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: tab === v ? 'var(--rb-bg)' : 'transparent', color: tab === v ? 'var(--rb-text)' : 'var(--rb-muted)', fontSize: 13, fontWeight: tab === v ? 700 : 500, cursor: 'pointer', boxShadow: tab === v ? 'var(--rb-shadow)' : 'none', transition: 'all .15s' }}>
              {l}
            </button>
          ))}
        </div>
      )}

      {/* ── Billing toggle ── */}
      {tab === 'pricing' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, justifyContent: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: billing === 'monthly' ? 700 : 400, color: billing === 'monthly' ? 'var(--rb-text)' : 'var(--rb-muted)' }}>Mensuel</span>
          <button onClick={() => setBilling(b => b === 'monthly' ? 'yearly' : 'monthly')} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: billing === 'yearly' ? 'var(--rb-orange)' : 'var(--sb-border)', cursor: 'pointer', position: 'relative', transition: 'background .2s' }}>
            <div style={{ position: 'absolute', top: 3, left: billing === 'yearly' ? 22 : 4, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
          </button>
          <span style={{ fontSize: 14, fontWeight: billing === 'yearly' ? 700 : 400, color: billing === 'yearly' ? 'var(--rb-text)' : 'var(--rb-muted)' }}>
            Annuel <span style={{ fontSize: 11, background: 'var(--rb-green-s)', color: 'var(--rb-green)', padding: '1px 7px', borderRadius: 20, fontWeight: 700, marginLeft: 4 }}>-15%</span>
          </span>
        </div>
      )}

      {/* ── Plan cards ── */}
      {tab === 'pricing' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 20, marginBottom: 48 }}>
          {plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={currentPlan?.id === plan.id}
              billing={billing}
              canAssign={isSuperAdmin}
              orgOptions={orgs}
              onAssign={fetchAll}
            />
          ))}
        </div>
      )}

      {/* ── Admin: All subscriptions ── */}
      {tab === 'manage' && isSuperAdmin && (
        <div style={{ background: 'var(--rb-card)', border: '1px solid var(--sb-border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--sb-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--rb-text)' }}>Tous les abonnements</div>
            <div style={{ fontSize: 12, color: 'var(--rb-muted)' }}>{allSubs.length} entrée{allSubs.length > 1 ? 's' : ''}</div>
          </div>
          <AdminTable subs={allSubs} plans={plans} orgOptions={orgs} onRefresh={fetchAll} />
        </div>
      )}

      {/* ── Feature comparison (pricing tab) ── */}
      {tab === 'pricing' && plans.length > 0 && (
        <div style={{ background: 'var(--rb-card)', border: '1px solid var(--sb-border)', borderRadius: 16, overflow: 'hidden', marginBottom: 40 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--sb-border)' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--rb-text)' }}>Comparaison des fonctionnalités</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--sb-border)', background: 'var(--rb-bg)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--rb-muted)', fontWeight: 600, minWidth: 200 }}>Fonctionnalité</th>
                  {plans.map(p => (
                    <th key={p.id} style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: currentPlan?.id === p.id ? p.color : 'var(--rb-text)', whiteSpace: 'nowrap' }}>
                      {p.icon} {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Limites */}
                {[
                  ['🏪 Restaurants', 'max_restaurants'],
                  ['👥 Utilisateurs', 'max_users'],
                  ['📦 Commandes/mois', 'max_orders_per_month'],
                ].map(([label, key]) => (
                  <tr key={key} style={{ borderBottom: '1px solid var(--sb-border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--rb-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '11px 16px', color: 'var(--rb-text)', fontWeight: 500 }}>{label}</td>
                    {plans.map(p => (
                      <td key={p.id} style={{ padding: '11px 16px', textAlign: 'center', fontWeight: 700, color: p[key] === -1 ? 'var(--rb-green)' : 'var(--rb-text)' }}>
                        {fmtLimit(p[key])}
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Features booléennes */}
                {Object.entries(FEATURE_LABELS).map(([key, { label, icon }]) => (
                  <tr key={key} style={{ borderBottom: '1px solid var(--sb-border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--rb-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '11px 16px', color: 'var(--rb-text)', fontWeight: 500 }}>{icon} {label}</td>
                    {plans.map(p => (
                      <td key={p.id} style={{ padding: '11px 16px', textAlign: 'center', fontSize: 16 }}>
                        {p[key] ? '✅' : '❌'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
