import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { playCardVariants } from '../../play/games/playMotion';
import GamingCardArtwork from './GamingCardArtwork';

// Carte "jeu célèbre" (fiche éditoriale Gaming Hub) — réutilise à l'identique
// les classes .play-game-card* de Play (langage visuel IGN/GameSpot déjà en
// place : image 16:10, dégradé bas, titre+meta ancrés, lift au survol).
export default function GamingCard({ game }) {
  const navigate = useNavigate();
  if (!game) return null;
  return (
    <motion.button
      type="button"
      className="play-game-card"
      variants={playCardVariants}
      onClick={() => navigate(`/gaming/${game.slug}`)}
      aria-label={game.name}
    >
      <GamingCardArtwork image={game.cover_image_url} />
      <span className="play-game-card-gradient" aria-hidden="true" />
      {game.publisher?.name && <span className="play-game-card-badge">{game.publisher.name}</span>}
      <span className="play-game-card-content">
        <small>{game.genre || game.category?.label || 'Gaming'}</small>
        <strong>{game.name}</strong>
        <span className="play-game-card-meta">
          <span>{game.universe || ' '}</span>
          <span className="play-game-card-play">Voir la fiche</span>
        </span>
      </span>
    </motion.button>
  );
}
