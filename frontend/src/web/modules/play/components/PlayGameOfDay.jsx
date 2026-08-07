import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Sparkles } from 'lucide-react';
import GameCardArtwork from './GameCardArtwork';

export default function PlayGameOfDay({ game }) {
  if (!game) return null;
  return (
    <section className="play-day-feature" aria-labelledby="play-day-title">
      <div className="play-day-art"><GameCardArtwork game={game}/></div>
      <div className="play-day-copy">
        <span className="play-ui-eyebrow"><Sparkles size={15}/> Jeu du jour</span>
        <h2 id="play-day-title">{game.name}</h2>
        {game.description && <p>{game.description}</p>}
        <Link to={`/play/${game.slug}`} className="play-btn"><Play size={16} fill="currentColor"/> Découvrir</Link>
      </div>
    </section>
  );
}
