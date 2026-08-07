import React from 'react';
import { ASSET } from '../../../../api';

// "Commerces concernés" — alimenté soit par les related_business_refs
// manuels de l'article, soit par le matching automatique (voir
// discover/articleService.findMatchingBusinesses) : la donnée arrive déjà
// résolue et fusionnée depuis le backend, ce composant ne fait qu'afficher.
export default function BusinessMatchGrid({ businesses, title = 'Commerces concernés' }) {
  if (!businesses?.length) return null;
  return (
    <section style={{ margin: '20px 0 32px' }}>
      <h2>{title}</h2>
      <div className="ifm-business-grid">
        {businesses.map(b => (
          <a key={`${b.vertical}-${b.slug}`} className="ifm-business-card mk-card" href={`/${b.url_prefix}/${b.slug}`}>
            {(b.cover_url || b.logo_url) && <img src={ASSET(b.cover_url || b.logo_url)} alt={b.name} />}
            <div className="ifm-business-card-body">
              <p className="ifm-business-card-name">{b.name}</p>
              <p className="ifm-business-card-meta">
                {b.city || ''}{b.avg_rating > 0 ? ` · ⭐ ${b.avg_rating.toFixed(1)}` : ''}
              </p>
              <p className="ifm-business-card-meta">
                {b.eta_range ? `⏱ ${b.eta_range}` : ''}{b.eta_range && b.is_open !== undefined ? ' · ' : ''}{b.is_open === true ? 'Ouvert' : b.is_open === false ? 'Fermé' : ''}
              </p>
              <span className="ifm-business-card-cta">Voir la boutique</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
