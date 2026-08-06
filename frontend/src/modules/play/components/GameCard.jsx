import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Clock3, Play } from 'lucide-react';
import { getGameSection, humanizeCategory } from '../config/gameCatalogMeta';
import { playCardVariants } from '../games/playMotion';
import GameCardArtwork from './GameCardArtwork';

const SECTION_NAMES = { populaires: 'Arcade', quiz: 'Quiz', puzzle: 'Puzzle', voyage: 'Voyage', culture: 'Culture' };

export default function GameCard({ game }) {
  const navigate = useNavigate();
  const section = getGameSection(game);
  const sectionLabel = SECTION_NAMES[section] || humanizeCategory(section) || 'Jeu';
  const duration = game.averageDuration || game.duration;
  return (
    <motion.button type="button" className="play-game-card" variants={playCardVariants} onClick={() => navigate('/play/' + game.slug)} aria-label={'Jouer à ' + game.name}>
      <GameCardArtwork game={game}/>
      <span className="play-game-card-gradient" aria-hidden="true"/>
      <span className="play-game-card-badge">{game.source === 'partner' ? 'Partenaire' : 'iFilino'}</span>
      {(game.isNew || game.isTrending) && <span className="play-game-card-flags">{game.isTrending && <span className="play-game-card-flag trending">Tendance</span>}{game.isNew && <span className="play-game-card-flag new">Nouveau</span>}</span>}
      <span className="play-game-card-content"><small>{sectionLabel}</small><strong>{game.name}</strong><span className="play-game-card-meta">{duration ? <span><Clock3/> {duration} min</span> : <span>Partie rapide</span>}<span className="play-game-card-play"><Play fill="currentColor"/> Jouer</span></span></span>
    </motion.button>
  );
}
