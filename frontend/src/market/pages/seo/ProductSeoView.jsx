import React from 'react';
import Breadcrumbs from '../../../shared/seo/components/Breadcrumbs';

// Duplique volontairement le mapping module → préfixe d'URL de
// backend/src/modules/seo/verticals.js (petite table statique, pas
// partageable entre les deux projets npm distincts frontend/backend).
const URL_PREFIX_BY_MODULE = { resto: 'restaurants', hanout: 'epiceries', pharmacie: 'pharmacies' };

export default function ProductSeoView({ item }) {
  const bizPrefix = URL_PREFIX_BY_MODULE[item.module] || 'restaurants';
  const nutrition = item.nutrition;
  const image = item.images?.[0];

  return (
    <div className="mk-wrap mk-light" style={{ minHeight: '100vh', background: 'var(--mk-bg)' }}>
      <main style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
        <Breadcrumbs items={[
          { name: 'Accueil', path: '/' },
          { name: item.business.name, path: `/${bizPrefix}/${item.business.slug}` },
          { name: item.name },
        ]} />

        {image && <img src={image} alt={item.name} width={700} height={400} style={{ width: '100%', height: 320, objectFit: 'cover', borderRadius: 14, marginBottom: 16 }} />}

        <h1 style={{ margin: '0 0 6px' }}>{item.name}</h1>
        <p style={{ margin: '0 0 12px' }}>
          Chez <a href={`/${bizPrefix}/${item.business.slug}`}>{item.business.name}</a>
        </p>

        {item.price != null && (
          <p style={{ fontSize: 24, fontWeight: 800, margin: '0 0 12px' }}>
            {Number(item.price).toFixed(2)} MAD
            {item.compare_price && Number(item.compare_price) > Number(item.price) && (
              <span style={{ marginLeft: 10, fontSize: 15, color: 'var(--mk-muted, #64748B)', textDecoration: 'line-through' }}>
                {Number(item.compare_price).toFixed(2)} MAD
              </span>
            )}
          </p>
        )}

        {item.availability === 'out_of_stock' && <p style={{ color: '#DC2626', fontWeight: 700 }}>Indisponible</p>}
        {item.requires_prescription && <p>⚠️ Sur ordonnance</p>}

        {item.description && <p>{item.description}</p>}
        {item.category?.name && <p style={{ fontSize: 13, color: 'var(--mk-muted, #64748B)' }}>Catégorie : {item.category.name}</p>}

        {nutrition && (
          <section style={{ marginTop: 20, fontSize: 13 }}>
            {nutrition.calories ? <p>{nutrition.calories} kcal</p> : null}
            {nutrition.allergenes?.length > 0 && <p>Allergènes : {nutrition.allergenes.join(', ')}</p>}
          </section>
        )}
      </main>
    </div>
  );
}
