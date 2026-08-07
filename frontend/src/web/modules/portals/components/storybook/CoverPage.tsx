import React from 'react';
import type { ImageBlock } from '../../../../markdown/MarkdownParser';

export interface CoverPageProps {
  readonly image: ImageBlock;
  readonly title: string;
  readonly subtitle?: string | null;
  readonly onStart: () => void;
  readonly startLabel: string;
}

/**
 * Vraie couverture de livre — jamais une page blanche avec juste un titre : l'illustration occupe
 * TOUTE la page, un voile sombre en dégradé (transparent en haut, sombre en bas) garantit la
 * lisibilité du titre superposé par-dessus, quelle que soit l'image. Titre très grand, sous-titre
 * discret, un seul bouton d'action clair pour entrer dans le livre.
 */
export function CoverPage({ image, title, subtitle, onStart, startLabel }: CoverPageProps) {
  return (
    <div className="cover-page">
      <img className="cover-page-image" src={image.src} alt="" />
      <div className="cover-page-veil" aria-hidden="true" />
      <div className="cover-page-content">
        <h1 className="cover-page-title">{title}</h1>
        {subtitle && <p className="cover-page-subtitle">{subtitle}</p>}
        <button type="button" className="cover-page-start" onClick={onStart}>{startLabel}</button>
      </div>
    </div>
  );
}
