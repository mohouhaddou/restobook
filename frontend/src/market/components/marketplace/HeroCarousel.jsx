import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ASSET } from '../../../api';
import { BrandLogo } from '../../../components/brand/BrandLogo';
import { BRAND } from '../../../config/branding';
import { NEED_CATEGORIES } from '../../config/needCategories';
import { useHeroCarousel } from '../../../shared/hooks/useHeroCarousel';
import { useHeroParallax } from '../../../shared/hooks/useHeroParallax';
import { HeroArcShape } from './HeroArcShape';
import { HeroDots } from '../../../shared/components/hero/HeroDots';
import { heroBadgeVariants, heroTitleVariants, heroSubtitleVariants, heroButtonRowVariants, heroCardVariants, heroDiscountVariants } from './heroMotion';
import { useI18n } from '../../../i18n/config';
import { PremiumIcon } from '../../../shared/components/ui/PremiumIcon';

const CLICK_STORAGE_KEY = 'mk_hero_click';

const VARIANTS = {
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.6 } },
  slide: { initial: { opacity: 0, x: 60 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -60 }, transition: { duration: 0.5 } },
  zoom: { initial: { opacity: 0, scale: 1.08 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.98 }, transition: { duration: 0.6 } },
};

// Éléments de marque statiques (identiques sur tous les slides, jamais
// configurables par slide) — logo/tagline, argument livraison, badges de
// confiance. Copie volontairement générique (pas de prix/délai chiffré : aucune
// donnée de livraison globale réelle n'existe, chaque commerce a son propre
// délai/frais — cf. Organization.delivery_fee, jamais un chiffre unique pour
// toute la marketplace).
const TRUST_ITEMS = [
  { icon: 'shopping', labelKey: 'marketplace.hero.best_prices' },
  { icon: 'sparkles', labelKey: 'marketplace.hero.fresh_products' },
  { icon: 'shield', labelKey: 'marketplace.hero.secure_payment' },
];

function CategoryTile({ catId }) {
  const { t } = useI18n();
  const cat = NEED_CATEGORIES.find(c => c.id === catId);
  if (!cat) return null;
  const Icon = cat.icon;
  return (
    <div className="mk-hero-cat-tile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: '0 0 auto' }}>
      <div className="mk-hero-cat-icon" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--mk-orange-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mk-orange)' }}>
        <Icon size={19} />
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--mk-text)', whiteSpace: 'nowrap' }}>{t(cat.labelKey) || cat.label}</span>
    </div>
  );
}

/**
 * Carousel Hero public — consomme GET /marketplace/hero (slides déjà filtrés
 * côté serveur par fenêtre date/heure + ciblage segment/langue/connecté). Ne
 * refait aucun filtrage côté client. Auth optionnelle en fetch brut (pas
 * useApi(), qui lit le contexte staff — même pattern que LocationModal
 * dans MarketplacePage.jsx).
 */
