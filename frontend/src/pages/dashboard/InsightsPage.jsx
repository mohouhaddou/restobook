import React, { useEffect, useState } from 'react';
import { API } from '../../api';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { useMkTheme } from '../../shared/hooks/useMkTheme';
import { StatsCard } from '../../shared/components/dashboard/StatsCard';
import { MonthlyTrendChart, CategoryBreakdownChart, TopMerchantsList } from '../../shared/components/dashboard/AnalyticsCharts';

const PERIODS = [
  { key: 'month', label: 'Ce mois' },
  { key: 'year',  label: 'Cette année' },
  { key: 'all',   label: 'Depuis le début' },
];

const cardStyle = {
  background: 'var(--mk-card)', border: '1px solid var(--mk-border)', borderRadius: 16,
  padding: 18, marginBottom: 16,
};

export default function InsightsPage() {
  const { authHeader } = useCustomerAuth();
  const [theme] = useMkTheme();
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(API(`/dashboard/insights?period=${period}`), { headers: authHeader })
      .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="mk-fade-up">
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)} className={`mk-pill${period === p.key ? ' active' : ''}`}>{p.label}</button>
        ))}
      </div>

      {loading || !data ? (
        <div style={{ display: 'grid', gap: 14 }}>
          {[1, 2].map(i => <div key={i} className="mk-skeleton" style={{ height: 100, borderRadius: 16 }} />)}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 8 }}>
            <StatsCard icon="🧾" label="Commandes" value={data.summary.orders_count} color="#2a78d6" />
            <StatsCard icon="💵" label="Total dépensé" value={`${data.summary.total_spent.toFixed(0)} MAD`} color="#eb6834" />
            <StatsCard icon="📉" label="Panier moyen" value={`${data.summary.avg_order.toFixed(0)} MAD`} color="#4a3aa7" />
            <StatsCard icon="🎁" label="Économies" value={`${data.summary.total_savings.toFixed(0)} MAD`} color="#1baf7a" />
            <StatsCard icon="🛵" label="Livraisons" value={data.summary.delivery_count} color="#e87ba4" />
            <StatsCard icon="💰" label="Cashback gagné" value={`${data.summary.cashback_earned.toFixed(0)} MAD`} color="#008300" />
            <StatsCard icon="⭐" label="Points gagnés" value={data.summary.points_earned} color="#eda100" />
          </div>

          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--mk-text)', marginBottom: 10 }}>Évolution des dépenses (6 derniers mois)</div>
            <MonthlyTrendChart data={data.monthly_trend} theme={theme} />
          </div>

          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--mk-text)', marginBottom: 10 }}>Répartition par catégorie</div>
            <CategoryBreakdownChart data={data.by_category} theme={theme} />
          </div>

          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--mk-text)', marginBottom: 12 }}>Vos marchands favoris</div>
            <TopMerchantsList data={data.top_merchants} theme={theme} />
          </div>
        </>
      )}
    </div>
  );
}
