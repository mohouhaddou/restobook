import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ASSET } from '../../../api';
import { getTheme } from '../../../config/businessConfig';
import { useHeroCarousel } from '../../hooks/useHeroCarousel';
import { useHeroParallax } from '../../hooks/useHeroParallax';
import { HeroArcShape } from './HeroArcShape';
import { HeroDots } from './HeroDots';
import { heroBadgeVariants, heroTitleVariants, heroSubtitleVariants, heroButtonRowVariants, heroDiscountVariants } from './heroMotion';

const VARIANTS = {
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.6 } },
  slide: { initial: { opacity: 0, x: 60 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -60 }, transition: { duration: 0.5 } },
  zoom: { initial: { opacity: 0, scale: 1.08 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.98 }, transition: { duration: 0.6 } },
};

/**
 * Carousel Hero d'un commerce — même moteur visuel (mêmes dimensions, même
 * forme d'arc, même mécanique, mêmes animations Ken Burns/parallax/entrées
 * échelonnées) que HeroCarousel.jsx (marketplace), mais consomme
 * GET /store/hero/:organizationId (pas de ciblage visiteur), affiche la marque
 * du commerce (logo/nom) au lieu de la marque iFilino, et retombe sur les
 * couleurs du type de commerce (businessConfig.getTheme) quand un slide ne
 * personnalise pas gradient/text_color/button_color — cohérent avec le
 * thème déjà utilisé ailleurs (boucherie rouge, pharmacie vert, etc.).
 */
