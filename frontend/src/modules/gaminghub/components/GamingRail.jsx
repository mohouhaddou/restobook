import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { playCardGridContainer } from '../../play/games/playMotion';

// Rail générique (header icône+titre+compteur + grille + "Afficher plus") —
// miroir de GameRail.jsx (Play) mais découplé du type PlayGame : accepte
// n'importe quel item + un composant de rendu, réutilisé pour Populaires /
// Actualités / Guides / Mises à jour / Tendances / Collections. Réutilise
// les classes .play-game-rail/.play-section/.play-game-rail-track à l'identique.
export default function GamingRail({ id, icon: Icon, title, items, renderItem, seeAllHref, seeAllLabel, pageSize = 8, viewMode = 'grid' }) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  useEffect(() => setVisibleCount(pageSize), [items, viewMode]);
  if (!items?.length) return null;
  const visible = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  return (
    <motion.section className={`play-game-rail play-section view-${viewMode}`} initial="hidden" animate="visible" variants={playCardGridContainer} aria-labelledby={`gh-rail-${id}`}>
      <header>
        <h2 id={`gh-rail-${id}`}>{Icon && <Icon size={20} />}{title}</h2>
        <div className="play-rail-header-end">
          <span>{visible.length} / {items.length}</span>
          {seeAllHref && (
            <Link to={seeAllHref} className="play-rail-reset" style={{ textDecoration: 'none' }}>
              {seeAllLabel} <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </header>
      <div className={`play-game-rail-track ${viewMode}`}>
        {visible.map(item => renderItem(item))}
      </div>
      {hasMore && (
        <button type="button" className="play-show-more" onClick={() => setVisibleCount(c => c + pageSize)}>
          Afficher plus <small>({items.length - visibleCount} restants)</small>
        </button>
      )}
    </motion.section>
  );
}
