import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ASSET } from '../../../api';
import { useHeroCarousel } from '../../../shared/hooks/useHeroCarousel';
import { useHeroParallax } from '../../../shared/hooks/useHeroParallax';
import { HeroDots } from '../../../shared/components/hero/HeroDots';

const VARIANTS = {
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.6 } },
  slide: { initial: { opacity: 0, x: 60 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -60 }, transition: { duration: 0.5 } },
  zoom: { initial: { opacity: 0, scale: 1.08 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.98 }, transition: { duration: 0.6 } },
};

/**
 * Carrousel Hero d'un portail (Sports/Kids) — même moteur visuel (Ken Burns,
 * parallax souris, indicateurs pilule+progression) que HeroCarousel.jsx
 * (marketplace) et StoreHeroCarousel.jsx (commerce), mais consomme
 * GET /portal-hero/:portal (pas de ciblage visiteur, géré par SuperAdmin).
 * Se pose derrière le contenu existant de .portal-hero (kicker/titre/recherche,
 * voir PortalPage.jsx) — tant qu'aucun slide n'est configuré, rend `null` et
 * le dégradé CSS de marque (.portal-{portal} .portal-hero) reste seul visible.
 */
export function PortalHeroCarousel({ portal }) {
  const containerRef = useRef(null);
  const { bgX, bgY } = useHeroParallax(containerRef);
  const { slides, idx, current, loaded, pausedRef, goTo, handleDragEnd, handleCtaClick } = useHeroCarousel({
    fetchUrl: `/portal-hero/${portal}`,
    reloadKey: portal,
    impressionPath: id => `/portal-hero/${portal}/${id}/impression`,
    clickPath: id => `/portal-hero/${portal}/${id}/click`,
  });

  if (!loaded || !current) return null;

  const variant = VARIANTS[current.animation] || VARIANTS.fade;

  return (
    <div
      ref={containerRef}
      className="portal-hero-carousel"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragStart={() => { pausedRef.current = true; }}
          onDragEnd={handleDragEnd}
          initial={variant.initial}
          animate={variant.animate}
          exit={variant.exit}
          transition={variant.transition}
          className="portal-hero-carousel-slide"
        >
          <motion.div className="portal-hero-carousel-kenburns" style={{ x: bgX, y: bgY }}>
            <picture>
              {current.image_mobile && <source media="(max-width: 767px)" srcSet={ASSET(current.image_mobile)} />}
              {current.image_desktop && (
                <img src={ASSET(current.image_desktop)} alt="" loading="eager" decoding="async" />
              )}
            </picture>
          </motion.div>
          <div className="portal-hero-carousel-overlay" />

          {current.badge && <span className="portal-hero-carousel-badge">{current.badge}</span>}

          {current.cta_text && current.cta_url && (
            <button
              type="button"
              className="portal-hero-carousel-cta"
              onMouseDown={e => e.stopPropagation()}
              onClick={() => handleCtaClick(current)}
            >
              {current.cta_text} <span aria-hidden="true">→</span>
            </button>
          )}
        </motion.div>
      </AnimatePresence>

      <HeroDots slides={slides} idx={idx} goTo={goTo} />
    </div>
  );
}