export function StoreHeroCarousel({ organizationId, businessType, orgName, logoUrl, fallbackCoverUrl, fallbackSubtitle, fallbackBadge, onNavigate }) {
  const containerRef = useRef(null);
  const { bgX, bgY, fgX, fgY } = useHeroParallax(containerRef);
  const { slides, idx, current, loaded, pausedRef, goTo, handleDragEnd, handleCtaClick } = useHeroCarousel({
    fetchUrl: organizationId ? `/store/hero/${organizationId}` : null,
    reloadKey: organizationId,
    impressionPath: id => `/store/hero/${organizationId}/${id}/impression`,
    clickPath: id => `/store/hero/${organizationId}/${id}/click`,
    onNavigate,
  });

  const theme = getTheme(businessType);

  // Rien de configuré — retombe sur la cover statique existante du commerce
  // (déjà uploadée via l'onglet Profil) et reproduit le bandeau logo/nom
  // minimal qui existait avant le Hero Manager, pour ne rien perdre tant que
  // le vendeur n'a pas créé son premier slide.
  if ((loaded && slides.length === 0) || !current) {
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        {fallbackCoverUrl
          ? <img src={ASSET(fallbackCoverUrl)} alt="" className="mk-hero-bg-img" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ position: 'absolute', inset: 0, background: theme.gradient }} />}
        {(logoUrl || orgName) && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', padding: '16px 20px', background: 'linear-gradient(transparent, rgba(0,0,0,.5))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {logoUrl
                ? <img src={ASSET(logoUrl)} alt="" style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', border: '3px solid #fff', boxShadow: '0 4px 14px rgba(0,0,0,.2)' }} />
                : <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>{theme.icon}</div>}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 18, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.4)' }}>{orgName}</span>
                  {fallbackBadge}
                </div>
                {fallbackSubtitle && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.85)' }}>{fallbackSubtitle}</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const variant = VARIANTS[current.animation] || VARIANTS.fade;
  const gradId = `stHeroGrad${current.id}`;
  const colorStops = [
    { offset: '0%', color: theme.secondary },
    { offset: '55%', color: theme.primary },
    { offset: '100%', color: theme.dark },
  ];

  return (
    <div
      ref={containerRef}
      className="mk-hero-root"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
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
          style={{ position: 'absolute', inset: 0, touchAction: 'pan-y' }}
        >
          <motion.div className="mk-hero-parallax-layer" style={{ position: 'absolute', inset: 0, x: bgX, y: bgY }}>
            <picture>
              {current.image_mobile && <source media="(max-width: 767px)" srcSet={ASSET(current.image_mobile)} />}
              {current.image_desktop && (
                <img
                  src={ASSET(current.image_desktop)} alt=""
                  loading="eager" decoding="async"
                  className="mk-hero-bg-img"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </picture>
          </motion.div>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent 55%, rgba(0,0,0,.12) 100%)' }} />
          {current.gradient && <div style={{ position: 'absolute', inset: 0, background: current.gradient, opacity: 0.25 }} />}

          <HeroArcShape gradId={gradId} colorStops={colorStops} />

          <motion.div className="mk-hero-parallax-layer" style={{ position: 'absolute', inset: 0, x: fgX, y: fgY, pointerEvents: 'none' }}>
            {current.discount_badge && (
              <motion.div className="mk-hero-discount" variants={heroDiscountVariants} initial="hidden" animate="visible" style={{
                position: 'absolute', borderRadius: '50%',
                background: '#DC2626', border: '3px dashed rgba(255,255,255,.6)', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', color: '#fff', textAlign: 'center',
              }}>
                <span className="mk-hero-discount-tag" style={{ fontSize: 8, fontWeight: 700, letterSpacing: .3 }}>JUSQU'À</span>
                <span className="mk-hero-discount-value" style={{ fontSize: 19, fontWeight: 900, lineHeight: 1 }}>{current.discount_badge}</span>
                {current.discount_label && <span className="mk-hero-discount-label" style={{ fontSize: 6.5, fontWeight: 600, marginTop: 2, padding: '0 5px', lineHeight: 1.15 }}>{current.discount_label.toUpperCase()}</span>}
              </motion.div>
            )}

            {current.illustration && (
              <img src={ASSET(current.illustration)} alt="" loading="lazy" className="mk-hero-illustration"
                style={{
                  position: 'absolute', top: '4%', left: '60%', maxHeight: '30%', maxWidth: '20%', objectFit: 'contain',
                  filter: 'drop-shadow(0 12px 24px rgba(0,0,0,.35))',
                }} />
            )}
          </motion.div>

          <div className="mk-hero-text-col">
            {(logoUrl || orgName) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {logoUrl && <img src={ASSET(logoUrl)} alt="" style={{ width: 34, height: 34, borderRadius: 10, objectFit: 'cover', border: '2px solid rgba(255,255,255,.5)' }} />}
                {orgName && <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{orgName}</span>}
              </div>
            )}

            {current.badge && (
              <motion.span variants={heroBadgeVariants} initial="hidden" animate="visible" style={{
                display: 'inline-block', width: 'fit-content', padding: '5px 14px', borderRadius: 20, fontSize: 11.5, fontWeight: 800,
                background: '#FFF3D6', color: '#B45309', letterSpacing: 0.2,
              }}>
                {current.badge}
              </motion.span>
            )}

            <motion.h1 variants={heroTitleVariants} initial="hidden" animate="visible" style={{
              margin: 0, fontSize: 'clamp(24px,4vw,42px)', fontWeight: 800, lineHeight: 1.08,
              color: current.text_color || '#fff', maxWidth: 480,
            }}>
              {current.title}
            </motion.h1>

            {current.subtitle && (
              <motion.p variants={heroSubtitleVariants} initial="hidden" animate="visible" style={{ margin: 0, fontSize: 'clamp(12.5px,1.6vw,15px)', color: 'rgba(255,255,255,.92)', maxWidth: 420, lineHeight: 1.4 }}>
                {current.subtitle}
              </motion.p>
            )}

            {current.cta_text && (
              <motion.div variants={heroButtonRowVariants} initial="hidden" animate="visible" style={{ marginTop: 6 }}>
                <button
                  onClick={() => handleCtaClick(current)}
                  onMouseDown={e => e.stopPropagation()}
                  className="mk-hero-cta-btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '13px 24px', borderRadius: 18, border: 'none', cursor: 'pointer',
                    fontSize: 14, fontWeight: 800, color: current.button_color ? '#fff' : theme.primary,
                    background: current.button_color || '#fff',
                    boxShadow: '0 8px 20px rgba(0,0,0,.2)',
                  }}
                >
                  {current.cta_text} <span style={{ fontSize: 17 }}>→</span>
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      <HeroDots slides={slides} idx={idx} goTo={goTo} />
    </div>
  );
}
