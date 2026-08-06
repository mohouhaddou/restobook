import React from 'react';

// Carrousel horizontal de promotions personnalisées — alimenté par les coupons
// disponibles de l'utilisateur (GET /dashboard/coupons). Pas d'entité "Promotion"
// séparée en v1 : les coupons ciblés/segmentés jouent ce rôle.
export function PromotionCarousel({ coupons = [] }) {
  if (!coupons.length) return null;

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
      {coupons.map(c => (
        <div key={c.id} style={{
          minWidth: 220, flexShrink: 0, borderRadius: 16, padding: 16,
          background: 'linear-gradient(135deg, #FF8A00, #FF5D00)', color: '#fff',
          boxShadow: '0 8px 24px rgba(255,93,0,.25)',
        }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>
            {c.type === 'percent' ? `-${Number(c.value)}%` : `-${Number(c.value)} MAD`}
          </div>
          <div style={{ fontSize: 12, opacity: .92, marginTop: 4, minHeight: 32 }}>
            {c.description || 'Offre exclusive pour vous'}
          </div>
          <div style={{ fontSize: 11, fontFamily: 'monospace', marginTop: 10, background: 'rgba(255,255,255,.2)', borderRadius: 8, padding: '4px 8px', display: 'inline-block' }}>
            {c.code}
          </div>
        </div>
      ))}
    </div>
  );
}
