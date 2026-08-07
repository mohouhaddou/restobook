import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Gamepad2, Play, Search, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AUTO_ADVANCE_MS = 6000;

// Le flux GamePix ne fournit que des miniatures ?w=320 — trop petites pour
// un fond plein écran ; on remonte la largeur demandée à leur CDN.
const heroImageUrl = url => (url && url.includes('img.gamepix.com')) ? url.replace(/([?&])w=\d+/, '$1w=1200') : url;

export default function PlayHero({ gameCount, query, onQueryChange, heroGames = [] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const hasCarousel = heroGames.length > 0;
  const active = hasCarousel ? heroGames[index % heroGames.length] : null;

  useEffect(() => { setIndex(0); }, [heroGames.length]);

  useEffect(() => {
    if (!hasCarousel || paused || heroGames.length < 2) return undefined;
    const timer = window.setInterval(() => setIndex(i => (i + 1) % heroGames.length), AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [hasCarousel, paused, heroGames.length]);

  return <motion.section className="play-catalog-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
    {hasCarousel && (
      <div className="play-hero-carousel-bg" aria-hidden="true">
        <AnimatePresence>
          {active.thumbnail && <motion.div key={active.slug} className="play-hero-carousel-slide" style={{ backgroundImage: `url(${heroImageUrl(active.thumbnail)})` }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .7 }}/>}
        </AnimatePresence>
      </div>
    )}
    <div className="play-catalog-orb one" aria-hidden="true"/><div className="play-catalog-orb two" aria-hidden="true"/>
    <div className="play-catalog-hero-inner">
      <div className="play-catalog-hero-copy">
        <img src="/brand/ifilino_play_mark.png" alt="iFilino Play" className="play-catalog-logo"/>
        {hasCarousel ? (
          <AnimatePresence mode="wait">
            <motion.div key={active.slug} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .35 }}>
              <span className="play-catalog-kicker"><Sparkles size={16}/> Sélection du moment</span>
              <h1>{active.name}</h1>
              {active.description && <p className="play-hero-carousel-desc">{active.description}</p>}
              <div className="play-hero-carousel-actions">
                <Link to={`/play/${active.slug}`} className="play-btn"><Play size={16} fill="currentColor"/> Jouer</Link>
                {heroGames.length > 1 && (
                  <div className="play-hero-carousel-dots" role="tablist" aria-label="Jeux en vedette">
                    {heroGames.map((g, i) => <button key={g.slug} type="button" role="tab" aria-selected={i === index} aria-label={g.name} className={i === index ? 'active' : ''} onClick={() => setIndex(i)}/>)}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        ) : (
          <>
            <span className="play-catalog-kicker"><Sparkles size={16}/> Le meilleur d’iFilino</span>
            <h1>Votre prochaine partie commence ici.</h1>
            <p>Jeux rapides, défis et aventures marocaines dans une expérience pensée pour tous les écrans.</p>
          </>
        )}
        <div className="play-catalog-count"><Gamepad2 size={18}/><strong>{gameCount}</strong> jeux disponibles</div>
      </div>
      <label className="play-catalog-search" htmlFor="play-game-search"><span>Rechercher un jeu</span><div><Search size={21}/><input id="play-game-search" type="search" value={query} onChange={event => onQueryChange(event.target.value)} placeholder="2048, quiz, puzzle…" autoComplete="off"/></div></label>
    </div>
    {hasCarousel && heroGames.length > 1 && (
      <>
        <button type="button" className="play-hero-carousel-nav prev" onClick={() => setIndex(i => (i - 1 + heroGames.length) % heroGames.length)} aria-label="Jeu précédent"><ChevronLeft/></button>
        <button type="button" className="play-hero-carousel-nav next" onClick={() => setIndex(i => (i + 1) % heroGames.length)} aria-label="Jeu suivant"><ChevronRight/></button>
      </>
    )}
  </motion.section>;
}
