import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { playCardVariants } from '../../play/games/playMotion';
import { useI18n } from '../../../i18n/config';
import { ARTICLE_TYPE_COLORS } from '../articleTypeColors';

function ArticleArtwork({ image, type }) {
  const color = ARTICLE_TYPE_COLORS[type] || '#22C3FF';
  return (
    <span className="play-game-artwork" style={{ '--game-color': color }} aria-hidden="true">
      {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : (
        <span className="play-game-artwork-fallback"><i /><i /><span style={{ fontSize: 13, fontWeight: 900, color: '#fff', position: 'relative', zIndex: 2 }}>iF</span></span>
      )}
    </span>
  );
}

// Carte article éditorial — même langage visuel que GamingCard/GameCard
// (classes .play-game-card*), badge coloré par article_type.
export default function ArticleCard({ article }) {
  const navigate = useNavigate();
  const { t, formatDate } = useI18n();
  if (!article) return null;
  const color = ARTICLE_TYPE_COLORS[article.article_type] || '#22C3FF';
  return (
    <motion.button
      type="button"
      className="play-game-card"
      variants={playCardVariants}
      onClick={() => navigate(`/gaming/articles/${article.slug}`)}
      aria-label={article.title}
    >
      <ArticleArtwork image={article.cover_image_url} type={article.article_type} />
      <span className="play-game-card-gradient" aria-hidden="true" />
      <span className="play-game-card-badge" style={{ background: color, borderColor: color }}>
        {t(`gaminghub.type.${article.article_type}`)}
      </span>
      <span className="play-game-card-content">
        <small>{article.published_at ? formatDate(article.published_at) : ''}</small>
        <strong>{article.title}</strong>
      </span>
    </motion.button>
  );
}
