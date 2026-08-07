import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardIcon } from '../../../shared/components/ui/DashboardIcon';

const TABS = [
  { to: '/superadmin/ads', label: 'Campagnes' },
  { to: '/superadmin/ads/placements', label: 'Emplacements' },
  { to: '/superadmin/ads/analytics', label: 'Analytics' },
];

// Même rôle que HeroManagerLayout.jsx, avec des onglets de section en plus
// (campagnes / emplacements / analytics).
export function AdsManagerLayout({ title, icon = 'radio', actions, children }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h4 style={{ margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon && <DashboardIcon icon={icon} size={22} />} {title}
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>{actions}</div>
      </div>

      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #E5E7EB', marginBottom: 20 }}>
        {TABS.map(tab => {
          const active = tab.to === '/superadmin/ads' ? location.pathname === tab.to : location.pathname.startsWith(tab.to);
          return (
            <button
              key={tab.to}
              onClick={() => navigate(tab.to)}
              style={{
                border: 'none', background: 'none', cursor: 'pointer', padding: '10px 14px', fontSize: 13.5, fontWeight: 700,
                color: active ? '#FF8A00' : '#6B7280', borderBottom: active ? '2px solid #FF8A00' : '2px solid transparent', marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {children}
    </div>
  );
}
