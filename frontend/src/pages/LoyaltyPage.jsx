import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';

// ── Constantes ────────────────────────────────────────────────────────────────

const SEGMENTS = {
  new:      { label: 'Nouveaux',   icon: '🌱', color: '#16a34a' },
  regular:  { label: 'Réguliers',  icon: '😊', color: '#3b82f6' },
  loyal:    { label: 'Fidèles',    icon: '❤️', color: '#f59e0b' },
  vip:      { label: 'VIP',        icon: '👑', color: '#8b5cf6' },
  inactive: { label: 'Inactifs',   icon: '💤', color: '#94a3b8' },
  at_risk:  { label: 'À risque',   icon: '⚠️', color: '#ef4444' },
};

const REWARD_TYPE_LABELS = {
  discount_percent: '% réduction',
  discount_fixed:   'MAD réduction',
  free_item:        'Article offert',
  delivery_free:    'Livraison gratuite',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(n) {
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(n || 0);
}
function fmtNum(n) { return (n || 0).toLocaleString('fr-FR'); }
function ago(days) {
  if (days === 9999) return 'jamais';
  if (days === 0) return "aujourd'hui";
  return `il y a ${days}j`;
}
function tierColor(name) {
  if (name === 'Platine') return '#8b5cf6';
  if (name === 'Or')      return '#f59e0b';
  if (name === 'Argent')  return '#94a3b8';
  return '#cd7f32';
}

// ── Composants UI ─────────────────────────────────────────────────────────────

function Card({ children, style }) {
  return (
    <div style={{
      background: 'var(--rb-card)', border: '1px solid var(--rb-border)',
      borderRadius: 16, padding: '18px 20px', ...style,
    }}>{children}</div>
  );
}
function KpiCard({ icon, value, label, color = 'var(--rb-orange)' }) {
  return (
    <div style={{
      background: 'var(--rb-card)', border: '1px solid var(--rb-border)',
      borderRadius: 14, padding: '16px 18px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: color, borderRadius: '14px 0 0 14px' }} />
      <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{fmtNum(value)}</div>
      <div style={{ fontSize: 12, color: 'var(--rb-muted)', fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  );
}
function SectionTitle({ icon, title, sub, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--rb-text)' }}>{title}</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--rb-muted)' }}>{sub}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}
function Pill({ label, color, icon }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: color + '20', color, border: `1px solid ${color}40`,
    }}>
      {icon} {label}
    </span>
  );
}
function Modal({ title, children, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--rb-card)', borderRadius: 18, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflow: 'auto', padding: '24px 26px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--rb-muted)' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--rb-muted)', display: 'block', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}
const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: 13,
  border: '1.5px solid var(--rb-border)', background: 'var(--rb-surface)',
  color: 'var(--rb-text)', boxSizing: 'border-box',
};
function Btn({ children, onClick, color = 'var(--rb-orange)', outline, small, disabled, type = 'button' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      padding: small ? '6px 14px' : '9px 18px',
      borderRadius: 10, fontSize: small ? 12 : 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
      border: `2px solid ${color}`,
      background: outline ? 'transparent' : color,
      color: outline ? color : '#fff',
      opacity: disabled ? 0.6 : 1,
      transition: 'all .2s',
    }}>{children}</button>
  );
}

// ── Tab : Vue globale ─────────────────────────────────────────────────────────

