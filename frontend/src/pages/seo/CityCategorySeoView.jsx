import React from 'react';
import Breadcrumbs from './components/Breadcrumbs';
import { BusinessListSection } from './components/BusinessCard';

// Duplique volontairement backend/src/modules/seo/verticals.js (petite table
// statique, projets npm distincts frontend/backend).
const URL_PREFIX_BY_VERTICAL = { restaurant: 'restaurants', hanout: 'epiceries', pharmacie: 'pharmacies' };

export default function CityCategorySeoView({ city, category, businesses }) {
  const urlPrefix = URL_PREFIX_BY_VERTICAL[category.vertical] || 'restaurants';
  return (
    <div className="mk-wrap mk-light" style={{ minHeight: '100vh', background: 'var(--mk-bg)' }}>
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        <Breadcrumbs items={[{ name: 'Accueil', path: '/' }, { name: city.name, path: `/${city.slug}` }, { name: category.name }]} />
        <h1>{category.name} à {city.name}</h1>
        <p style={{ color: 'var(--mk-muted, #64748B)' }}>
          {category.seo_description || `Les meilleures adresses ${category.name.toLowerCase()} à ${city.name}.`}
        </p>
        <BusinessListSection businesses={businesses} urlPrefix={urlPrefix} emptyLabel={category.name.toLowerCase()} />
      </main>
    </div>
  );
}
