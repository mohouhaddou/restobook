import React from 'react';

export default function PlayRouteFallback() {
  return <div className="play-page"><main className="play-container play-route-skeleton" aria-busy="true" aria-label="Chargement d’iFilino Play"><span className="play-skeleton-hero"/><span className="play-skeleton-line wide"/><span className="play-skeleton-line"/><div className="play-skeleton-grid">{Array.from({ length: 6 }, (_, index) => <span key={index}/>)}</div><span className="sr-only" role="status">Chargement d’iFilino Play…</span></main></div>;
}
