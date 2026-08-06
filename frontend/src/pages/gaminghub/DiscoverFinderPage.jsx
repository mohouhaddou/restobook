import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, Compass } from 'lucide-react';
import { API } from '../../api';
import { useI18n } from '../../i18n/config';
import SimilarGamesGrid from '../../modules/gaminghub/components/SimilarGamesGrid';
import '../../modules/gaminghub/gaminghub.css';

// Bonus §11 du besoin original : "Découvrir des jeux similaires" — choisir un
// jeu célèbre et obtenir jusqu'à 30 jeux HTML5 ressemblants sur iFilino Play.
// Réutilise le même moteur de similarité que la fiche jeu (limit=30 au lieu
// de 15) et le même composant SimilarGamesGrid, thème iFilino Play.
export default function DiscoverFinderPage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSlug = searchParams.get('jeu') || '';
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [similarGames, setSimilarGames] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(API('/gaminghub/games?limit=50')).then(r => r.json()).then(data => setGames(data.games || [])).catch(() => setGames([]));
  }, []);

  useEffect(() => {
    if (!selectedSlug) { setSelectedGame(null); setSimilarGames([]); return; }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(API(`/gaminghub/games/${selectedSlug}`)).then(r => (r.ok ? r.json() : Promise.reject())),
      fetch(API(`/gaminghub/games/${selectedSlug}/similar?limit=30`)).then(r => (r.ok ? r.json() : { games: [] })).catch(() => ({ games: [] })),
    ])
      .then(([gameRes, similarRes]) => { if (!cancelled) { setSelectedGame(gameRes.game); setSimilarGames(similarRes.games || []); } })
      .catch(() => { if (!cancelled) { setSelectedGame(null); setSimilarGames([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedSlug]);

  return (
    <div className="play-page">
      <main className="play-container" style={{ maxWidth: 860 }}>
        <nav className="play-details-breadcrumb" aria-label="Fil d'Ariane">
          <a href="/gaming"><ChevronLeft size={16} /> {t('gaminghub.breadcrumb.gaming')}</a>
          <span>/</span><span>{t('gaminghub.finder.title')}</span>
        </nav>

        <div className="gh-page-header">
          <h1><Compass size={26} />{t('gaminghub.finder.title')}</h1>
          <p>{t('gaminghub.finder.subtitle')}</p>
        </div>

        <label className="play-catalog-search" style={{ maxWidth: 380, marginBottom: 28 }} htmlFor="gh-finder-select">
          <span>{t('gaminghub.finder.selectLabel')}</span>
          <div>
            <select id="gh-finder-select" value={selectedSlug} onChange={e => setSearchParams(e.target.value ? { jeu: e.target.value } : {})} style={{ border: 0, background: 'transparent', width: '100%', fontSize: 15, color: '#0f1b2d' }}>
              <option value="">{t('gaminghub.finder.placeholder')}</option>
              {games.map(g => <option key={g.slug} value={g.slug}>{g.name}</option>)}
            </select>
          </div>
        </label>

        {loading && <div className="play-skeleton-grid">{Array.from({ length: 4 }, (_, i) => <span key={i} />)}</div>}

        {!loading && selectedGame && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              {selectedGame.cover_image_url && (
                <img src={selectedGame.cover_image_url} alt={selectedGame.name} style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover' }} />
              )}
              <div>
                <strong style={{ color: 'var(--il-text)' }}>{selectedGame.name}</strong>
                <div style={{ fontSize: 12, color: 'var(--il-muted)' }}>{selectedGame.genre}</div>
              </div>
              <a href={`/gaming/${selectedGame.slug}`} className="play-btn secondary" style={{ marginInlineStart: 'auto', textDecoration: 'none' }}>{t('gaminghub.finder.viewSheet')}</a>
            </div>
            {similarGames.length > 0
              ? <SimilarGamesGrid gameName={selectedGame.name} games={similarGames} />
              : <div className="gh-empty-state"><strong>{t('gaminghub.similar.empty')}</strong></div>}
          </>
        )}
      </main>
    </div>
  );
}
