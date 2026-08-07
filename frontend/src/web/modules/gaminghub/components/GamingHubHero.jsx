import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Gamepad2, Search, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../../../i18n/config';

const AUTO_ADVANCE_MS = 6500;

// Hero Gaming Hub — clone structurel de PlayHero.jsx (mêmes classes
// .play-catalog-hero*), carousel auto-avancé sur des fiches jeux célèbres
// réelles (jamais de contenu inventé), CTA "Voir la fiche" au lieu de
// "Jouer", barre de recherche reliée à /gaming/recherche.
export default function GamingHubHero({ gameCount, heroGames = [] }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState('');
  const hasCarousel = heroGames.length > 0;
  const active = hasCarousel ? heroGames[index % heroGames.length] : null;

  useEffect(() => { setIndex(0); }, [heroGames.length]);

  useEffect(() => {
    if (!hasCarousel || paused || heroGames.length < 2) return undefined;
    const timer = window.setInterval(() => setIndex(i => (i + 1) % heroGames.length), AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [hasCarousel, paused, heroGames.length]);

  function goToSearch() {
    navigate(query.trim() ? `/gaming/recherche?q=${encodeURIComponent(query.trim())}` : '/gaming/recherche');
  }

  return (
    <motion.section className="play-catalog-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {hasCarousel && (
        <div className="play-hero-carousel-bg" aria-hidden="true">
          <AnimatePresence>
            {active.cover_image_url && (
              <motion.div key={active.slug} className="play-hero-carousel-slide" style={{ backgroundImage: `url(${active.cover_image_url})` }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .7 }} />
            )}
          </AnimatePresence>
        </div>
      )}
      <div className="play-catalog-orb one" aria-hidden="true" /><div className="play-catalog-orb two" aria-hidden="true" />
      <div className="play-catalog-hero-inner">
        <div className="play-catalog-hero-copy">
          <img src="/brand/ifilino_play_mark.png" alt="iFilino Gaming Hub" className="play-catalog-logo" />
          {hasCarousel ? (
            <AnimatePresence mode="wait">
              <motion.div key={active.slug} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .35 }}>
                <span className="play-catalog-kicker"><Sparkles size={16} /> {t('gaminghub.hero.kicker')}</span>
                <h1>{active.name}</h1>
                {active.description && <p className="play-hero-carousel-desc">{active.description}</p>}
                <div className="play-hero-carousel-actions">
                  <Link to={`/gaming/${active.slug}`} className="play-btn">{t('gaminghub.hero.cta')}</Link>
                  {heroGames.length > 1 && (
                    <div className="play-hero-carousel-dots" role="tablist" aria-label={t('gaminghub.hero.featured')}>
                      {heroGames.map((g, i) => <button key={g.slug} type="button" role="tab" aria-selected={i === index} aria-label={g.name} className={i === index ? 'active' : ''} onClick={() => setIndex(i)} />)}
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          ) : (
            <>
              <span className="play-catalog-kicker"><Sparkles size={16} /> {t('gaminghub.hero.kicker')}</span>
              <h1>{t('gaminghub.hero.title')}</h1>
              <p>{t('gaminghub.hero.subtitle')}</p>
            </>
          )}
          <div className="play-catalog-count"><Gamepad2 size={18} /><strong>{gameCount}</strong> {t('gaminghub.hero.gamesAvailable')}</div>
        </div>
        <label className="play-catalog-search" htmlFor="gh-hero-search">
          <span>{t('gaminghub.hero.searchLabel')}</span>
          <div>
            <Search size={21} />
            <input
              id="gh-hero-search" type="search" value={query} autoComplete="off"
              placeholder={t('gaminghub.hero.searchPlaceholder')}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') goToSearch(); }}
            />
          </div>
        </label>
      </div>
      {hasCarousel && heroGames.length > 1 && (
        <>
          <button type="button" className="play-hero-carousel-nav prev" onClick={() => setIndex(i => (i - 1 + heroGames.length) % heroGames.length)} aria-label={t('gaminghub.hero.prev')}><ChevronLeft /></button>
          <button type="button" className="play-hero-carousel-nav next" onClick={() => setIndex(i => (i + 1) % heroGames.length)} aria-label={t('gaminghub.hero.next')}><ChevronRight /></button>
        </>
      )}
    </motion.section>
  );
}
