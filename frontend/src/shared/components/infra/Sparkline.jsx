import React, { useId } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

// Mini-graphique pour les cartes de métriques temps réel (CPU/RAM/réseau...) —
// pas d'axes, pas de grille, pas de tooltip : juste une tendance visuelle.
// Gabarit repris de MonthlyTrendChart (AnalyticsCharts.jsx) mais réduit au
// strict minimum pour tenir dans une petite carte.
export function Sparkline({ data = [], color = '#FF8A00', height = 40 }) {
  const gradientId = `spark-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const chartData = data.map((v, i) => ({ i, v: typeof v === 'number' ? v : (v?.value ?? null) }));

  if (chartData.length < 2) {
    return <div style={{ height, display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--il-muted, #9CA3AF)' }}>—</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#${gradientId})`} isAnimationActive={false} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
