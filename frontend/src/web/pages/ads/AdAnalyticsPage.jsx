import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '../../../hooks/useApi';
import { AdsManagerLayout } from './AdsManagerLayout';
import { PremiumIcon } from '../../../shared/components/ui/PremiumIcon';
import { DonutStat, RankBarChart, TrendChart } from '../../../shared/components/stats/AdminCharts';

function StatCard({ label, value, icon }) {
  return (
    <div className="if-card" style={{ padding: 16, flex: 1, minWidth: 140 }}>
      <PremiumIcon name={icon} size={22} style={{ color: '#FF8A00' }} />
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{label}</div>
    </div>
  );
}

function DataTable({ title, rows, columns, emptyLabel }) {
  return (
    <div className="if-card" style={{ padding: 16 }}>
      <h6 style={{ margin: '0 0 10px', fontWeight: 800 }}>{title}</h6>
      {!rows || rows.length === 0 ? (
        <div style={{ fontSize: 12.5, color: '#9CA3AF' }}>{emptyLabel || 'Aucune donnée sur cette période.'}</div>
      ) : (
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#9CA3AF', fontSize: 11 }}>
                {columns.map(c => <th key={c.key} style={{ padding: '6px 8px' }}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid #F3F4F6' }}>
                  {columns.map(c => <td key={c.key} style={{ padding: '7px 8px' }}>{c.render ? c.render(r) : r[c.key]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, subtitle, children, wide = false }) {
  return (
    <section className="if-card" style={{ padding: 16, minWidth: 0, gridColumn: wide ? '1 / -1' : undefined }}>
      <h6 style={{ margin: 0, fontWeight: 800 }}>{title}</h6>
      {subtitle && <p style={{ margin: '4px 0 14px', fontSize: 11.5, color: '#9CA3AF' }}>{subtitle}</p>}
      {children}
    </section>
  );
}

const inputStyle = { minHeight: 36, border: '1px solid #D1D5DB', borderRadius: 8, padding: '6px 10px', fontSize: 13 };

export default function AdAnalyticsPage() {
  const { id } = useParams(); // présent quand on arrive via "Statistiques" sur une campagne précise
  const { get } = useApi();
  const [campaigns, setCampaigns] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [filters, setFilters] = useState({ from: '', to: '', campaign_id: id || '', platform: '', placement_id: '' });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([get('/superadmin/ads'), get('/superadmin/ad-placements')])
      .then(([c, p]) => { setCampaigns(c.campaigns || []); setPlacements(p.placements || []); })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    get(`/superadmin/ads/analytics/overview?${params.toString()}`).then(setStats).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctrCol = { key: 'ctr', label: 'CTR', render: r => `${r.ctr}%` };

  const trendData = (stats?.byDay || []).map(row => ({
    label: new Date(String(row.key) + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    impressions: row.impressions,
    clicks: row.clicks,
  }));
  const campaignChartData = (stats?.topCampaigns || []).slice(0, 7).map(row => ({ name: row.name, value: row.impressions }));
  const placementChartData = (stats?.byPlacement || [])
    .map(row => ({ name: row.name || row.code || ('#' + row.key), value: row.impressions }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);
  const deviceLabels = { desktop: 'Ordinateur', mobile: 'Mobile', tablet: 'Tablette', unknown: 'Inconnu' };
  const deviceChartData = (stats?.byDevice || []).map(row => ({
    name: deviceLabels[row.key] || row.key,
    value: row.impressions,
  }));

  return (
    <AdsManagerLayout title="Analytics publicitaires" icon="chart">
      <div className="if-card" style={{ padding: 14, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'grid', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#4B5563' }}>
          Depuis <input type="date" style={inputStyle} value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#4B5563' }}>
          Jusqu'à <input type="date" style={inputStyle} value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#4B5563' }}>
          Campagne
          <select style={inputStyle} value={filters.campaign_id} onChange={e => setFilters({ ...filters, campaign_id: e.target.value })}>
            <option value="">Toutes</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#4B5563' }}>
          Plateforme
          <select style={inputStyle} value={filters.platform} onChange={e => setFilters({ ...filters, platform: e.target.value })}>
            <option value="">Toutes</option>
            {['global', 'homepage', 'marketplace', 'discover', 'play', 'user_dashboard'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#4B5563' }}>
          Emplacement
          <select style={inputStyle} value={filters.placement_id} onChange={e => setFilters({ ...filters, placement_id: e.target.value })}>
            <option value="">Tous</option>
            {placements.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>

      {loading || !stats ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Chargement…</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <StatCard label="Impressions" value={stats.summary.impressions} icon="eye" />
            <StatCard label="Clics" value={stats.summary.clicks} icon="target" />
            <StatCard label="CTR" value={`${stats.summary.ctr}%`} icon="trendingUp" />
            <StatCard label="Visiteurs uniques (approx.)" value={stats.summary.unique_impressions} icon="users" />
          </div>

          <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 20, maxWidth: 720 }}>
            Pour les campagnes AdSense, ces chiffres reflètent uniquement l'affichage du slot dans iFilino —
            les revenus et clics officiels ne proviennent que de la console Google AdSense, jamais reconstruits ici.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 16, marginBottom: 20 }}>
            <ChartCard title="Évolution des performances" subtitle="Impressions et clics enregistrés chaque jour sur la période sélectionnée." wide>
              <TrendChart data={trendData} height={280} lines={[
                { key: 'impressions', label: 'Impressions', color: '#2a78d6' },
                { key: 'clicks', label: 'Clics', color: '#eb6834' },
              ]} />
            </ChartCard>
            <ChartCard title="Top campagnes" subtitle="Classement par nombre d’impressions.">
              <RankBarChart data={campaignChartData} height={270} />
            </ChartCard>
            <ChartCard title="Top emplacements" subtitle="Emplacements qui génèrent le plus d’affichages.">
              <RankBarChart data={placementChartData} height={270} color="#1baf7a" />
            </ChartCard>
            <ChartCard title="Répartition par appareil" subtitle="Part des impressions selon le type d’appareil.">
              <DonutStat data={deviceChartData} height={280} />
            </ChartCard>
          </div>

          <h5 style={{ margin: '0 0 12px', fontWeight: 800 }}>Données détaillées</h5>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            <DataTable title="Par jour" rows={stats.byDay} columns={[{ key: 'key', label: 'Date' }, { key: 'impressions', label: 'Impressions' }, { key: 'clicks', label: 'Clics' }, ctrCol]} />
            <DataTable title="Campagnes les plus performantes" rows={stats.topCampaigns} columns={[{ key: 'name', label: 'Campagne' }, { key: 'source_type', label: 'Type' }, { key: 'impressions', label: 'Impressions' }, { key: 'clicks', label: 'Clics' }, ctrCol]} />
            <DataTable title="Par emplacement" rows={stats.byPlacement} columns={[{ key: 'name', label: 'Emplacement', render: r => r.name || r.code || `#${r.key}` }, { key: 'impressions', label: 'Impressions' }, { key: 'clicks', label: 'Clics' }, ctrCol]} />
            <DataTable title="Par plateforme" rows={stats.byPlatform} columns={[{ key: 'key', label: 'Plateforme' }, { key: 'impressions', label: 'Impressions' }, { key: 'clicks', label: 'Clics' }, ctrCol]} />
            <DataTable title="Par appareil" rows={stats.byDevice} columns={[{ key: 'key', label: 'Appareil' }, { key: 'impressions', label: 'Impressions' }, { key: 'clicks', label: 'Clics' }, ctrCol]} />
            <DataTable title="Par langue" rows={stats.byLanguage} columns={[{ key: 'key', label: 'Langue' }, { key: 'impressions', label: 'Impressions' }]} />
          </div>
        </>
      )}
    </AdsManagerLayout>
  );
}
