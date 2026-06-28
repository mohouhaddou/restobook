import React from 'react';

export function RestaurantKpiCard({ label, value, hint }) {
  return (
    <div className="card p-3 border-0" style={{ minHeight: 96 }}>
      <div style={{ fontSize: 11, color: 'var(--rb-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--rb-text)', marginTop: 4 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 12, color: 'var(--rb-muted)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}