function OverviewTab({ data, onRunEngine }) {
  const [running, setRunning] = useState(false);
  const handleRun = async () => {
    setRunning(true);
    await onRunEngine();
    setRunning(false);
  };

  if (!data) return <div style={{ color: 'var(--rb-muted)', padding: 20 }}>Chargement…</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <KpiCard icon="👥" value={data.kpis.total_customers}    label="Clients total"      color="#3b82f6" />
        <KpiCard icon="🔥" value={data.kpis.active_this_month}  label="Actifs ce mois"     color="#16a34a" />
        <KpiCard icon="⭐" value={data.kpis.total_points_issued} label="Points émis total"  color="#f59e0b" />
        <KpiCard icon="🎁" value={data.kpis.redemptions_count}  label="Rédemptions"        color="#8b5cf6" />
      </div>

      {/* Segments */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card>
          <SectionTitle icon="🎯" title="Segmentation clients" sub="Distribution par comportement d'achat" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(SEGMENTS).map(([key, seg]) => {
              const cnt = data.segments[key] || 0;
              const total = data.kpis.total_customers || 1;
              const pct = Math.round((cnt / total) * 100);
              return (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--rb-text)' }}>{seg.icon} {seg.label}</span>
                    <span style={{ fontSize: 12, color: seg.color, fontWeight: 700 }}>{cnt} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--rb-surface)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: seg.color, borderRadius: 3, transition: 'width .5s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Top Earners */}
        <Card>
          <SectionTitle icon="🏆" title="Top clients fidèles" sub="Par points gagnés" />
          {data.top_earners.length === 0
            ? <div style={{ color: 'var(--rb-muted)', fontSize: 13 }}>Aucun client encore</div>
            : data.top_earners.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 18, minWidth: 28 }}>{['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.user?.nom || e.user?.email || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--rb-muted)' }}>{fmtNum(e.total_earned)} pts gagnés</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: tierColor(e.tier?.name) }}>
                  {e.tier?.icon} {e.tier?.name}
                </span>
              </div>
            ))
          }
        </Card>
      </div>

      {/* Tiers */}
      <Card>
        <SectionTitle icon="💎" title="Système de niveaux (tiers)" sub="Basé sur le total de points gagnés" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {data.tiers.map(t => (
            <div key={t.name} style={{
              background: tierColor(t.name) + '15', border: `1.5px solid ${tierColor(t.name)}40`,
              borderRadius: 12, padding: '12px 14px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 28 }}>{t.icon}</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: tierColor(t.name) }}>{t.name}</div>
              <div style={{ fontSize: 11, color: 'var(--rb-muted)', marginTop: 2 }}>
                {t.min === 0 ? `0–${t.max}` : t.max === Infinity ? `${t.min}+` : `${t.min}–${t.max}`} pts
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: tierColor(t.name), marginTop: 4 }}>
                ×{t.bonus_rate} multiplicateur
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Moteur auto */}
      <Card>
        <SectionTitle icon="⚙️" title="Moteur de fidélisation automatique"
          sub="Recalcule les segments, badges, et envoie les offres anniversaires" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Btn onClick={handleRun} disabled={running} color="#8b5cf6">
            {running ? '⏳ Calcul en cours…' : '▶ Exécuter le moteur maintenant'}
          </Btn>
          <span style={{ fontSize: 12, color: 'var(--rb-muted)' }}>
            Met à jour les segments, attribue les badges, envoie les coupons anniversaires
          </span>
        </div>
      </Card>
    </div>
  );
}

// ── Tab : Clients ─────────────────────────────────────────────────────────────

