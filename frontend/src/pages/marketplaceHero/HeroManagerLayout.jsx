import React from 'react';
import { DashboardIcon } from '../../shared/components/ui/DashboardIcon';

// Enveloppe commune aux pages du Hero Manager — version allégée d'InfraLayout.jsx
// (pas de toggle mode sombre, non demandé pour ce module).
export function HeroManagerLayout({ title, icon, actions, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h4 style={{ margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon && <DashboardIcon icon={icon} size={22} />} {title}
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>{actions}</div>
      </div>
      {children}
    </div>
  );
}
