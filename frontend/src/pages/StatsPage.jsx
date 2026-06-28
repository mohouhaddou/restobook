import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';

function today() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function pct(val, total) {
  if (!total) return 0;
  return Math.round((val / total) * 100);
}

function ProgressBar({ value, max, color = 'var(--rb-orange)', label, count }) {
  const p = pct(value, max);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color }}>{count}</span>
          <span style={{ fontSize: 11, color: 'var(--rb-muted)' }}>{p}%</span>
        </div>
      </div>
      <div style={{ height: 8, background: 'var(--rb-surface)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${p}%`, background: color,
          borderRadius: 4, transition: 'width .5s ease-out',
        }} />
      </div>
    </div>
  );
}

function MiniCard({ value, label, icon, color }) {
  return (
    <div style={{
      background: color + '15', border: `1px solid ${color}30`,
      borderRadius: 12, padding: '14px 16px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 11, color: 'var(--rb-muted)', marginTop: 4, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

export default function StatsPage() {
  const { get } = useApi();
  const [date, setDate]     = useState(today());
  const [daily, setDaily]   = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [topItems, setTop]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => { loadAll(); }, [date]);

  async function loadAll() {
    setLoading(true);
    try {
      const [d, w, t, db] = await Promise.all([
        get(`/stats/daily?date=${date}`),
        get(`/stats/weekly?from=${date}`),
        get('/stats/top-items?days=30'),
        get('/stats/dashboard'),
      ]);
      setDaily(d); setWeekly(w); setTop(t.items || []); setDashboard(db);
    } catch {}
    finally { setLoading(false); }
  }

  const s = daily?.summary || {};
  const totalJour = (s.confirmed || 0) + (s.served || 0) + (s.cancelled || 0);
  const serviceRate = s.served && (s.served + s.confirmed)
    ? pct(s.served, s.served + s.confirmed) : 0;

  // Couleurs pour barres par jour de semaine
  const DAY_COLORS = ['#FF8A00','#2563EB','#16A34A','#9333EA','#D97706'];

  return (
    <>
      {/* Header */}
      <div className="card p-0" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rb-border)' }}>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <h4 className="section-title mb-0">Statistiques</h4>
            <div className="d-flex gap-2">
              <input type="date" className="form-control form-control-sm" style={{ width: 'auto' }}
                value={date} onChange={e => setDate(e.target.value)} />
              {loading && (
                <div className="spinner-border spinner-border-sm text-secondary"
                  style={{ width: 18, height: 18, alignSelf: 'center' }} />
              )}
            </div>
          </div>
        </div>

        {/* KPIs dashboard */}
        {dashboard && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rb-border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rb-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
              Aujourd'hui — {dashboard.date}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
              <MiniCard value={dashboard.today?.total}     label="Total"        icon="📊" color="#78716C" />
              <MiniCard value={dashboard.today?.confirmed} label="Confirmées"   icon="🎯" color="var(--rb-blue)" />
              <MiniCard value={dashboard.today?.served}    label="Servies"      icon="✅" color="var(--rb-green)" />
              <MiniCard value={dashboard.today?.cancelled} label="Annulées"     icon="❌" color="#DC2626" />
              <MiniCard value={`${serviceRate}%`}          label="Taux service" icon="📈" color="var(--rb-orange)" />
              <MiniCard value={dashboard.users?.active}    label="Utilisateurs" icon="👥" color="#9333EA" />
            </div>
          </div>
        )}
      </div>

      {/* Stats du jour — barres */}
      {daily && totalJour > 0 && (
        <div className="card p-0" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--rb-border)' }}>
            <h5 className="section-title mb-0" style={{ fontSize: 15 }}>Journée du {date}</h5>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <ProgressBar value={s.confirmed} max={totalJour} label="Confirmées (à servir)" count={s.confirmed} color="var(--rb-blue)" />
                <ProgressBar value={s.served}    max={totalJour} label="Servies / retirées"    count={s.served}    color="var(--rb-green)" />
                <ProgressBar value={s.cancelled} max={totalJour} label="Annulées"              count={s.cancelled} color="#DC2626" />
                <ProgressBar value={s.no_show}   max={totalJour} label="No-show estimé"        count={s.no_show}   color="#D97706" />
              </div>
              <div className="col-12 col-md-6">
                {/* Top plats du jour */}
                {(daily.by_item || []).length > 0 && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--rb-muted)', marginBottom: 10 }}>
                      DÉTAIL PAR PLAT
                    </div>
                    {daily.by_item.slice(0, 6).map((it, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: it.type === 'plat' ? 'var(--rb-orange)' :
                            it.type === 'entrée' ? 'var(--rb-green)' :
                            it.type === 'dessert' ? '#9333EA' : 'var(--rb-blue)',
                        }} />
                        <div style={{ flex: 1, fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {it.libelle}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{it.reserved}</span>
                          {it.wasted > 0 && (
                            <span style={{ fontSize: 10, color: '#DC2626', fontWeight: 600 }}>−{it.wasted}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats hebdo — barres par jour */}
      {weekly && (
        <div className="card p-0" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--rb-border)' }}>
            <div className="d-flex justify-content-between align-items-center">
              <h5 className="section-title mb-0" style={{ fontSize: 15 }}>
                Semaine {weekly.from} → {weekly.to}
              </h5>
              <div style={{ display: 'flex', gap: 12 }}>
                {[
                  { label: 'Total',    v: weekly.totals.total     },
                  { label: 'Servies',  v: weekly.totals.picked,   c: 'var(--rb-green)' },
                  { label: 'Annulées', v: weekly.totals.cancelled, c: '#DC2626' },
                ].map(x => (
                  <div key={x.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: x.c || 'var(--rb-text)' }}>{x.v}</div>
                    <div style={{ fontSize: 10, color: 'var(--rb-muted)' }}>{x.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ padding: '16px 20px' }}>
            {/* Barres horizontales par jour */}
            {weekly.days.map((d, i) => {
              const isToday = d.date === today();
              const total = d.total || 1;
              return (
                <div key={d.date} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{
                      fontSize: 12, fontWeight: isToday ? 700 : 500,
                      color: isToday ? 'var(--rb-orange)' : 'var(--rb-text)',
                    }}>
                      {new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                      {isToday && ' ·'}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{d.total}</span>
                  </div>
                  {/* Barre segmentée */}
                  <div style={{ height: 10, background: 'var(--rb-surface)', borderRadius: 5, overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${pct(d.picked, d.total || 1)}%`, background: 'var(--rb-green)', transition: 'width .5s' }} />
                    <div style={{ width: `${pct(d.confirmed, d.total || 1)}%`, background: DAY_COLORS[i % 5], transition: 'width .5s' }} />
                    <div style={{ width: `${pct(d.cancelled, d.total || 1)}%`, background: '#FCA5A5', transition: 'width .5s' }} />
                  </div>
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              {[
                { color: 'var(--rb-green)', label: 'Servies' },
                { color: 'var(--rb-orange)', label: 'Confirmées' },
                { color: '#FCA5A5', label: 'Annulées' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--rb-muted)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top 10 plats */}
      {topItems.length > 0 && (
        <div className="card p-0" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--rb-border)' }}>
            <h5 className="section-title mb-0" style={{ fontSize: 15 }}>Top plats — 30 derniers jours</h5>
          </div>
          <div style={{ padding: '16px 20px' }}>
            {topItems.map((it, i) => {
              const maxTotal = topItems[0]?.total || 1;
              return (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--rb-muted-2)', width: 20 }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{it.libelle}</span>
                      <span style={{ fontSize: 10, color: 'var(--rb-muted)', background: 'var(--rb-surface)', padding: '1px 6px', borderRadius: 20 }}>
                        {it.type}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--rb-green)', fontWeight: 600 }}>{it.served} servis</span>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{it.total}</span>
                    </div>
                  </div>
                  <div style={{ height: 6, background: 'var(--rb-surface)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pct(it.total, maxTotal)}%`,
                      background: i === 0 ? 'var(--rb-orange)' : i < 3 ? 'var(--rb-blue)' : 'var(--rb-muted-2)',
                      borderRadius: 3, transition: 'width .5s ease-out',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
