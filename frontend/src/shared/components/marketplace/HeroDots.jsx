import React from 'react';
import { AUTOPLAY_MS } from '../../hooks/useHeroCarousel';

/**
 * Indicateurs de slide premium — le slide actif devient une pilule blanche
 * avec une barre de progression (durée alignée sur l'autoplay), les autres
 * restent de petits points. La progression se met en pause via CSS pur
 * (`.mk-hero-root:hover .mk-hero-dot-progress`), pas de state React.
 */
export function HeroDots({ slides, idx, goTo }) {
  if (slides.length < 2) return null;
  return (
    <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, zIndex: 4 }}>
      {slides.map((s, i) => (
        <button key={s.id} onClick={() => goTo(i)} className={`mk-hero-dot${i === idx ? ' active' : ''}`} aria-label={`Slide ${i + 1}`}>
          {i === idx && <span key={`p-${s.id}`} className="mk-hero-dot-progress" style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />}
        </button>
      ))}
    </div>
  );
}
