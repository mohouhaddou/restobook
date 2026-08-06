import React from 'react';
import Breadcrumbs from './components/Breadcrumbs';

// Vue de présentation pure (SSR) — fiche éditoriale d'un jeu tiers célèbre
// (ex. Dofus), jamais un jeu distribué sur iFilino. Voir GameProfilePage.jsx
// pour l'équivalent interactif consommé par le bundle client (main.jsx) au
// boot, même duplication volontaire que ArticleSeoView/ArticlePage.
export default function GameSeoView({ game, similarGames }) {
  const image = game.cover_image_url;

  return (
    <div className="mk-wrap mk-light" style={{ minHeight: '100vh', background: 'var(--il-bg, #fff)', color: 'var(--il-text, #0F172A)' }}>
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
        <Breadcrumbs items={[{ name: 'Accueil', path: '/' }, { name: 'Gaming', path: '/gaming' }, { name: game.name }]} />

        {image && <img src={image} alt={game.name} width={860} height={420} style={{ width: '100%', height: 360, objectFit: 'cover', borderRadius: 14, marginBottom: 16 }} />}

        <h1 style={{ margin: '0 0 6px' }}>{game.name}</h1>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--il-muted, #64748B)' }}>
          {game.genre || game.category?.label}{game.publisher?.name ? ` · ${game.publisher.name}` : ''}
        </p>

        {game.description && <p>{game.description}</p>}

        {game.why_popular && (
          <section style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 18 }}>Pourquoi ce jeu est populaire</h2>
            <p>{game.why_popular}</p>
          </section>
        )}

        {game.gameplay && (
          <section style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 18 }}>Gameplay</h2>
            <p>{game.gameplay}</p>
          </section>
        )}

        {game.faqs?.length > 0 && (
          <section style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 18 }}>FAQ</h2>
            {game.faqs.map(f => (
              <div key={f.id} style={{ marginBottom: 12 }}>
                <strong>{f.question}</strong>
                <p style={{ margin: '4px 0 0' }}>{f.answer}</p>
              </div>
            ))}
          </section>
        )}

        {similarGames?.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 18 }}>Vous aimez {game.name} ? Essayez aussi sur iFilino Play</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 12 }}>
              {similarGames.map(g => (
                <a key={g.slug} href={`/play/${g.slug}`} style={{ display: 'block', border: '1px solid var(--il-border, #E2E8F0)', borderRadius: 12, padding: 12, textDecoration: 'none', color: 'inherit' }}>
                  {g.thumbnail_url && <img src={g.thumbnail_url} alt={g.name} width={160} height={100} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8, marginBottom: 6 }} />}
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{g.name}</div>
                  {g.genre && <div style={{ fontSize: 11, color: 'var(--il-muted, #64748B)' }}>{g.genre}</div>}
                  <span style={{ fontSize: 12, color: 'var(--il-primary, #FF8A00)', fontWeight: 700 }}>Jouer →</span>
                </a>
              ))}
            </div>
          </section>
        )}

        <p style={{ marginTop: 32, fontSize: 12, color: 'var(--il-muted, #64748B)' }}>
          {game.name}{game.publisher?.name ? ` appartient à ${game.publisher.name}` : ''} et à ses ayants droit respectifs. iFilino n'est pas affilié à ce jeu et ne le distribue pas.
        </p>
      </main>
    </div>
  );
}
