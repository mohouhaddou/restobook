import React from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { SEQUENTIAL, INK, CATEGORY_LABELS, CATEGORY_ORDER, categoryColor } from '../../config/vizPalette';

const MONTH_LABELS = { '01': 'Jan', '02': 'Fév', '03': 'Mar', '04': 'Avr', '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Aoû', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Déc' };
function formatMonth(ym) {
  const [, m] = ym.split('-');
  return MONTH_LABELS[m] || ym;
}

function VizTooltip({ active, payload, label, unit = 'MAD', ink }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: ink.surface, border: `1px solid ${ink.grid}`, borderRadius: 10, padding: '8px 12px', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
      <div style={{ color: ink.secondary, fontWeight: 700, marginBottom: 2 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: ink.primary }}>{Number(p.value).toLocaleString('fr-FR')} {unit}</div>
      ))}
    </div>
  );
}

// Tendance mensuelle des dépenses — série unique (magnitude dans le temps),
// pas de légende nécessaire (une seule couleur = le titre suffit).
export function MonthlyTrendChart({ data, theme = 'light' }) {
  const ink = { ...INK[theme], surface: theme === 'dark' ? '#162032' : '#FFFFFF' };
  const hue = SEQUENTIAL[theme];
  const chartData = data.map(d => ({ ...d, label: formatMonth(d.month) }));

  if (!chartData.length) return <EmptyChart text="Pas encore assez de données pour une tendance" />;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="mtc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hue} stopOpacity={0.18} />
            <stop offset="100%" stopColor={hue} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={ink.grid} strokeDasharray="0" />
        <XAxis dataKey="label" tick={{ fill: ink.muted, fontSize: 11 }} axisLine={{ stroke: ink.axis }} tickLine={false} />
        <YAxis tick={{ fill: ink.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
        <Tooltip content={<VizTooltip ink={ink} />} cursor={{ stroke: ink.axis, strokeWidth: 1 }} />
        <Area type="monotone" dataKey="total_spent" stroke={hue} strokeWidth={2} fill="url(#mtc-fill)" dot={{ r: 4, fill: hue, stroke: ink.surface, strokeWidth: 2 }} activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Répartition par catégorie de commerce — identité catégorielle, ordre fixe,
// slots avec contraste faible (aqua/jaune/magenta) reçoivent un label direct.
export function CategoryBreakdownChart({ data, theme = 'light' }) {
  const ink = { ...INK[theme], surface: theme === 'dark' ? '#162032' : '#FFFFFF' };
  const ordered = [...data].sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
  const chartData = ordered.map(d => ({ ...d, label: CATEGORY_LABELS[d.category] || d.category }));

  if (!chartData.length) return <EmptyChart text="Aucune commande à ventiler pour cette période" />;

  return (
    <ResponsiveContainer width="100%" height={Math.max(140, chartData.length * 40)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }} barCategoryGap={10}>
        <CartesianGrid horizontal={false} stroke={ink.grid} />
        <XAxis type="number" tick={{ fill: ink.muted, fontSize: 11 }} axisLine={{ stroke: ink.axis }} tickLine={false} />
        <YAxis type="category" dataKey="label" tick={{ fill: ink.secondary, fontSize: 12 }} axisLine={false} tickLine={false} width={90} />
        <Tooltip content={<VizTooltip ink={ink} />} cursor={{ fill: ink.grid, opacity: .4 }} />
        <Bar dataKey="total_spent" radius={[0, 4, 4, 0]} barSize={20} maxBarSize={24}
          label={{ position: 'right', fill: ink.secondary, fontSize: 11, formatter: v => `${Number(v).toFixed(0)} MAD` }}
        >
          {chartData.map((entry, i) => (
            <Cell key={i} fill={categoryColor(entry.category, theme)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Classement marchands favoris — magnitude d'une entité arbitraire (pas une
// dimension fixe) : un seul hue séquentiel plutôt qu'une palette catégorielle.
export function TopMerchantsList({ data, theme = 'light' }) {
  const hue = SEQUENTIAL[theme];
  const ink = INK[theme];
  if (!data.length) return <EmptyChart text="Aucun marchand à afficher pour cette période" />;
  const max = Math.max(...data.map(d => d.total_spent), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.map((m, i) => (
        <div key={m.id || i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
            <span style={{ color: ink.primary, fontWeight: 600 }}>{m.name}</span>
            <span style={{ color: ink.secondary, fontWeight: 700 }}>{Number(m.total_spent).toFixed(0)} MAD</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: ink.grid, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 4, width: `${Math.max(4, (m.total_spent / max) * 100)}%`, background: hue }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyChart({ text }) {
  return <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--mk-muted)', fontSize: 12.5 }}>{text}</div>;
}