function CustomersTab({ api }) {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [segment, setSegment]     = useState('');
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState(null);
  const [detail, setDetail]       = useState(null);
  const [pointsModal, setPointsModal] = useState(null);
  const [pointsForm, setPointsForm]   = useState({ points: '', reason: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page });
      if (segment) params.set('segment', segment);
      if (search)  params.set('search', search);
      const d = await api.get(`/loyalty/admin/customers?${params}`);
      setCustomers(d.customers || []);
      setTotal(d.total || 0);
    } catch {} finally { setLoading(false); }
  }, [api, page, segment, search]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = async (id) => {
    try {
      const d = await api.get(`/loyalty/admin/customer/${id}`);
      setDetail(d);
      setSelected(id);
    } catch {}
  };

  const sendPoints = async () => {
    if (!pointsModal) return;
    await api.post('/loyalty/admin/points', { user_id: pointsModal, ...pointsForm, points: Number(pointsForm.points) });
    setPointsModal(null);
    setPointsForm({ points: '', reason: '' });
    load();
    if (detail?.user?.id === pointsModal) loadDetail(pointsModal);
  };

  return (
    <div className={selected ? 'rb-loyalty-split' : undefined} style={{ display: 'grid', gap: 14 }}>
      <Card>
        <SectionTitle icon="👥" title="Clients fidèles" sub={`${total} clients`} />
        {/* Filtres */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Nom / email / tél…" style={{ ...inputStyle, maxWidth: 220 }} />
          <select value={segment} onChange={e => { setSegment(e.target.value); setPage(1); }}
            style={{ ...inputStyle, maxWidth: 160 }}>
            <option value="">Tous segments</option>
            {Object.entries(SEGMENTS).map(([k, s]) => (
              <option key={k} value={k}>{s.icon} {s.label}</option>
            ))}
          </select>
        </div>
        {/* Table */}
        {loading
          ? <div style={{ color: 'var(--rb-muted)', padding: 20 }}>Chargement…</div>
          : customers.length === 0
            ? <div style={{ color: 'var(--rb-muted)', padding: 20, textAlign: 'center' }}>Aucun client</div>
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--rb-border)' }}>
                      {['Client', 'Segment', 'Tier', 'Points', 'Commandes', 'CA', 'Dernière cmd', ''].map(h => (
                        <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--rb-muted)', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map(c => (
                      <tr key={c.id}
                        onClick={() => loadDetail(c.id)}
                        style={{
                          borderBottom: '1px solid var(--rb-border)',
                          cursor: 'pointer',
                          background: selected === c.id ? 'var(--rb-orange)10' : 'transparent',
                        }}>
                        <td style={{ padding: '8px 8px' }}>
                          <div style={{ fontWeight: 600 }}>{c.nom || '—'}</div>
                          <div style={{ color: 'var(--rb-muted)', fontSize: 10 }}>{c.email}</div>
                          {c.is_birthday_month && <span style={{ fontSize: 10 }}>🎂</span>}
                        </td>
                        <td style={{ padding: '8px 8px' }}>
                          <Pill label={SEGMENTS[c.segment]?.label || c.segment} color={SEGMENTS[c.segment]?.color || '#888'} icon={SEGMENTS[c.segment]?.icon} />
                        </td>
                        <td style={{ padding: '8px 8px', color: tierColor(c.tier?.name), fontWeight: 700 }}>
                          {c.tier?.icon} {c.tier?.name}
                        </td>
                        <td style={{ padding: '8px 8px', fontWeight: 700, color: '#f59e0b' }}>{fmtNum(c.points)}</td>
                        <td style={{ padding: '8px 8px' }}>{c.orders_count}</td>
                        <td style={{ padding: '8px 8px' }}>{fmtMoney(c.total_revenue)}</td>
                        <td style={{ padding: '8px 8px', color: 'var(--rb-muted)' }}>{ago(c.last_order_days_ago)}</td>
                        <td style={{ padding: '8px 8px' }}>
                          <Btn small outline onClick={e => { e.stopPropagation(); setPointsModal(c.id); }}
                            color="var(--rb-orange)">
                            +pts
                          </Btn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
          <Btn small outline onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} color="#94a3b8">‹ Préc</Btn>
          <span style={{ fontSize: 12, color: 'var(--rb-muted)', padding: '6px 8px' }}>Page {page}</span>
          <Btn small outline onClick={() => setPage(p => p + 1)} disabled={customers.length < 20} color="#94a3b8">Suiv ›</Btn>
        </div>
      </Card>

      {/* Détail client */}
      {detail && (
        <Card style={{ alignSelf: 'start', position: 'sticky', top: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{detail.user.nom || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--rb-muted)' }}>{detail.user.email}</div>
            </div>
            <button onClick={() => { setSelected(null); setDetail(null); }}
              style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--rb-muted)' }}>✕</button>
          </div>
          {/* Tier + points */}
          <div style={{
            background: tierColor(detail.tier?.name) + '20',
            borderRadius: 12, padding: '12px 14px', textAlign: 'center', marginBottom: 12,
          }}>
            <div style={{ fontSize: 30 }}>{detail.tier?.icon}</div>
            <div style={{ fontWeight: 800, color: tierColor(detail.tier?.name) }}>{detail.tier?.name}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{fmtNum(detail.loyalty?.points)} pts</div>
            <div style={{ fontSize: 11, color: 'var(--rb-muted)' }}>
              {fmtNum(detail.loyalty?.total_earned)} gagnés · {fmtNum(detail.loyalty?.total_spent)} dépensés
            </div>
          </div>
          {/* Badges */}
          {detail.badges.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--rb-muted)', marginBottom: 6 }}>🏅 Badges</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {detail.badges.map((b, i) => (
                  <span key={i} title={b.description}
                    style={{
                      background: 'var(--rb-surface)', border: '1px solid var(--rb-border)',
                      borderRadius: 8, padding: '4px 8px', fontSize: 11,
                    }}>
                    {b.icon} {b.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Dernières commandes */}
          {detail.recent_orders.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--rb-muted)', marginBottom: 6 }}>🛒 Commandes récentes</div>
              {detail.recent_orders.map((o, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: 'var(--rb-muted)' }}>{new Date(o.created_at).toLocaleDateString('fr-FR')}</span>
                  <span style={{ fontWeight: 600 }}>{fmtMoney(o.total_amount)}</span>
                </div>
              ))}
            </div>
          )}
          <Btn onClick={() => setPointsModal(detail.user.id)} color="var(--rb-orange)">+ Créditer des points</Btn>
        </Card>
      )}

      {/* Modal points */}
      {pointsModal && (
        <Modal title="Créditer / Débiter des points" onClose={() => setPointsModal(null)}>
          <FormField label="Points (positif = crédit, négatif = débit)">
            <input type="number" style={inputStyle}
              value={pointsForm.points}
              onChange={e => setPointsForm(f => ({ ...f, points: e.target.value }))}
              placeholder="ex: 100 ou -50" />
          </FormField>
          <FormField label="Raison">
            <input style={inputStyle}
              value={pointsForm.reason}
              onChange={e => setPointsForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="ex: Bonus fidélité offert" />
          </FormField>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={sendPoints} disabled={!pointsForm.points || !pointsForm.reason}>Confirmer</Btn>
            <Btn outline onClick={() => setPointsModal(null)} color="#94a3b8">Annuler</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Tab : Badges ──────────────────────────────────────────────────────────────

function BadgesTab({ api }) {
  const [badges, setBadges] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', icon: '🏅', description: '', condition_type: 'orders_count', condition_value: 1, points_bonus: 0 });

  const load = useCallback(async () => {
    try { const d = await api.get('/loyalty/admin/badges'); setBadges(d.badges || []); } catch {}
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try { await api.post('/loyalty/admin/badges', form); setShowForm(false); load(); } catch {}
  };

  const COND_LABELS = { orders_count: 'Commandes', total_spent: 'MAD dépensés', points_earned: 'Points gagnés', birthday: 'Anniversaire', manual: 'Manuel' };

  return (
    <Card>
      <SectionTitle icon="🏅" title="Badges" sub="Récompenses automatiques débloquées par les clients"
        action={<Btn small onClick={() => setShowForm(true)}>+ Nouveau badge</Btn>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {badges.map((b, i) => (
          <div key={i} style={{
            background: 'var(--rb-surface)', border: '1px solid var(--rb-border)',
            borderRadius: 12, padding: '14px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>{b.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{b.name}</div>
            <div style={{ fontSize: 11, color: 'var(--rb-muted)', marginTop: 4 }}>{b.description}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <Pill label={COND_LABELS[b.condition_type]} color="#3b82f6" />
              {b.condition_value > 0 && <Pill label={`≥ ${b.condition_value}`} color="#3b82f6" />}
              {b.points_bonus > 0 && <Pill label={`+${b.points_bonus}pts`} color="#16a34a" />}
            </div>
            <div style={{ fontSize: 10, color: 'var(--rb-muted)', marginTop: 6 }}>{b.holders} titulaires</div>
          </div>
        ))}
      </div>
      {showForm && (
        <Modal title="Créer un badge" onClose={() => setShowForm(false)}>
          {['name', 'icon', 'description'].map(f => (
            <FormField key={f} label={f.charAt(0).toUpperCase() + f.slice(1)}>
              <input style={inputStyle} value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} />
            </FormField>
          ))}
          <FormField label="Condition">
            <select style={inputStyle} value={form.condition_type} onChange={e => setForm(p => ({ ...p, condition_type: e.target.value }))}>
              {Object.entries(COND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </FormField>
          <FormField label="Valeur seuil">
            <input type="number" style={inputStyle} value={form.condition_value} onChange={e => setForm(p => ({ ...p, condition_value: +e.target.value }))} />
          </FormField>
          <FormField label="Bonus points offerts">
            <input type="number" style={inputStyle} value={form.points_bonus} onChange={e => setForm(p => ({ ...p, points_bonus: +e.target.value }))} />
          </FormField>
          <Btn onClick={create}>Créer le badge</Btn>
        </Modal>
      )}
    </Card>
  );
}

// ── Tab : Récompenses ─────────────────────────────────────────────────────────

function RewardsTab({ api }) {
  const [rewards, setRewards] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({
    name: '', icon: '🎁', description: '', points_cost: 100,
    reward_type: 'discount_percent', reward_value: 10, min_order: 0, valid_days: 30,
  });

  const load = useCallback(async () => {
    try { const d = await api.get('/loyalty/admin/rewards'); setRewards(d.rewards || []); } catch {}
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (editItem) {
      await api.patch(`/loyalty/admin/rewards/${editItem}`, form);
    } else {
      await api.post('/loyalty/admin/rewards', form);
    }
    setShowForm(false); setEditItem(null);
    setForm({ name: '', icon: '🎁', description: '', points_cost: 100, reward_type: 'discount_percent', reward_value: 10, min_order: 0, valid_days: 30 });
    load();
  };
  const toggle = async (r) => {
    await api.patch(`/loyalty/admin/rewards/${r.id}`, { active: !r.active });
    load();
  };
  const del = async (id) => {
    if (!confirm('Supprimer cette récompense ?')) return;
    await api.del(`/loyalty/admin/rewards/${id}`); load();
  };
  const startEdit = (r) => {
    setEditItem(r.id);
    setForm({ name: r.name, icon: r.icon, description: r.description || '', points_cost: r.points_cost, reward_type: r.reward_type, reward_value: r.reward_value, min_order: r.min_order, valid_days: r.valid_days });
    setShowForm(true);
  };

  return (
    <Card>
      <SectionTitle icon="🎁" title="Catalogue des récompenses" sub="Échangeables contre des points"
        action={<Btn small onClick={() => { setEditItem(null); setShowForm(true); }}>+ Nouvelle récompense</Btn>} />
      {rewards.length === 0
        ? <div style={{ color: 'var(--rb-muted)', padding: 20, textAlign: 'center' }}>Aucune récompense — créez-en une !</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {rewards.map(r => (
              <div key={r.id} style={{
                background: r.active ? 'var(--rb-surface)' : '#f1f5f9',
                border: '1px solid var(--rb-border)', borderRadius: 14, padding: '14px 16px',
                opacity: r.active ? 1 : 0.6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 28 }}>{r.icon}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => startEdit(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>✏️</button>
                    <button onClick={() => del(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>🗑️</button>
                  </div>
                </div>
                <div style={{ fontWeight: 700, marginTop: 6 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: 'var(--rb-muted)', marginTop: 2 }}>{r.description}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <Pill label={`${r.points_cost} pts`} color="#f59e0b" />
                  <Pill label={REWARD_TYPE_LABELS[r.reward_type]} color="#8b5cf6" />
                  <Pill label={`${r.reward_value}${r.reward_type === 'discount_percent' ? '%' : ' MAD'}`} color="#16a34a" />
                </div>
                <div style={{ marginTop: 10 }}>
                  <Btn small outline onClick={() => toggle(r)} color={r.active ? '#94a3b8' : '#16a34a'}>
                    {r.active ? 'Désactiver' : 'Activer'}
                  </Btn>
                </div>
                <div style={{ fontSize: 10, color: 'var(--rb-muted)', marginTop: 6 }}>{r.used_count} utilisations</div>
              </div>
            ))}
          </div>
        )
      }
      {showForm && (
        <Modal title={editItem ? 'Modifier la récompense' : 'Nouvelle récompense'} onClose={() => { setShowForm(false); setEditItem(null); }}>
          {[['Nom', 'name', 'text'], ['Icône', 'icon', 'text'], ['Description', 'description', 'text']].map(([l, f, t]) => (
            <FormField key={f} label={l}>
              <input type={t} style={inputStyle} value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} />
            </FormField>
          ))}
          <FormField label="Type de récompense">
            <select style={inputStyle} value={form.reward_type} onChange={e => setForm(p => ({ ...p, reward_type: e.target.value }))}>
              {Object.entries(REWARD_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </FormField>
          {[['Valeur', 'reward_value', 'number'], ['Coût en points', 'points_cost', 'number'],
            ['Commande min (MAD)', 'min_order', 'number'], ['Validité (jours)', 'valid_days', 'number']].map(([l, f, t]) => (
            <FormField key={f} label={l}>
              <input type={t} style={inputStyle} value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: +e.target.value }))} />
            </FormField>
          ))}
          <Btn onClick={save}>{editItem ? 'Modifier' : 'Créer'}</Btn>
        </Modal>
      )}
    </Card>
  );
}

// ── Tab : Coupons & Campagnes ─────────────────────────────────────────────────

function CouponsTab({ api }) {
  const [coupons, setCoupons] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    type: 'percent', value: 10, description: '', min_order: 0,
    target_segment: 'all', auto_type: 'manual', valid_until: '',
  });

  const load = useCallback(async () => {
    try { const d = await api.get('/loyalty/admin/coupons'); setCoupons(d.coupons || []); } catch {}
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    await api.post('/loyalty/admin/coupons', form);
    setShowForm(false); load();
  };

  const AUTO_TYPES = { manual: '✋ Manuel', birthday: '🎂 Anniversaire', inactivity: '💤 Réactivation', levelup: '🚀 Montée niveau', welcome: '👋 Bienvenue' };

  return (
    <Card>
      <SectionTitle icon="🎟️" title="Coupons & Campagnes ciblées" sub="Offres personnalisées par segment ou client"
        action={<Btn small onClick={() => setShowForm(true)}>+ Créer un coupon</Btn>} />
      {coupons.length === 0
        ? <div style={{ color: 'var(--rb-muted)', padding: 20, textAlign: 'center' }}>Aucun coupon de fidélité — créez-en un !</div>
        : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--rb-border)' }}>
                  {['Code', 'Type', 'Valeur', 'Segment', 'Déclencheur', 'Utilisations', 'Expiration'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--rb-muted)', fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coupons.map((c, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--rb-border)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700, fontFamily: 'monospace' }}>{c.code}</td>
                    <td style={{ padding: '8px 10px' }}>{c.type === 'percent' ? '%' : 'MAD'}</td>
                    <td style={{ padding: '8px 10px', color: '#16a34a', fontWeight: 700 }}>
                      -{c.value}{c.type === 'percent' ? '%' : ' MAD'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {c.target_segment !== 'all'
                        ? <Pill label={SEGMENTS[c.target_segment]?.label} color={SEGMENTS[c.target_segment]?.color} icon={SEGMENTS[c.target_segment]?.icon} />
                        : <span style={{ color: 'var(--rb-muted)' }}>Tous</span>
                      }
                    </td>
                    <td style={{ padding: '8px 10px' }}>{AUTO_TYPES[c.auto_type] || c.auto_type}</td>
                    <td style={{ padding: '8px 10px' }}>{c.used_count}/{c.max_uses || '∞'}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--rb-muted)' }}>
                      {c.valid_until ? new Date(c.valid_until).toLocaleDateString('fr-FR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
      {showForm && (
        <Modal title="Créer un coupon ciblé" onClose={() => setShowForm(false)}>
          <FormField label="Type de réduction">
            <select style={inputStyle} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
              <option value="percent">Pourcentage (%)</option>
              <option value="fixed">Montant fixe (MAD)</option>
            </select>
          </FormField>
          <FormField label="Valeur">
            <input type="number" style={inputStyle} value={form.value} onChange={e => setForm(p => ({ ...p, value: +e.target.value }))} />
          </FormField>
          <FormField label="Description (visible par le client)">
            <input style={inputStyle} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </FormField>
          <FormField label="Segment cible">
            <select style={inputStyle} value={form.target_segment} onChange={e => setForm(p => ({ ...p, target_segment: e.target.value }))}>
              <option value="all">Tous les clients</option>
              {Object.entries(SEGMENTS).map(([k, s]) => <option key={k} value={k}>{s.icon} {s.label}</option>)}
            </select>
          </FormField>
          <FormField label="Type d'automatisation">
            <select style={inputStyle} value={form.auto_type} onChange={e => setForm(p => ({ ...p, auto_type: e.target.value }))}>
              {Object.entries(AUTO_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </FormField>
          <FormField label="Commande minimum (MAD)">
            <input type="number" style={inputStyle} value={form.min_order} onChange={e => setForm(p => ({ ...p, min_order: +e.target.value }))} />
          </FormField>
          <FormField label="Date d'expiration (optionnel)">
            <input type="date" style={inputStyle} value={form.valid_until} onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))} />
          </FormField>
          <Btn onClick={create}>Créer et envoyer</Btn>
        </Modal>
      )}
    </Card>
  );
}

// ── Tab : Notifications ───────────────────────────────────────────────────────

function NotificationsTab({ api }) {
  const [form, setForm] = useState({ title: '', message: '', segment: 'all', type: 'promo' });
  const [sent, setSent] = useState(null);
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const d = await api.post('/loyalty/admin/notify', form);
      setSent(d.sent);
      setForm({ title: '', message: '', segment: 'all', type: 'promo' });
    } catch {} finally { setSending(false); }
  };

  return (
    <Card>
      <SectionTitle icon="📣" title="Notifications personnalisées" sub="Envoi ciblé par segment" />
      {sent !== null && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '10px 14px', marginBottom: 14, color: '#15803d', fontSize: 13 }}>
          ✅ Notification envoyée à {sent} client(s)
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <FormField label="Segment cible">
          <select style={inputStyle} value={form.segment} onChange={e => setForm(p => ({ ...p, segment: e.target.value }))}>
            <option value="all">Tous les clients</option>
            {Object.entries(SEGMENTS).map(([k, s]) => <option key={k} value={k}>{s.icon} {s.label}</option>)}
          </select>
        </FormField>
        <FormField label="Type de notification">
          <select style={inputStyle} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
            <option value="promo">Promotion</option>
            <option value="info">Information</option>
            <option value="event">Événement</option>
            <option value="reminder">Rappel</option>
          </select>
        </FormField>
      </div>
      <FormField label="Titre">
        <input style={inputStyle} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="ex: Offre spéciale weekend 🎉" />
      </FormField>
      <FormField label="Message">
        <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
          value={form.message}
          onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
          placeholder="Votre message…" />
      </FormField>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Btn onClick={send} disabled={sending || !form.title || !form.message}>
          {sending ? '⏳ Envoi…' : '📣 Envoyer la notification'}
        </Btn>
        {form.segment !== 'all' && (
          <span style={{ fontSize: 12, color: 'var(--rb-muted)' }}>
            Cible : {SEGMENTS[form.segment]?.icon} {SEGMENTS[form.segment]?.label}
          </span>
        )}
      </div>
    </Card>
  );
}

// ── Tab : Anniversaires ───────────────────────────────────────────────────────

function BirthdaysTab({ api }) {
  const [birthdays, setBirthdays] = useState([]);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await api.get(`/loyalty/admin/birthdays?days=${days}`); setBirthdays(d.birthdays || []); }
    catch {} finally { setLoading(false); }
  }, [api, days]);
  useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <SectionTitle icon="🎂" title="Anniversaires clients"
        sub="Coupons et points bonus envoyés automatiquement"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select style={{ ...inputStyle, maxWidth: 140 }} value={days} onChange={e => setDays(+e.target.value)}>
              {[7, 14, 30].map(d => <option key={d} value={d}>Prochain {d}j</option>)}
            </select>
          </div>
        }
      />
      {loading ? <div style={{ color: 'var(--rb-muted)' }}>Chargement…</div>
        : birthdays.length === 0
          ? <div style={{ color: 'var(--rb-muted)', padding: 20, textAlign: 'center' }}>Aucun anniversaire dans les {days} prochains jours</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {birthdays.map((b, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: b.days_until === 0 ? '#fef9c3' : 'var(--rb-surface)',
                  border: b.days_until === 0 ? '1px solid #fde68a' : '1px solid var(--rb-border)',
                  borderRadius: 12, padding: '12px 14px',
                }}>
                  <span style={{ fontSize: 28 }}>🎂</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{b.nom || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--rb-muted)' }}>
                      {b.email || b.phone || ''}
                      {' · '}
                      {new Date(b.birthday).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {b.days_until === 0
                      ? <span style={{ fontWeight: 800, color: '#f59e0b' }}>🎉 Aujourd'hui !</span>
                      : <span style={{ fontSize: 13, color: 'var(--rb-muted)' }}>Dans {b.days_until}j</span>
                    }
                    <div style={{ fontSize: 11, color: '#f59e0b' }}>{b.loyalty_points} pts</div>
                  </div>
                </div>
              ))}
            </div>
          )
      }
    </Card>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',      icon: '📊', label: 'Vue globale'    },
  { id: 'customers',     icon: '👥', label: 'Clients'        },
  { id: 'badges',        icon: '🏅', label: 'Badges'         },
  { id: 'rewards',       icon: '🎁', label: 'Récompenses'    },
  { id: 'coupons',       icon: '🎟️', label: 'Campagnes'      },
  { id: 'notifications', icon: '📣', label: 'Notifications'  },
  { id: 'birthdays',     icon: '🎂', label: 'Anniversaires'  },
];

