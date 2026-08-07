import React from 'react';
import { getStatusSteps } from '../../../shared/config/orderStatus';

// Timeline verticale de suivi de commande — même logique que OrderTrackingPage,
// réutilisée en version compacte sur l'Accueil du dashboard (commandes actives).
export function OrderTimeline({ order, compact = false }) {
  const steps = getStatusSteps(order).filter(s => s.key !== 'cancelled');
  const currentIdx = Math.max(0, steps.findIndex(s => s.key === order.status));

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: compact ? 11 : 15, top: 14, bottom: 14, width: 2, background: 'var(--mk-border)', zIndex: 0 }} />
      {steps.map((step, idx) => {
        const done   = idx <= currentIdx;
        const active = idx === currentIdx;
        const future = idx > currentIdx;
        const size = compact ? 24 : 32;
        return (
          <div key={step.key} style={{ display: 'flex', gap: compact ? 10 : 16, alignItems: 'flex-start', position: 'relative', zIndex: 1, marginBottom: idx < steps.length - 1 ? (compact ? 14 : 24) : 0 }}>
            <div style={{
              width: size, height: size, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: active ? (compact ? 12 : 16) : 11,
              background: active ? 'var(--mk-orange)' : done ? 'var(--mk-green)' : 'var(--mk-surface)',
              border: `2px solid ${active ? 'var(--mk-orange)' : done ? 'var(--mk-green)' : 'var(--mk-border)'}`,
              color: done || active ? '#fff' : 'var(--mk-muted)',
              boxShadow: active ? '0 0 0 5px var(--mk-orange-light)' : 'none',
              transition: 'all .3s',
            }}>
              {future ? <span style={{ fontSize: 10, fontWeight: 700 }}>{idx + 1}</span> : active ? step.icon : '✓'}
            </div>
            <div style={{ paddingTop: 2, flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: compact ? 12 : 14, fontWeight: active ? 700 : 500, color: future ? 'var(--mk-muted)' : 'var(--mk-text)' }}>
                {step.label}
              </div>
              {active && !compact && <div style={{ fontSize: 12, color: 'var(--mk-muted)', marginTop: 3 }}>{step.desc}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
