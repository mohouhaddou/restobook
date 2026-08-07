import React from 'react';

export default function HomeSeoView() {
  return (
    <div className="mk-wrap mk-light" style={{ minHeight: '100vh', background: 'var(--mk-bg)' }}>
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '48px 16px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800 }}>Ifilino — Commerces de proximité</h1>
        <p style={{ fontSize: 16, color: 'var(--mk-muted, #64748B)' }}>
          Trouvez un restaurant, une épicerie ou une pharmacie près de chez vous et faites-vous livrer en quelques minutes.
        </p>
        <p><a href="/restaurants">Voir tous les restaurants →</a></p>
        <p><a href="/epiceries">Voir toutes les épiceries →</a></p>
        <p><a href="/pharmacies">Voir toutes les pharmacies →</a></p>
      </main>
    </div>
  );
}
