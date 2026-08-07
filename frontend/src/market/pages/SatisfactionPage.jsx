import React, { useEffect, useMemo, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { Toast } from '../../components/ui/Toast';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function Kpi({ label, value, hint }) {
  return (
    <div className="card p-3 border-0">
      <div style={{ fontSize: 11, color: 'var(--rb-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: 'var(--rb-muted)' }}>{hint}</div>}
    </div>
  );
}

export default function SatisfactionPage() {
  const { get } = useApi();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [dashboard, setDashboard] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [kind, setKind] = useState('success');

  useEffect(() => { load(); }, [from, to]);

  async function load() {
    setLoading(true);
    try {
      const qs = `from=${from}&to=${to}`;
      const [dash, list] = await Promise.all([
        get(`/satisfaction/dashboard?${qs}`),
        get(`/satisfaction/reviews?${qs}`),
      ]);
      setDashboard(dash);
      setReviews(list.reviews || []);
    } catch (err) {
      setMsg(err.message);
      setKind('error');
    } finally {
      setLoading(false);
    }
  }

  const summary = dashboard?.summary || {};
  const sentimentLabel = useMemo(() => ({
    positive: 'Satisfaction positive',
    neutral: 'Satisfaction mitigée',
    negative: 'Satisfaction fragile',
  }[summary.sentiment] || 'Non calculé'), [summary.sentiment]);

  return (
    <>
      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>Satisfaction client</h1>
          <div style={{ color: 'var(--rb-muted)', fontSize: 13 }}>
            Avis, notes par plat, commentaires négatifs et recommandations IA.
          </div>
        </div>
        <div className="d-flex gap-2">
          <input type="date" className="form-control form-control-sm" value={from} onChange={e => setFrom(e.target.value)} />
          <input type="date" className="form-control form-control-sm" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="card p-4 text-center text-muted">Analyse de satisfaction…</div>
      ) : (
        <>
          <div className="row g-3 mb-3">
            <div className="col-6 col-lg-3"><Kpi label="Note moyenne" value={summary.avg_rating ? `${summary.avg_rating}/5` : '-'} hint={sentimentLabel} /></div>
            <div className="col-6 col-lg-3"><Kpi label="Avis" value={summary.reviews_count || 0} hint="sur la période" /></div>
            <div className="col-6 col-lg-3"><Kpi label="Avis négatifs" value={summary.negative_count || 0} hint={`${summary.negative_rate || 0}% des avis`} /></div>
            <div className="col-6 col-lg-3"><Kpi label="Problèmes détectés" value={dashboard?.recurrent_problems?.length || 0} hint="thèmes IA" /></div>
          </div>

          <div className="row g-3">
            <div className="col-lg-6">
              <Panel title="Plats les plus appréciés">
                <RankedItems items={dashboard?.top_liked_items || []} empty="Aucune note par plat." />
              </Panel>
            </div>
            <div className="col-lg-6">
              <Panel title="Plats à surveiller">
                <RankedItems items={dashboard?.low_rated_items || []} empty="Aucun signal faible détecté." />
              </Panel>
            </div>
            <div className="col-lg-5">
              <Panel title="Plaintes récurrentes">
                {(dashboard?.recurrent_problems || []).length === 0 ? (
                  <div className="text-muted small">Aucun problème récurrent détecté.</div>
                ) : dashboard.recurrent_problems.map(problem => (
                  <div key={problem.tag} className="d-flex justify-content-between py-2 border-bottom">
                    <span>{problem.label}</span><strong>{problem.count}</strong>
                  </div>
                ))}
              </Panel>
            </div>
            <div className="col-lg-7">
              <Panel title="Recommandations concrètes">
                <ul style={{ marginBottom: 0, paddingLeft: 18 }}>
                  {(dashboard?.recommendations || []).map((rec, idx) => <li key={idx}>{rec}</li>)}
                </ul>
              </Panel>
            </div>
            <div className="col-12">
              <Panel title="Avis négatifs et commentaires récents">
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Note</th>
                        <th>Sentiment</th>
                        <th>Commentaire</th>
                        <th>Problèmes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviews.map(review => (
                        <tr key={review.id}>
                          <td>{review.created_at ? new Date(review.created_at).toLocaleDateString('fr-FR') : '-'}</td>
                          <td>{review.rating}/5</td>
                          <td>{review.sentiment || '-'}</td>
                          <td style={{ maxWidth: 360 }}>{review.comment || <span className="text-muted">Sans commentaire</span>}</td>
                          <td>{(review.issue_tags || []).map(tag => <span key={tag} className="badge text-bg-warning me-1">{tag}</span>)}</td>
                        </tr>
                      ))}
                      {reviews.length === 0 && (
                        <tr><td colSpan="5" className="text-center text-muted py-4">Aucun avis sur la période.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Panel({ title, children }) {
  return (
    <div className="card p-3 h-100">
      <h2 style={{ fontSize: 16, marginBottom: 12 }}>{title}</h2>
      {children}
    </div>
  );
}

function RankedItems({ items, empty }) {
  if (!items.length) return <div className="text-muted small">{empty}</div>;
  return items.map(item => (
    <div key={`${item.menu_item_id || item.libelle}`} className="d-flex justify-content-between py-2 border-bottom">
      <span style={{ fontWeight: 600 }}>{item.libelle}</span>
      <span>{item.avg_rating}/5 <span className="text-muted small">({item.reviews_count})</span></span>
    </div>
  ));
}