export function HeroCarousel({ customerToken, onNavigate }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const { bgX, bgY, fgX, fgY } = useHeroParallax(containerRef);
  const { slides, idx, current, loaded, pausedRef, goTo, handleDragEnd, handleCtaClick } = useHeroCarousel({
    fetchUrl: '/marketplace/hero',
    reloadKey: customerToken,
    headers: customerToken ? { Authorization: `Bearer ${customerToken}` } : {},
    impressionPath: id => `/marketplace/hero/${id}/impression`,
    clickPath: id => `/marketplace/hero/${id}/click`,
    onNavigate,
    clickStorageKey: CLICK_STORAGE_KEY,
  });

  // Rien à afficher (aucun slide configuré) — fond dégradé neutre, pas de trou vide.
  if ((loaded && slides.length === 0) || !current) {
    return <div style={{ position: 'absolute', inset: 0, background: 'var(--mk-hero-gradient)' }} />;
  }

  const variant = VARIANTS[current.animation] || VARIANTS.fade;
  const gradId = `mkHeroGrad${current.id}`;
  const categories = Array.isArray(current.featured_category_ids) ? current.featured_category_ids.slice(0, 6) : [];

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
          {/* Fond photo — art-direction desktop/mobile distincte via <picture>, léger
              parallax + Ken Burns (transform-only, GPU-friendly). */}
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
          {/* Léger voile pour garantir le contraste du décor flottant sur la photo */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent 55%, rgba(0,0,0,.12) 100%)' }} />
          {current.gradient && <div style={{ position: 'absolute', inset: 0, background: current.gradient, opacity: 0.25 }} />}

          <HeroArcShape gradId={gradId} />

          {/* Couche "objets" (décor flottant + illustration) : parallax plus prononcé
              que le fond, pour une vraie sensation de profondeur. */}
          <motion.div className="mk-hero-parallax-layer" style={{ position: 'absolute', inset: 0, x: fgX, y: fgY, pointerEvents: 'none' }}>
            {/* Cercle de réduction — visible desktop ET mobile (repositionné/réduit via CSS
                en media query), toujours au-dessus de la photo, jamais du texte ni des
                pills d'adresse (marge verticale/horizontale dédiée par breakpoint). */}
            {current.discount_badge && (
              <motion.div className="mk-hero-discount" variants={heroDiscountVariants} initial="hidden" animate="visible" style={{
                position: 'absolute', borderRadius: '50%', pointerEvents: 'auto',
                background: '#DC2626', border: '3px dashed rgba(255,255,255,.6)', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', color: '#fff', textAlign: 'center',
              }}>
                <span className="mk-hero-discount-tag" style={{ fontSize: 8, fontWeight: 700, letterSpacing: .3 }}>{t('marketplace.hero.up_to')}</span>
                <span className="mk-hero-discount-value" style={{ fontSize: 19, fontWeight: 900, lineHeight: 1 }}>{current.discount_badge}</span>
                {current.discount_label && <span className="mk-hero-discount-label" style={{ fontSize: 6.5, fontWeight: 600, marginTop: 2, padding: '0 5px', lineHeight: 1.15 }}>{current.discount_label.toUpperCase()}</span>}
              </motion.div>
            )}

            {/* Décoration : carte "Catégories populaires" (desktop uniquement, masquée en
                media query mobile faute de place une fois le cercle de réduction gardé). */}
            <div className="mk-hero-decor">
              {categories.length > 0 && (
                <motion.div className="mk-hero-card-float" variants={heroCardVariants} initial="hidden" animate="visible" style={{
                  position: 'absolute', bottom: '8%', right: '4%', left: '4%', borderRadius: 16,
                  padding: '12px 14px', boxShadow: '0 12px 32px rgba(0,0,0,.2)', zIndex: 3, pointerEvents: 'auto',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <strong style={{ fontSize: 12.5, color: 'var(--mk-text)' }}>{t('marketplace.hero.popular_categories')}</strong>
                    <button onClick={() => navigate('/marketplace')} style={{ background: 'none', border: 'none', color: 'var(--mk-orange)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>{t('marketplace.common.seeAll')}</button>
                  </div>
                  <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
                    {categories.map(id => <CategoryTile key={id} catId={id} />)}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Casée dans l'espace libre en haut-gauche du décor : ni le cercle de
                réduction (haut-droite), ni la carte catégories (bas) — masquée
                sur mobile avec le reste du décor via la classe CSS. */}
            {current.illustration && (
              <img src={ASSET(current.illustration)} alt="" loading="lazy" className="mk-hero-illustration"
                style={{
                  position: 'absolute', top: '4%', left: '60%', maxHeight: '30%', maxWidth: '20%', objectFit: 'contain',
                  filter: 'drop-shadow(0 12px 24px rgba(0,0,0,.35))',
                }} />
            )}
          </motion.div>

          {/* Colonne texte — chaque élément apparaît avec un léger décalage de timing */}
          <div className="mk-hero-text-col">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 4 }}>
              <BrandLogo variant="full" theme="dark" size="xs" style={{ height: 30 }} />
              <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,.85)', fontWeight: 600, marginLeft: 2 }}>{BRAND.APP_TAGLINE}</span>
            </div>

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
                {current.subtitle} <span style={{ color: '#FFD972', fontWeight: 700 }}>{t('marketplace.hero.delivered_suffix')}</span>
              </motion.p>
            )}

            <motion.div variants={heroButtonRowVariants} initial="hidden" animate="visible" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              {current.cta_text && (
                <button
                  onClick={() => handleCtaClick(current)}
                  onMouseDown={e => e.stopPropagation()}
                  className="mk-hero-cta-btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '13px 24px', borderRadius: 18, border: 'none', cursor: 'pointer',
                    fontSize: 14, fontWeight: 800, color: current.button_color ? '#fff' : 'var(--mk-orange)',
                    background: current.button_color || '#fff',
                    boxShadow: '0 8px 20px rgba(0,0,0,.2)',
                  }}
                >
                  {current.cta_text} <span style={{ fontSize: 17 }}>→</span>
                </button>
              )}
              <div className="mk-hero-secondary-row mk-hero-glass-btn" style={{
                alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 14, color: '#fff',
              }}>
                <PremiumIcon name="delivery" size={20} />
                <span style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.25 }}>{t('marketplace.hero.fast_delivery').split('\n').map((line, index) => <React.Fragment key={line}>{index > 0 && <br />}{line}</React.Fragment>)}</span>
              </div>
            </motion.div>

            <div className="mk-hero-secondary-row" style={{ gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              {TRUST_ITEMS.map(item => (
                <span key={item.labelKey} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'rgba(255,255,255,.9)', fontWeight: 600 }}>
                  <PremiumIcon name={item.icon} size={15} />{t(item.labelKey)}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <HeroDots slides={slides} idx={idx} goTo={goTo} />
    </div>
  );
}
