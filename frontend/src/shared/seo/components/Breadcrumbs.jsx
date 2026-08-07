import React from 'react';

// Fil d'Ariane partagé par toutes les vues SEO (SSR) — composant pur, aucune
// API navigateur, donc réutilisable tel quel côté client si besoin plus tard.
export default function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Fil d'Ariane" style={{ fontSize: 13, color: 'var(--mk-muted, #64748B)', marginBottom: 16 }}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span aria-hidden="true" style={{ margin: '0 6px' }}>›</span>}
          {it.path ? <a href={it.path} style={{ color: 'inherit' }}>{it.name}</a> : <span>{it.name}</span>}
        </React.Fragment>
      ))}
    </nav>
  );
}
