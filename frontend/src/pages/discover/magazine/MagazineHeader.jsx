import React from 'react';

// Barre d'en-tête magazine — recherche (filtre local sur les articles déjà
// chargés, pas une recherche plein texte serveur, voir plan §Hors scope) +
// CTA marketplace. `onSearchChange` optionnel (rendu inerte en SSR).
export default function MagazineHeader({ searchValue = '', onSearchChange, placeholder = 'Rechercher un article…', ctaLabel = 'Commander sur iFilino' }) {
  return (
    <div className="ifm-header-bar">
      <div className="ifm-search">
        <input
          type="search"
          placeholder={placeholder}
          value={searchValue}
          onChange={onSearchChange}
          readOnly={!onSearchChange}
        />
      </div>
      <a href="/marketplace" className="btn btn-primary">{ctaLabel}</a>
    </div>
  );
}
