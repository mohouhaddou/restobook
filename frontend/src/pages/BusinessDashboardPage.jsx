import React, { useEffect, useState, useCallback } from 'react';
import { useApi } from '../hooks/useApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(n);
}
function fmtNum(n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR'); }
function fmtPct(n) { return n == null ? '—' : `${n}%`; }
function stars(n) {
  const full = Math.round(n);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}
function growthColor(g) {
  if (g == null) return 'var(--rb-muted)';
  return g >= 0 ? 'var(--rb-success)' : 'var(--rb-danger)';
}
function growthIcon(g) { return g == null ? '' : g >= 0 ? '▲' : '▼'; }

// ── Composants de base ────────────────────────────────────────────────────────

function KpiCard({ icon, value, label, sub, growth, color = 'var(--rb-orange)', loading }) {
  return (
    <div style={{
      background: 'var(--rb-card)',
      border: '1px solid var(--rb-border)',
      borderRadius: 16,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      position: 'relative',
      overflow: 'hidden',
      minHeight: 130,
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: 4, height: '100%',
        background: color, borderRadius: '16px 0 0 16px',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 26 }}>{icon}</span>
        {growth != null && (
          <span style={{ fontSize: 12, fontWeight: 700, color: growthColor(growth) }}>
            {growthIcon(growth)} {Math.abs(growth)}%
          </span>
        )}
      </div>
      {loading
        ? <div style={{ height: 36, width: '60%', background: 'var(--rb-surface)', borderRadius: 8, marginTop: 4 }} />
        : <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      }
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--rb-text)' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--rb-muted)' }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 8 }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--rb-text)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--rb-muted)' }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: 'var(--rb-card)',
      border: '1px solid var(--rb-border)',
      borderRadius: 16,
      padding: '18px 20px',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Barre horizontale ─────────────────────────────────────────────────────────

function HBar({ label, value, max, color, sub }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--rb-text)' }}>{label}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color }}>{fmtNum(value)}</span>
          {sub && <span style={{ fontSize: 11, color: 'var(--rb-muted)' }}>{sub}</span>}
        </div>
      </div>
      <div style={{ height: 8, background: 'var(--rb-surface)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          borderRadius: 4, transition: 'width .6s cubic-bezier(.4,0,.2,1)',
        }} />
      </div>
    </div>
  );
}

// ── Graphique CA / commandes par jour ─────────────────────────────────────────

