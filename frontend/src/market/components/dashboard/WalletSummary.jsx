import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardIcon } from '../../../shared/components/ui/DashboardIcon';

// Bandeau résumé Wallet (points / cashback / coupons) — utilisé sur l'Accueil,
// renvoie vers la page Wallet complète.
export function WalletSummary({ points = 0, cashback = 0, couponsCount = 0 }) {
  const navigate = useNavigate();
  const items = [
    { icon: '⭐', label: 'Points', value: points.toLocaleString('fr-FR') },
    { icon: '💰', label: 'Cashback', value: `${cashback.toFixed(2)} MAD` },
    { icon: '🎟️', label: 'Coupons', value: couponsCount },
  ];

  return (
    <div
      className="mk-card"
      onClick={() => navigate('/dashboard/wallet')}
      style={{ padding: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
    >
      {items.map((it, i) => (
        <React.Fragment key={it.label}>
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <div style={{ fontSize: 18, color: 'var(--mk-orange)' }}><DashboardIcon icon={it.icon} size={18} /></div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--mk-text)', marginTop: 2 }}>{it.value}</div>
            <div style={{ fontSize: 10, color: 'var(--mk-muted)', fontWeight: 600 }}>{it.label}</div>
          </div>
          {i < items.length - 1 && <div style={{ width: 1, height: 32, background: 'var(--mk-border)' }} />}
        </React.Fragment>
      ))}
    </div>
  );
}
