import React from 'react';
import { BRAND_ASSETS } from '../../brandAssets';

const HEIGHTS = {
  xs:  { full: 40,  icon: 30 },   // navbars compactes (60px haut max)
  sm:  { full: 64,  icon: 44 },   // sidebar, footer
  md:  { full: 88,  icon: 60 },   // login, panneaux latéraux
  lg:  { full: 112, icon: 80 },   // customer auth, pages centrées
  xl:  { full: 150, icon: 108 },  // hero / splash
};

/**
 * BrandLogo — logo RestoBook depuis /brand/
 *
 * variant  "full" (logo complet PNG avec texte) | "icon" (symbole carré seul)
 * theme    "light" → restobook_light.png | "dark" → restobook_dark.png
 * size     "xs" | "sm" | "md" | "lg" | "xl"
 * style    height peut être surchargé : style={{ height: 52 }}
 */
export function BrandLogo({ variant = 'full', theme = 'light', size = 'md', className = '', style = {} }) {
  const src = variant === 'icon'
    ? BRAND_ASSETS.icon
    : (theme === 'dark' ? BRAND_ASSETS.logoDark : BRAND_ASSETS.logoLight);

  const h = (HEIGHTS[size] ?? HEIGHTS.md)[variant];

  return (
    <img
      src={src}
      alt="RestoBook"
      className={className}
      style={{ objectFit: 'contain', display: 'block', height: h, width: 'auto', ...style }}
    />
  );
}
