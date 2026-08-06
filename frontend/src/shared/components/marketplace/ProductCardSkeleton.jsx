import React from 'react';

// Squelette de chargement pour ProductCard — réutilise la classe .mk-skeleton
// existante (shimmer déjà défini globalement), pas de nouvelle animation.
export function ProductCardSkeleton() {
  return (
    <div className="mk-card" style={{ overflow: 'hidden' }}>
      <div className="mk-skeleton" style={{ width: '100%', paddingTop: '75%' }} />
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="mk-skeleton" style={{ height: 14, width: '85%', borderRadius: 6 }} />
        <div className="mk-skeleton" style={{ height: 10, width: '55%', borderRadius: 6 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <div className="mk-skeleton" style={{ height: 16, width: 60, borderRadius: 6 }} />
          <div className="mk-skeleton" style={{ height: 26, width: 70, borderRadius: 20 }} />
        </div>
      </div>
    </div>
  );
}
