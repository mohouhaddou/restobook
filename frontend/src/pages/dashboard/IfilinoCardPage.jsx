import React, { useEffect, useState } from 'react';
import { API } from '../../api';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { IfilinoCard } from '../../shared/components/dashboard/IfilinoCard';
import { TIER_DISPLAY } from '../../shared/config/loyaltyTiers';

const TIER_ORDER = ['Bronze', 'Argent', 'Or', 'Platine'];

export default function IfilinoCardPage() {
  const { authHeader } = useCustomerAuth();
  const [loyalty, setLoyalty] = useState(null);

  useEffect(() => {
    fetch(API('/loyalty/me'), { headers: authHeader }).then(r => r.json()).then(setLoyalty).catch(() => {});
  }, []);

  const currentTierName = loyalty?.tier?.name || 'Bronze';

  return (
    <div className="mk-fade-up">
      <div style={{ maxWidth: 420, margin: '0 auto 28px' }}>
        <IfilinoCard user={loyalty?.user} tier={loyalty?.tier} points={loyalty?.points || 0} />
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--mk-text)', marginBottom: 4 }}>Les niveaux iFilino</h2>
      <p style={{ fontSize: 12.5, color: 'var(--mk-muted)', marginBottom: 18 }}>
        Chaque commande vous fait gagner des points. Plus vous cumulez, plus votre niveau — et vos avantages — grandissent.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {TIER_ORDER.map(name => {
          const display = TIER_DISPLAY[name];
          const isCurrent = name === currentTierName;
          return (
            <div key={name} className="mk-card" style={{
              padding: 18, position: 'relative',
              border: isCurrent ? `2px solid ${display.color}` : '1px solid var(--mk-border)',
            }}>
              {isCurrent && (
                <span style={{
                  position: 'absolute', top: -10, right: 14, background: display.color, color: '#fff',
                  fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase',
                }}>Mon niveau</span>
              )}
              <div style={{ fontSize: 30 }}>{display.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--mk-text)', margin: '6px 0 12px' }}>{display.displayName}</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {display.perks.map(p => (
                  <li key={p} style={{ fontSize: 12.5, color: 'var(--mk-text2)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: display.color, flexShrink: 0 }}>✓</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
