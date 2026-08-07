import React from 'react';

const DEFAULT_STOPS = [
  { offset: '0%', color: '#FFA23D' },
  { offset: '55%', color: '#FF8A00' },
  { offset: '100%', color: '#E85D00' },
];

/**
 * Forme courbée iFilino — un arc fin, fluide et légèrement asymétrique
 * (ancrages haut/bas différents, courbe cubique plutôt que quadratique,
 * inspirée des dégradés organiques Apple/Figma), occupant ~38-40% de la
 * largeur en desktop (contre ~48-58% dans la version précédente) pour laisser
 * beaucoup plus de place à l'image de campagne. Le bord est prolongé d'une
 * fine bande "glow" — un dégradé lumineux (blanc → transparent, en
 * `objectBoundingBox` donc relatif à la bande elle-même, pas au viewBox)
 * plutôt qu'un simple aplat translucide, pour une transition douce vers la
 * photo plutôt qu'une ligne franche.
 */
export function HeroArcShape({ gradId, colorStops = DEFAULT_STOPS }) {
  return (
    <>
      <svg className="mk-hero-shape-desktop" viewBox="0 0 1000 900" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            {colorStops.map((s, i) => <stop key={i} offset={s.offset} stopColor={s.color} />)}
          </linearGradient>
          <linearGradient id={`${gradId}glow`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0,0 H380 C460,140 410,650 400,900 H0 Z" fill={`url(#${gradId})`} />
        <path d="M380,0 C460,140 410,650 400,900 L426,900 C436,650 486,140 406,0 Z" fill={`url(#${gradId}glow)`} />
      </svg>
      <svg className="mk-hero-shape-mobile" viewBox="0 0 1000 900" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id={`${gradId}m`} x1="0%" y1="0%" x2="100%" y2="100%">
            {colorStops.map((s, i) => <stop key={i} offset={s.offset} stopColor={s.color} />)}
          </linearGradient>
          <linearGradient id={`${gradId}mglow`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0,0 H1000 V280 C820,360 260,420 0,320 Z" fill={`url(#${gradId}m)`} />
        <path d="M1000,280 C820,360 260,420 0,320 L0,346 C260,446 820,386 1000,306 Z" fill={`url(#${gradId}mglow)`} />
      </svg>
    </>
  );
}
