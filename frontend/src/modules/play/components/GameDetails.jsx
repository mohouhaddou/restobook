import React from 'react';
import { ChevronRight, Heart, Play, ShieldCheck } from 'lucide-react';
import GameCardArtwork from './GameCardArtwork';
import GameMetadata from './GameMetadata';
import GameCard from './GameCard';
import useGameLibrary from '../hooks/useGameLibrary';
import ShareButtons from '../../../shared/components/social/ShareButtons';

export default function GameDetails({ game, similarGames, onPlay, onBack }) {
  const { favorite, toggleFavorite, loading: favoriteLoading, error: favoriteError, storage } = useGameLibrary(game.slug);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : `https://ifilino.com/play/${game.slug}`;
  return <main className="play-details"><nav className="play-details-breadcrumb" aria-label="Fil d’Ariane"><button type="button" onClick={onBack}>iFilino Play</button><ChevronRight aria-hidden="true"/><span aria-current="page">{game.name}</span></nav><section className="play-details-hero"><GameCardArtwork game={game}/><span className="play-details-shade" aria-hidden="true"/><div className="play-details-copy"><span className="play-details-provider"><ShieldCheck/> {game.source === 'partner' ? 'Jeu partenaire vérifié' : 'Une création iFilino Play'}</span><h1>{game.name}</h1><p>{game.description || game.howTo || 'Préparez-vous à relever un nouveau défi.'}</p><div className="play-details-actions"><button type="button" className="primary" onClick={onPlay}><Play fill="currentColor"/>Jouer</button><button type="button" disabled={favoriteLoading} aria-pressed={favorite} className={favorite ? 'favorite active' : 'favorite'} onClick={toggleFavorite}><Heart fill={favorite ? 'currentColor' : 'none'}/>{favorite ? 'Dans mes favoris' : 'Ajouter aux favoris'}</button></div>{favorite && <span className="play-details-share" role="status">Favori enregistré {storage === 'account' ? 'sur votre compte' : 'sur cet appareil'}</span>}{favoriteError && <span className="play-details-library-error" role="alert">{favoriteError}</span>}<div style={{ marginTop: 12 }}><ShareButtons title={game.name} text={game.description ? `${game.description} — Jouez gratuitement sur iFilino Play !` : `Jouez gratuitement à ${game.name} sur iFilino Play !`} url={shareUrl}/></div></div></section><GameMetadata game={game}/>{similarGames.length > 0 && <section className="play-details-similar"><h2>Vous aimerez aussi</h2><div>{similarGames.map(item => <GameCard key={`${item.providerId || 'legacy'}-${item.id}`} game={item}/>)}</div></section>}</main>;
}
