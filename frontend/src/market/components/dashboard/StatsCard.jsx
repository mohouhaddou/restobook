import React from 'react';
import { DashboardIcon } from '../../../shared/components/ui/DashboardIcon';

// Petite carte statistique réutilisée sur Accueil/Insights (commandes actives,
// points, cashback, économies, etc.)
export function StatsCard({ icon, label, value, sublabel, color = 'var(--mk-orange)', onClick }) {
  return (
    <div
      className="mk-card"
      onClick={onClick}
      style={{
        padding: 16, cursor: onClick ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0,
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 10, background: `${color}18`,
        color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
      }}>
        <DashboardIcon icon={icon} size={18} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--mk-text)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--mk-muted)', fontWeight: 600 }}>{label}</div>
      {sublabel && <div style={{ fontSize: 11, color: 'var(--mk-muted)' }}>{sublabel}</div>}
    </div>
  );
}
