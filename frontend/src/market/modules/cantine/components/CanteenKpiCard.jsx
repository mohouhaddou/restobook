import React from 'react';

export function CanteenKpiCard({ label, value, hint, tone = 'orange' }) {
  const colors = {
    orange: ['var(--rb-orange-light)', 'var(--rb-orange)'],
    green: ['var(--rb-green-s)', 'var(--rb-green)'],
    blue: ['var(--rb-blue-s)', 'var(--rb-blue)'],
    red: ['#FEF2F2', '#DC2626'],
    gray: ['var(--rb-surface)', 'var(--rb-muted)'],
  };
  const [bg, color] = colors[tone] || colors.orange;

  return (
    <div className="card p-3" style={{ background: bg, boxShadow: 'none' }}>
      <div style={{ fontSize: 11, color: 'var(--rb-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color, marginTop: 6 }}>
        {value ?? '—'}
      </div>
      {hint && <div style={{ fontSize: 12, color: 'var(--rb-muted)', marginTop: 6 }}>{hint}</div>}
    </div>
  );
}