export default function LoyaltyPage() {
  const api = useApi();
  const [tab, setTab]         = useState('overview');
  const [overview, setOverview] = useState(null);
  const [loadingOv, setLoadingOv] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoadingOv(true);
    try { const d = await api.get('/loyalty/admin/overview'); setOverview(d); }
    catch {} finally { setLoadingOv(false); }
  }, [api]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const runEngine = async () => {
    try {
      await api.post('/loyalty/admin/run-engine', {});
      await loadOverview();
    } catch {}
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--rb-text)', margin: 0 }}>
          💎 Fidélisation Intelligente
        </h1>
        <p style={{ color: 'var(--rb-muted)', fontSize: 13, margin: '4px 0 0' }}>
          Gardez vos clients sans dépendre des plateformes tierces
        </p>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: tab === t.id ? '2px solid var(--rb-orange)' : '1.5px solid var(--rb-border)',
            background: tab === t.id ? 'var(--rb-orange)' : 'var(--rb-card)',
            color: tab === t.id ? '#fff' : 'var(--rb-muted)',
            transition: 'all .2s',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Contenu par onglet */}
      {tab === 'overview'      && <OverviewTab data={overview} onRunEngine={runEngine} />}
      {tab === 'customers'     && <CustomersTab api={api} />}
      {tab === 'badges'        && <BadgesTab api={api} />}
      {tab === 'rewards'       && <RewardsTab api={api} />}
      {tab === 'coupons'       && <CouponsTab api={api} />}
      {tab === 'notifications' && <NotificationsTab api={api} />}
      {tab === 'birthdays'     && <BirthdaysTab api={api} />}
    </div>
  );
}
