import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../../../hooks/useApi';
import { HeroManagerLayout } from './HeroManagerLayout';
import { PremiumIcon } from '../../../shared/components/ui/PremiumIcon';

function StatCard({ label, value, icon }) {
  return (
    <div className="if-card" style={{ padding: 16, flex: 1, minWidth: 140 }}>
      <PremiumIcon name={icon} size={22} style={{ color: '#FF8A00' }} />
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{label}</div>
    </div>
  );
}

export default function HeroSlideStatsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { get } = useApi();
  const [slide, setSlide] = useState(null);
  const [stats, setStats] = useState(null);
  const [groupStats, setGroupStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      get(`/superadmin/hero/slides/${id}`),
      get(`/superadmin/hero/slides/${id}/stats`),
    ]).then(([slideRes, statsRes]) => {
      setSlide(slideRes.slide);
      setStats(statsRes);
      if (slideRes.slide.campaign_group_id) {
        get(`/superadmin/hero/campaign-groups/${encodeURIComponent(slideRes.slide.campaign_group_id)}/stats`)
          .then(setGroupStats).catch(() => {});
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return <HeroManagerLayout title="Statistiques" icon="chart"><div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Chargement…</div></HeroManagerLayout>;
  if (!slide || !stats) return <HeroManagerLayout title="Statistiques" icon="chart"><div>Slide introuvable.</div></HeroManagerLayout>;

  return (
    <HeroManagerLayout
      title={`Statistiques — ${slide.title}`} icon="chart"
      actions={<button className="if-btn if-btn-outline if-btn-sm" onClick={() => navigate('/marketplace-hero/slides')}>← Retour à la liste</button>}
    >
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard label="Impressions" value={stats.impressions} icon="eye" />
        <StatCard label="Clics" value={stats.clicks} icon="target" />
        <StatCard label="CTR" value={`${(stats.ctr * 100).toFixed(1)}%`} icon="trendingUp" />
        <StatCard label="Conversions" value={stats.conversions} icon="cart" />
        <StatCard label="Revenus générés" value={`${stats.revenue.toFixed(2)} MAD`} icon="wallet" />
      </div>
      <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 24, maxWidth: 640 }}>
        Attribution best-effort (fenêtre 30 min après clic, dernier-clic-gagne) — approximatif assumé,
        ne couvre pas les commandes pharmacie (aucun checkout réel n'existe pour ce module).
      </div>

      {groupStats && (
        <div className="if-card" style={{ padding: 18 }}>
          <h6 style={{ margin: '0 0 4px', fontWeight: 800 }}>Comparatif des variantes — {slide.campaign_group_id}</h6>
          <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 14 }}>
            Recommandation heuristique simple (CTR le plus haut au-delà du seuil d'impressions) — pas un vrai test statistique.
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#9CA3AF', fontSize: 11.5 }}>
                <th style={{ padding: '6px 8px' }}>Variante</th>
                <th style={{ padding: '6px 8px' }}>Impressions</th>
                <th style={{ padding: '6px 8px' }}>Clics</th>
                <th style={{ padding: '6px 8px' }}>CTR</th>
                <th style={{ padding: '6px 8px' }}>Conversions</th>
                <th style={{ padding: '6px 8px' }}>Revenus</th>
                <th style={{ padding: '6px 8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {groupStats.variants.map(v => (
                <tr key={v.id} style={{ borderTop: '1px solid #F3F4F6', fontWeight: v.id === groupStats.recommended_slide_id ? 700 : 400 }}>
                  <td style={{ padding: '8px' }}>{v.title}</td>
                  <td style={{ padding: '8px' }}>{v.impressions}</td>
                  <td style={{ padding: '8px' }}>{v.clicks}</td>
                  <td style={{ padding: '8px' }}>{(v.ctr * 100).toFixed(1)}%</td>
                  <td style={{ padding: '8px' }}>{v.conversions}</td>
                  <td style={{ padding: '8px' }}>{v.revenue.toFixed(2)} MAD</td>
                  <td style={{ padding: '8px' }}>{v.id === groupStats.recommended_slide_id && <span style={{ color: '#16A34A', display: 'inline-flex', alignItems: 'center', gap: 4 }}><PremiumIcon name="award" size={14} /> Recommandée</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </HeroManagerLayout>
  );
}
