import React from 'react';
import Breadcrumbs from './components/Breadcrumbs';

// Vue de présentation pure (SSR) — fiche d'un jeu HTML5 iFilino Play. Comble
// le gap SEO client-only (PlayGameSeo.jsx, invisible aux bots Facebook/X qui
// n'exécutent pas le JS) : nécessaire pour que les boutons de partage
// affichent le bon titre/image dans l'aperçu de lien. Voir GameDetailsPage.jsx
// pour l'équivalent interactif consommé par le bundle client au boot.
export default function PlayGameSeoView({ game }) {
  const image = game.thumbnail;

  return (
    <div className="mk-wrap mk-light" style={{ minHeight: '100vh', background: 'var(--il-bg, #0A0F1A)', color: 'var(--il-text, #EEF4FB)' }}>
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
        <Breadcrumbs items={[{ name: 'Accueil', path: '/' }, { name: 'iFilino Play', path: '/play' }, { name: game.name }]} />

        {image && <img src={image} alt={game.name} width={860} height={420} style={{ width: '100%', height: 360, objectFit: 'cover', borderRadius: 14, marginBottom: 16 }} />}

        <h1 style={{ margin: '0 0 6px' }}>{game.name}</h1>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--il-muted, #93A4BD)' }}>
          {game.category}{game.difficulty ? ` · ${game.difficulty}` : ''}{game.averageDuration ? ` · ${game.averageDuration} min` : ''}
        </p>

        {game.description && <p>{game.description}</p>}

        <p style={{ marginTop: 24 }}>
          <a href={`/play/${game.slug}/play`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 12, background: 'var(--il-gradient, linear-gradient(135deg,#22C3FF,#D946EF))', color: 'var(--play-on-accent, #0b1626)', fontWeight: 800, textDecoration: 'none' }}>
            Jouer gratuitement
          </a>
        </p>
      </main>
    </div>
  );
}
