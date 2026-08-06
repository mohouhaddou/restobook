import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Palette catégorielle validée (ordre fixe, CVD-safe) — voir la skill dataviz.
export const CHART_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
const AXIS_TICK = { fontSize: 11, fill: '#898781' };
const AXIS_LINE = { stroke: '#c3c2b7' };
const GRID = '#e1e0d9';

// Donut — répartitions (2 à ~6 catégories). Étiquettes directes sur les
// tranches : le pourcentage ne doit jamais reposer sur la seule couleur
// (certaines teintes de la palette n'atteignent pas 3:1 sur fond clair).
export function DonutStat({ data, height = 220 }) {
  const total = data.reduce((sum, d) => sum + Number(d.value || 0), 0);
  if (!total) return <p style={{ color: '#9CA3AF', margin: 0 }}>Pas encore de données.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="82%" paddingAngle={3}
          label={({ name, value }) => `${name} (${Math.round((value / total) * 100)}%)`} labelLine={false}>
          {data.map((entry, i) => <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="#fff" strokeWidth={2} />)}
        </Pie>
        <Tooltip formatter={value => [value, 'total']} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Classement (top N) — une seule teinte : c'est une magnitude par entité,
// pas une identité catégorielle, donc pas d'arc-en-ciel par barre.
export function RankBarChart({ data, dataKey = 'value', nameKey = 'name', height = 260, color = CHART_COLORS[0] }) {
  if (!data.length) return <p style={{ color: '#9CA3AF', margin: 0 }}>Pas encore de données.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID} />
        <XAxis type="number" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey={nameKey} width={160} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <Tooltip />
        <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Tendance temporelle — une ou plusieurs séries réelles dans le temps.
export function TrendChart({ data, lines, height = 240 }) {
  if (!data.length) return <p style={{ color: '#9CA3AF', margin: 0 }}>Pas encore de données.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 4, right: 16, top: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
        <Tooltip />
        {lines.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {lines.map((line, i) => (
          <Line key={line.key} type="monotone" dataKey={line.key} name={line.label} stroke={line.color || CHART_COLORS[i]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// Barres verticales simples (ex. volume par mois) — une seule teinte.
export function TrendBarChart({ data, dataKey = 'value', height = 220, color = CHART_COLORS[0] }) {
  if (!data.length) return <p style={{ color: '#9CA3AF', margin: 0 }}>Pas encore de données.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 4, right: 16, top: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
        <Tooltip />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
