import React from 'react';
import { motion } from 'framer-motion';
import { Gamepad2, Play } from 'lucide-react';
import { useI18n } from '../../../../i18n/config';
import { playCardVariants, playCardGridContainer } from '../../play/games/playMotion';

// "Vous aimez ce jeu ?" — le composant central de la conversion SEO→Play.
// Consomme GET /gaminghub/games/:slug/similar (uniquement les liens
// approuvés, voir similarityService.listApprovedSimilarGames côté backend).
// Réutilise les classes .play-game-rail/.play-game-card* pour rester
// visuellement identique au reste d'iFilino Play.
export default function SimilarGamesGrid({ gameName, games, title, viewMode = 'grid' }) {
  const { t } = useI18n();
  if (!games?.length) return null;

  return (
    <motion.section className={`play-game-rail play-section view-${viewMode}`} initial="hidden" animate="visible" variants={playCardGridContainer} aria-labelledby="gh-similar-rail">
      <header>
        <h2 id="gh-similar-rail"><Gamepad2 size={20} />{title || t('gaminghub.similar.title', { name: gameName })}</h2>
      </header>
      <div className={`play-game-rail-track ${viewMode}`}>
        {games.map(g => (
          <motion.a key={g.slug} href={`/play/${g.slug}`} className="play-game-card" variants={playCardVariants} aria-label={`${t('gaminghub.similar.play')} ${g.name}`}>
            <span className="play-game-artwork" aria-hidden="true">
              {g.thumbnail_url ? <img src={g.thumbnail_url} alt="" loading="lazy" decoding="async" /> : (
                <span className="play-game-artwork-fallback"><i /><i /><Gamepad2 size={44} strokeWidth={1.6} /></span>
              )}
            </span>
            <span className="play-game-card-gradient" aria-hidden="true" />
            <span className="play-game-card-badge">iFilino Play</span>
            <span className="play-game-card-content">
              <small>{g.genre || ''}</small>
              <strong>{g.name}</strong>
              <span className="play-game-card-meta">
                <span />
                <span className="play-game-card-play"><Play size={14} fill="currentColor" /> {t('gaminghub.similar.play')}</span>
              </span>
            </span>
          </motion.a>
        ))}
      </div>
    </motion.section>
  );
}
