import React from 'react';
import Breadcrumbs from '../../../shared/seo/components/Breadcrumbs';
import { BusinessListSection } from './components/BusinessCard';

const VERTICAL_LABELS = {
  hanout:    { plural: 'Épiceries', singular: 'épicerie', urlPrefix: 'epiceries' },
  pharmacie: { plural: 'Pharmacies', singular: 'pharmacie', urlPrefix: 'pharmacies' },
};

export default function BusinessIndexSeoView({ vertical, businesses }) {
  const v = VERTICAL_LABELS[vertical];
  return (
    <div className="mk-wrap mk-light" style={{ minHeight: '100vh', background: 'var(--mk-bg)' }}>
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        <Breadcrumbs items={[{ name: 'Accueil', path: '/' }, { name: v.plural }]} />
        <h1>{v.plural}</h1>
        <p style={{ color: 'var(--mk-muted, #64748B)' }}>
          Découvrez tous les commerces {v.singular} partenaires Ifilino : produits, avis, livraison en ligne.
        </p>
        <BusinessListSection businesses={businesses} urlPrefix={v.urlPrefix} emptyLabel={v.singular} />
      </main>
    </div>
  );
}
