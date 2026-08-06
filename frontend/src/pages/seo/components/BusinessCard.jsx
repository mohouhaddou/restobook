import React from 'react';
import StarRating from './StarRating';

// Carte commerce pour les listings SEO (restaurants/épiceries/pharmacies).
// Chemins d'image relatifs (/uploads/..., /brand/...) — résolus par le
// navigateur contre l'origine de la page, pas besoin d'URL absolue en SSR.
export function BusinessCard({ business, urlPrefix }) {
  const b = business;
  const image = b.cover_url || b.logo_url;
  return (
    <a href={`/${urlPrefix}/${b.slug}`} className="mk-card" style={{ display: 'block', textDecoration: 'none', color: 'inherit', marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 14, padding: 14 }}>
        {image && (
          <img src={image} alt={b.name} width={72} height={72}
            style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', flexShrink: 0, background: 'var(--mk-bg, #F8FAFC)' }} />
        )}
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>{b.name}</h3>
          <p style={{ margin: 0, color: 'var(--mk-muted, #64748B)', fontSize: 13 }}>
            {b.cuisine_type || b.type}{b.city ? ` — ${b.city}` : ''}
          </p>
          <div style={{ marginTop: 6 }}>
            <StarRating value={b.avg_rating} count={b.total_reviews} />
          </div>
        </div>
      </div>
    </a>
  );
}

export function BusinessListSection({ businesses, urlPrefix, emptyLabel }) {
  if (!businesses.length) return <p>Aucun {emptyLabel} disponible pour le moment.</p>;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {businesses.map(b => <BusinessCard key={b.slug} business={b} urlPrefix={urlPrefix} />)}
    </div>
  );
}