function DayChart({ byDay, period }) {
  if (!byDay || byDay.length === 0) return (
    <div style={{ color: 'var(--rb-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
      Aucune donnée pour ce graphique
    </div>
  );

  const maxRev = Math.max(...byDay.map(d => d.revenue), 1);
  const days = byDay.slice(-14);

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 4,
        minWidth: days.length * 32, height: 90, paddingBottom: 4,
      }}>
        {days.map((d, i) => {
          const h = Math.max(4, Math.round((d.revenue / maxRev) * 80));
          const dayLabel = new Date(d.day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' });
          return (
            <div key={i} title={`${dayLabel} — ${fmtMoney(d.revenue)} · ${d.orders} cmd`}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 28 }}>
              <div style={{
                width: '80%', height: h, background: 'var(--rb-orange)',
                borderRadius: '4px 4px 0 0', opacity: 0.85,
                transition: 'height .4s',
              }} />
              <div style={{ fontSize: 9, color: 'var(--rb-muted)', transform: 'rotate(-30deg)', transformOrigin: 'center', whiteSpace: 'nowrap' }}>
                {dayLabel}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Distribution étoiles ──────────────────────────────────────────────────────

function StarDistribution({ distribution, total }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {distribution.map(({ stars: s, count }) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--rb-warning)', minWidth: 28, textAlign: 'right' }}>
            {s}★
          </span>
          <div style={{ flex: 1, height: 8, background: 'var(--rb-surface)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${total > 0 ? Math.round((count / total) * 100) : 0}%`,
              background: s >= 4 ? 'var(--rb-success)' : s === 3 ? 'var(--rb-warning)' : 'var(--rb-danger)',
              borderRadius: 4,
            }} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--rb-muted)', minWidth: 24 }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

// ── Prévision 7 jours ─────────────────────────────────────────────────────────

function ForecastChart({ forecast }) {
  if (!forecast || forecast.length === 0) return null;
  const max = Math.max(...forecast.map(f => f.expected), 1);

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 100 }}>
      {forecast.map((f, i) => {
        const h = max > 0 ? Math.max(8, Math.round((f.expected / max) * 80)) : 8;
        const isToday = i === 0;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--rb-muted)' }}>{f.expected}</span>
            <div style={{
              width: '80%', height: h,
              background: isToday ? 'var(--rb-orange)' : 'var(--rb-info)',
              borderRadius: '4px 4px 0 0', opacity: isToday ? 1 : 0.7,
            }} />
            <span style={{ fontSize: 10, color: 'var(--rb-muted)', fontWeight: 600 }}>{f.day}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Recommandations ──────────────────────────────────────────────────────────

const REC_STYLES = {
  success: { bg: '#f0fdf4', border: '#86efac', text: '#15803d' },
  warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  danger:  { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c' },
  info:    { bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' },
};

function RecCard({ rec }) {
  const s = REC_STYLES[rec.type] || REC_STYLES.info;
  return (
    <div style={{
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 12, padding: '12px 14px',
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{rec.icon}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: s.text, marginBottom: 2 }}>{rec.title}</div>
        <div style={{ fontSize: 12, color: s.text, opacity: 0.85, lineHeight: 1.5 }}>{rec.text}</div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

const PERIODS = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week',  label: '7 derniers jours' },
  { value: 'month', label: '30 derniers jours' },
  { value: 'quarter', label: '90 derniers jours' },
];

export default function BusinessDashboardPage() {
  const { get } = useApi();
  const [period, setPeriod] = useState('month');
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (p = period, silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const d = await get(`/business/overview?period=${p}`);
      setData(d);
    } catch (e) {
      setError(e.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [get, period]);

  useEffect(() => { load(period); }, [period]);

  const handlePeriod = (p) => { setPeriod(p); };

  // ── Render ─────────────────────────────────────────────────────────────────

  const topMax = data?.top_items?.[0]?.qty || 1;

  return (
    <div style={{ display: 'grid', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--rb-text)', margin: 0 }}>
            📊 Dashboard Business
          </h1>
          {data && (
            <p style={{ color: 'var(--rb-muted)', fontSize: 13, margin: '4px 0 0' }}>
              {data.org_name} · {data.org_type === 'canteen' ? 'Cantine' : 'Restaurant'}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {PERIODS.map(p => (
            <button key={p.value}
              onClick={() => handlePeriod(p.value)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: period === p.value ? '2px solid var(--rb-orange)' : '1.5px solid var(--rb-border)',
                background: period === p.value ? 'var(--rb-orange)' : 'var(--rb-card)',
                color: period === p.value ? '#fff' : 'var(--rb-muted)',
                transition: 'all .2s',
              }}>
              {p.label}
            </button>
          ))}
          <button onClick={() => load(period, true)}
            style={{
              padding: '6px 10px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
              border: '1.5px solid var(--rb-border)', background: 'var(--rb-card)',
              color: 'var(--rb-muted)',
            }}
            title="Rafraîchir">
            {refreshing ? '⏳' : '🔄'}
          </button>
        </div>
      </div>

      {/* ── Erreur ── */}
      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12,
          padding: '12px 16px', color: '#b91c1c', fontSize: 13,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── KPI Cards 3 grandes ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <KpiCard
          icon="💰"
          value={loading ? null : fmtMoney(data?.revenue?.total)}
          label="Chiffre d'affaires"
          sub={loading ? null : `Ticket moyen : ${fmtMoney(data?.revenue?.avg_ticket)}`}
          growth={data?.revenue?.growth}
          color="var(--rb-orange)"
          loading={loading}
        />
        <KpiCard
          icon="🛒"
          value={loading ? null : fmtNum(data?.orders?.total)}
          label="Commandes totales"
          sub={loading ? null : `${fmtNum(data?.orders?.active)} actives · ${fmtNum(data?.orders?.cancelled)} annulées`}
          color="var(--rb-info)"
          loading={loading}
        />
        <KpiCard
          icon="⭐"
          value={loading ? null : (data?.satisfaction?.avg_rating > 0 ? `${data.satisfaction.avg_rating}/5` : 'N/A')}
          label="Satisfaction client"
          sub={loading ? null : `${fmtNum(data?.satisfaction?.count)} avis · ${stars(data?.satisfaction?.avg_rating || 0)}`}
          color="var(--rb-warning)"
          loading={loading}
        />
      </div>

      {/* ── Taux en ligne ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
        {[
          {
            icon: '📅',
            value: loading ? '…' : fmtPct(data?.orders?.reservation_rate),
            label: data?.is_canteen ? 'Taux de réservation' : 'Taux de conversion',
            color: 'var(--rb-success)',
          },
          {
            icon: '❌',
            value: loading ? '…' : fmtPct(data?.orders?.cancellation_rate),
            label: 'Taux d\'annulation',
            color: data?.orders?.cancellation_rate > 20 ? 'var(--rb-danger)' : 'var(--rb-warning)',
          },
          {
            icon: '♻️',
            value: loading ? '…' : fmtPct(data?.waste?.rate),
            label: 'Taux de gaspillage',
            color: data?.waste?.rate > 25 ? 'var(--rb-danger)' : 'var(--rb-warning)',
          },
          {
            icon: '🔥',
            value: loading ? '…' : fmtNum(data?.top_items?.[0]?.qty || 0),
            label: loading ? '—' : (data?.top_items?.[0]?.libelle ? `Bestseller : ${data.top_items[0].libelle}` : 'Bestseller'),
            color: 'var(--rb-orange)',
          },
        ].map((item, i) => (
          <div key={i} style={{
            background: 'var(--rb-card)', border: '1px solid var(--rb-border)',
            borderRadius: 14, padding: '14px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{item.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 11, color: 'var(--rb-muted)', fontWeight: 600, marginTop: 4, lineHeight: 1.3 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* ── Plats + Gaspillage + CA par jour ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>

        {/* Plats les plus vendus */}
        <Card>
          <SectionTitle icon="🏆" title="Plats les plus vendus" subtitle={`Top ${data?.top_items?.length || 5} sur la période`} />
          {loading
            ? <div style={{ color: 'var(--rb-muted)', fontSize: 13 }}>Chargement…</div>
            : !data?.top_items?.length
              ? <div style={{ color: 'var(--rb-muted)', fontSize: 13 }}>Aucune donnée</div>
              : data.top_items.map((item, i) => (
                <HBar key={i}
                  label={`${i + 1}. ${item.libelle || '—'}`}
                  value={item.qty}
                  max={topMax}
                  color={i === 0 ? 'var(--rb-warning)' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'var(--rb-orange)'}
                  sub={item.revenue ? fmtMoney(item.revenue) : null}
                />
              ))
          }
        </Card>

        {/* Plats les moins vendus */}
        <Card>
          <SectionTitle icon="📉" title="Plats les moins vendus" subtitle="À reconsidérer ou promouvoir" />
          {loading
            ? <div style={{ color: 'var(--rb-muted)', fontSize: 13 }}>Chargement…</div>
            : !data?.bottom_items?.length
              ? <div style={{ color: 'var(--rb-muted)', fontSize: 13 }}>Aucune donnée</div>
              : data.bottom_items.map((item, i) => (
                <HBar key={i}
                  label={`${item.libelle || '—'}`}
                  value={item.qty}
                  max={topMax}
                  color="var(--rb-danger)"
                  sub={item.revenue ? fmtMoney(item.revenue) : null}
                />
              ))
          }
        </Card>

        {/* CA par jour */}
        {data && !data.is_canteen && (
          <Card style={{ gridColumn: 'span 1' }}>
            <SectionTitle icon="📈" title="CA par jour" subtitle="Évolution sur la période sélectionnée" />
            <DayChart byDay={data?.orders?.by_day} period={period} />
          </Card>
        )}
      </div>

      {/* ── Satisfaction + Gaspillage ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>

        {/* Satisfaction détaillée */}
        <Card>
          <SectionTitle icon="⭐" title="Satisfaction client" subtitle="Distribution des notes" />
          {loading
            ? <div style={{ color: 'var(--rb-muted)', fontSize: 13 }}>Chargement…</div>
            : data?.satisfaction?.count === 0
              ? <div style={{ color: 'var(--rb-muted)', fontSize: 13 }}>Aucun avis reçu sur cette période</div>
              : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ fontSize: 40, fontWeight: 900, color: 'var(--rb-warning)' }}>
                      {data?.satisfaction?.avg_rating || '—'}
                    </div>
                    <div>
                      <div style={{ fontSize: 18, color: 'var(--rb-warning)' }}>
                        {stars(data?.satisfaction?.avg_rating || 0)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--rb-muted)' }}>
                        {fmtNum(data?.satisfaction?.count)} avis
                      </div>
                    </div>
                  </div>
                  <StarDistribution
                    distribution={data?.satisfaction?.distribution || []}
                    total={data?.satisfaction?.count || 0}
                  />
                </div>
              )
          }
        </Card>

        {/* Estimation du gaspillage */}
        <Card>
          <SectionTitle icon="♻️" title="Estimation du gaspillage" subtitle="Commandes annulées / no-show" />
          {loading
            ? <div style={{ color: 'var(--rb-muted)', fontSize: 13 }}>Chargement…</div>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Repas gaspillés', value: fmtNum(data?.waste?.count), color: 'var(--rb-danger)', icon: '🗑️' },
                    { label: 'Valeur estimée', value: fmtMoney(data?.waste?.value), color: 'var(--rb-danger)', icon: '💸' },
                    { label: 'Taux de gaspillage', value: fmtPct(data?.waste?.rate), color: data?.waste?.rate > 25 ? 'var(--rb-danger)' : 'var(--rb-warning)', icon: '📊' },
                    { label: 'Objectif cible', value: '< 10%', color: 'var(--rb-success)', icon: '🎯' },
                  ].map((item, i) => (
                    <div key={i} style={{
                      background: 'var(--rb-surface)', borderRadius: 10,
                      padding: '10px 12px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 20, marginBottom: 2 }}>{item.icon}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.value}</div>
                      <div style={{ fontSize: 10, color: 'var(--rb-muted)', fontWeight: 600 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
                {data?.waste?.rate > 10 && (
                  <div style={{
                    background: '#fffbeb', border: '1px solid #fde68a',
                    borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#92400e',
                  }}>
                    💡 Réduisez le gaspillage en ajustant vos quantités selon les prévisions de demande ci-dessous.
                  </div>
                )}
              </div>
            )
          }
        </Card>

      </div>

      {/* ── Prévisions de demande ── */}
      <Card>
        <SectionTitle
          icon="🔮"
          title="Prévisions de demande — 7 prochains jours"
          subtitle="Basé sur la moyenne des 4 dernières semaines au même jour"
        />
        {loading
          ? <div style={{ color: 'var(--rb-muted)', fontSize: 13 }}>Chargement…</div>
          : (
            <div>
              <ForecastChart forecast={data?.forecast || []} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                {(data?.forecast || []).map((f, i) => (
                  <div key={i} style={{
                    background: i === 0 ? 'var(--rb-orange)15' : 'var(--rb-surface)',
                    border: `1px solid ${i === 0 ? 'var(--rb-orange)' : 'var(--rb-border)'}`,
                    borderRadius: 10, padding: '8px 12px', textAlign: 'center', minWidth: 70,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? 'var(--rb-orange)' : 'var(--rb-muted)' }}>
                      {f.day}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--rb-text)' }}>{f.expected}</div>
                    <div style={{ fontSize: 9, color: 'var(--rb-muted)' }}>
                      {new Date(f.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        }
      </Card>

      {/* ── Recommandations IA ── */}
      <Card>
        <SectionTitle
          icon="🤖"
          title="Recommandations IA"
          subtitle="Analyse automatique de vos indicateurs — suggestions d'actions prioritaires"
        />
        {loading
          ? <div style={{ color: 'var(--rb-muted)', fontSize: 13 }}>Analyse en cours…</div>
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
              {(data?.recommendations || []).map((rec, i) => (
                <RecCard key={i} rec={rec} />
              ))}
            </div>
          )
        }
        <div style={{
          marginTop: 14, padding: '10px 14px',
          background: 'var(--rb-surface)', borderRadius: 10,
          fontSize: 11, color: 'var(--rb-muted)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          ℹ️ Les recommandations sont générées automatiquement à partir de vos données métier. Rafraîchissez pour actualiser.
        </div>
      </Card>

    </div>
  );
}
