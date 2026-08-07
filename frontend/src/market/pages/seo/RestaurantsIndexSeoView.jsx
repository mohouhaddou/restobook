import React from 'react';
import Breadcrumbs from '../../../shared/seo/components/Breadcrumbs';
import { BusinessListSection } from './components/BusinessCard';

export default function RestaurantsIndexSeoView({ restaurants }) {
  return (
    <div className="mk-wrap mk-light" style={{ minHeight: '100vh', background: 'var(--mk-bg)' }}>
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        <Breadcrumbs items={[{ name: 'Accueil', path: '/' }, { name: 'Restaurants' }]} />
        <h1>Restaurants</h1>
        <p style={{ color: 'var(--mk-muted, #64748B)' }}>
          Découvrez tous les restaurants partenaires Ifilino : menus, avis, livraison et réservation en ligne.
        </p>
        <BusinessListSection businesses={restaurants} urlPrefix="restaurants" emptyLabel="restaurant" />
      </main>
    </div>
  );
}
