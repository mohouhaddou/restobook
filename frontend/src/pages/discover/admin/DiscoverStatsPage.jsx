import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../../hooks/useApi';
import { CHART_COLORS, DonutStat, RankBarChart, TrendBarChart, TrendChart } from '../../../shared/components/stats/AdminCharts';

function last6Months(rows) {
  const byMonth = new Map((rows || []).map(r => [r.month, Number(r.count) || 0]));
  const out = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    out.push({ label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }), value: byMonth.get(key) || 0 });
  }
  return out;
}

function last14DaysVisitors(rows) {
  const byDay = new Map((rows || []).map(r => [String(r.day).slice(0, 10), Number(r.visitors) || 0]));
  const out = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), visitors: byDay.get(key) || 0 });
  }
  return out;
}

const REFERRER_LABELS = { direct: 'Direct', internal: 'Interne (site)', search: 'Moteurs de recherche', social: 'Réseaux sociaux' };
function referrerLabel(domain) { return REFERRER_LABELS[domain] || domain || 'Autre'; }
const DEVICE_LABELS = { mobile: 'Mobile', desktop: 'Ordinateur', tablet: 'Tablette' };

const CATEGORY_LABELS = {
  guide: 'Guide', recette: 'Recette', promotion: 'Promotion', conseil: 'Conseil',
  actualite: 'Actualité', nouveau_commerce: 'Nouveau commerce', nouveau_produit: 'Nouveau produit',
  vie_locale: 'Vie locale', portrait: 'Portrait',
};
const RUBRIQUE_LABELS = {
  restaurants_food: 'Food & Restaurants', courses_epiceries: 'Courses', boucheries: 'Boucheries',
  boulangeries: 'Boulangeries', patisseries: 'Pâtisseries', cafes: 'Cafés', sante_pharmacies: 'Santé',
  beaute_bien_etre: 'Beauté & Bien-être', sport_forme: 'Sport & Forme', famille_enfants: 'Famille',
  maison_deco: 'Maison', sorties_loisirs: 'Sorties & Loisirs', shopping: 'Shopping', evenements: 'Événements',
  villes: 'Guides locaux', maroc: 'Voyage & Découvertes', conseils_astuces: 'Conseils & Astuces', promotions: 'Bons plans',
};

function KpiTile({ label, value }) {
  return (
    <div className="card" style={{ padding: 14, minWidth: 160 }}>
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 24, color: '#111827', fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export default function DiscoverStatsPage() {
  const { get } = useApi();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => { get('/superadmin/discover/stats').then(({ stats: s }) => setStats(s)); }, [get]);

  return (
    <div className="app-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">iFilino Discover — Statistiques</h1>
          <p className="page-subtitle">Lecture des articles publiés.</p>
        </div>
        <button className="btn btn-outline-primary" onClick={() => navigate('/discover-admin/articles')}>← Articles</button>
      </div>

      {!stats ? <p style={{ color: '#6B7280' }}>Chargement…</p> : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
            <KpiTile label="Articles publiés" value={stats.publishedCount}/>
            <KpiTile label="Vues cumulées (brutes)" value={stats.totalViews}/>
            <KpiTile label="Vues moyennes / article" value={stats.avgViews}/>
            <KpiTile label="Publiés ce mois-ci" value={stats.publishedThisMonth}/>
            <KpiTile label="Brouillons" value={stats.draftCount}/>
            <KpiTile label="Générés par IA" value={stats.aiGeneratedCount}/>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Articles les plus lus</div>
              {(stats.topArticles || []).length
                ? <RankBarChart data={stats.topArticles.map(a => ({ name: a.title, value: Number(a.view_count) || 0 }))} />
                : <p style={{ color: '#9CA3AF', margin: 0 }}>Pas encore de données.</p>}
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Répartition par catégorie</div>
              <DonutStat data={(stats.byCategory || []).map(c => ({ name: CATEGORY_LABELS[c.category] || c.category, value: Number(c.views) || 0 }))} />
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Rubriques les plus lues</div>
              {(stats.byRubrique || []).length
                ? <RankBarChart color={CHART_COLORS[1]} data={stats.byRubrique.map(r => ({ name: RUBRIQUE_LABELS[r.rubrique] || r.rubrique, value: Number(r.views) || 0 }))} />
                : <p style={{ color: '#9CA3AF', margin: 0 }}>Pas encore de données.</p>}
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Articles publiés par mois</div>
              <TrendBarChart data={last6Months(stats.publishedByMonth)} />
            </div>
          </div>

          <div style={{ fontWeight: 900, fontSize: 13, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', margin: '22px 0 4px' }}>Trafic réel</div>
          <p style={{ color: '#9CA3AF', fontSize: 12, margin: '0 0 10px' }}>Visiteurs uniques (déduplication par appareil+jour) — contrairement aux « vues brutes » ci-dessus, un même visiteur qui recharge la page n'est compté qu'une fois par jour.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <KpiTile label="Visiteurs uniques aujourd'hui" value={stats.realTraffic?.visitors_today ?? 0}/>
            <KpiTile label="Visiteurs uniques (7 jours)" value={stats.realTraffic?.visitors_7d ?? 0}/>
            <KpiTile label="Visiteurs uniques (30 jours)" value={stats.realTraffic?.visitors_30d ?? 0}/>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Visiteurs uniques / jour (14 derniers jours)</div>
              <TrendChart data={last14DaysVisitors(stats.dailyVisitors)} lines={[{ key: 'visitors', label: 'Visiteurs uniques' }]} />
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Provenance du trafic</div>
              <DonutStat data={(stats.topReferrers || []).map(r => ({ name: referrerLabel(r.referrer_domain), value: Number(r.visitors) || 0 }))} />
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Appareil (trafic réel)</div>
              <DonutStat data={(stats.realDeviceSplit || []).map(d => ({ name: DEVICE_LABELS[d.device_type] || d.device_type || 'Inconnu', value: Number(d.visitors) || 0 }))} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
