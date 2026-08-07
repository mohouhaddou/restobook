import React, { useEffect, useMemo, useState } from 'react';
import { ASSET } from '../../api';
import { useApi } from '../../hooks/useApi';
import { Toast } from '../../components/ui/Toast';
import { EmptyState } from '../../components/ui/EmptyState';

const GOAL_LABELS = {
  weight_loss: 'Perte de poids',
  muscle_gain: 'Prise de muscle',
  balanced: 'Alimentation équilibrée',
  light_meal: 'Repas léger',
  diabetes_or_restriction: 'Diabète / restriction',
};

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&q=70';

function numberOrDash(value, suffix = '') {
  if (value === null || value === undefined || value === '') return '-';
  return `${Number(value).toFixed(suffix ? 1 : 0)}${suffix}`;
}

function scoreColor(score) {
  if (score >= 75) return '#16A34A';
  if (score >= 50) return '#D97706';
  return '#DC2626';
}

export default function NutritionAIPage() {
  const { get, post } = useApi();
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [goal, setGoal] = useState('balanced');
  const [msg, setMsg] = useState('');
  const [kind, setKind] = useState('success');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const d = await get('/nutrition/items');
      const nextItems = d.items || [];
      setItems(nextItems);
      setSelectedId(current => current || nextItems[0]?.id || null);
    } catch (err) {
      setMsg(err.message);
      setKind('error');
    } finally {
      setLoading(false);
    }
  }

  const selected = useMemo(
    () => items.find(item => String(item.id) === String(selectedId)) || null,
    [items, selectedId]
  );

  async function analyze() {
    if (!selected) return;
    setAnalyzing(true);
    try {
      const d = await post(`/nutrition/items/${selected.id}/analyze`, { goal });
      setItems(prev => prev.map(item => item.id === selected.id ? d.item : item));
      setMsg('Analyse nutritionnelle estimée et enregistrée');
      setKind('success');
    } catch (err) {
      setMsg(err.message);
      setKind('error');
    } finally {
      setAnalyzing(false);
    }
  }

  const recommendation = selected?.nutrition_analysis?.recommendations?.[goal];
  const allergens = selected?.allergenes || selected?.nutrition_analysis?.allergenes_potentiels || [];

  return (
    <>
      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>IA nutritionnelle</h1>
          <div style={{ color: 'var(--rb-muted)', fontSize: 13 }}>
            Estimation nutritionnelle des plats et recommandations par objectif.
          </div>
        </div>
        <select className="form-select form-select-sm" style={{ maxWidth: 240 }} value={goal} onChange={e => setGoal(e.target.value)}>
          {Object.entries(GOAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div className="alert alert-warning py-2" style={{ fontSize: 13 }}>
        Les résultats sont estimatifs, dépendent des informations disponibles sur le plat et ne remplacent pas un avis médical ou nutritionnel professionnel.
      </div>

      {loading ? (
        <div className="card p-4 text-center text-muted">Chargement des plats…</div>
      ) : items.length === 0 ? (
        <EmptyState icon="🥗" title="Aucun plat" subtitle="Ajoutez des plats au catalogue pour lancer une analyse nutritionnelle." />
      ) : (
        <div className="row g-3">
          <div className="col-lg-4">
            <div className="card p-2">
              {items.map(item => (
                <button
                  key={item.id}
                  className={`btn text-start mb-2 ${String(item.id) === String(selectedId) ? 'btn-primary' : 'btn-light'}`}
                  onClick={() => setSelectedId(item.id)}
                  style={{ border: '1px solid var(--rb-border)' }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{item.libelle}</div>
                  <div style={{ fontSize: 11, opacity: .8 }}>
                    {item.category?.name || item.type} · {item.calories ? `${item.calories} kcal` : 'non analysé'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="col-lg-8">
            <div className="card p-3">
              {selected && (
                <>
                  <div className="d-flex gap-3 flex-wrap align-items-start">
                    <img
                      src={selected.image_url ? ASSET(selected.image_url) : FALLBACK_IMG}
                      alt={selected.libelle}
                      style={{ width: 132, aspectRatio: '4/3', objectFit: 'cover', borderRadius: 8 }}
                    />
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <h2 style={{ fontSize: 20, margin: 0 }}>{selected.libelle}</h2>
                      <div style={{ color: 'var(--rb-muted)', fontSize: 13, marginTop: 4 }}>{selected.description || 'Aucune description.'}</div>
                      <div className="d-flex gap-2 flex-wrap mt-3">
                        <button className="btn btn-primary btn-sm" onClick={analyze} disabled={analyzing}>
                          {analyzing ? 'Analyse…' : 'Analyser avec IA'}
                        </button>
                        {selected.nutrition_analyzed_at && (
                          <span className="badge text-bg-light border align-self-center">
                            Dernière analyse {new Date(selected.nutrition_analyzed_at).toLocaleString('fr-FR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="row g-2 mt-3">
                    <div className="col-6 col-md-3"><Metric label="Calories" value={numberOrDash(selected.calories, ' kcal')} /></div>
                    <div className="col-6 col-md-3"><Metric label="Protéines" value={numberOrDash(selected.proteines_g, ' g')} /></div>
                    <div className="col-6 col-md-3"><Metric label="Glucides" value={numberOrDash(selected.glucides_g, ' g')} /></div>
                    <div className="col-6 col-md-3"><Metric label="Lipides" value={numberOrDash(selected.lipides_g, ' g')} /></div>
                  </div>

                  <div className="row g-3 mt-1">
                    <div className="col-md-4">
                      <div className="p-3 rounded-3" style={{ border: '1px solid var(--rb-border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--rb-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Score santé</div>
                        <div style={{ fontSize: 34, fontWeight: 800, color: scoreColor(selected.health_score || 0) }}>
                          {selected.health_score || '-'}{selected.health_score ? '/100' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="col-md-8">
                      <div className="p-3 rounded-3 h-100" style={{ border: '1px solid var(--rb-border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--rb-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Allergènes potentiels</div>
                        <div className="d-flex gap-2 flex-wrap mt-2">
                          {allergens.length ? allergens.map(a => <span key={a} className="badge text-bg-warning">{a}</span>) : <span className="text-muted small">Aucun allergène détecté automatiquement.</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card p-3 mt-3" style={{ background: 'var(--rb-surface)' }}>
                    <h3 style={{ fontSize: 16 }}>Recommandation: {GOAL_LABELS[goal]}</h3>
                    {recommendation?.advice?.length ? (
                      <ul style={{ marginBottom: 0, paddingLeft: 18 }}>
                        {recommendation.advice.map((line, idx) => <li key={idx}>{line}</li>)}
                      </ul>
                    ) : (
                      <div className="text-muted small">Lancez une analyse pour générer une recommandation.</div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Metric({ label, value }) {
  return (
    <div className="p-3 rounded-3" style={{ border: '1px solid var(--rb-border)', background: 'var(--rb-card)' }}>
      <div style={{ fontSize: 11, color: 'var(--rb-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
    </div>
  );
}
