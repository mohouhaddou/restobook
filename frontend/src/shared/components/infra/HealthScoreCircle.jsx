import React from 'react';

const COLORS = {
  green:  { stroke: '#16A34A', bg: '#DCFCE7', text: '#166534' },
  orange: { stroke: '#F59E0B', bg: '#FEF3C7', text: '#92400E' },
  red:    { stroke: '#DC2626', bg: '#FEE2E2', text: '#991B1B' },
};

// Grand cercle "Infrastructure Health" — score calculé par
// healthScoreService.js (backend), jamais un chiffre statique côté client.
// `breakdown` (optionnel) s'affiche en info-bulle pour justifier le score.
export function HealthScoreCircle({ score = 0, color = 'green', label = '', breakdown, size = 180 }) {
  const c = COLORS[color] || COLORS.green;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);

  const breakdownLabels = {
    cpu_penalty: 'CPU', ram_penalty: 'RAM', disk_penalty: 'Disque',
    services_penalty: 'Services', db_penalty: 'Base de données', ssl_penalty: 'SSL',
  };
  const titleAttr = breakdown
    ? (Object.entries(breakdown).filter(([, v]) => v > 0).map(([k, v]) => `${breakdownLabels[k] || k}: -${v}`).join(' · ') || 'Aucune pénalité')
    : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ position: 'relative', width: size, height: size }} title={titleAttr}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--il-border, #E5E7EB)" strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={c.stroke} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset .6s ease, stroke .3s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.24, fontWeight: 900, color: c.stroke,
        }}>
          {score}%
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--il-text, #111827)' }}>Infrastructure Health</div>
        <div style={{ display: 'inline-block', marginTop: 6, padding: '3px 12px', borderRadius: 20, background: c.bg, color: c.text, fontWeight: 700, fontSize: 12 }}>
          {label}
        </div>
      </div>
    </div>
  );
}
