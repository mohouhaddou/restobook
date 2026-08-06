import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ASSET } from '../../../api';
import { useCart } from '../../../contexts/CartContext';
import { ShareButton } from '../ui/ShareMenu';
import { CartConflictModal } from './CartConflictModal';
import { useI18n } from '../../../i18n/config';
import { PremiumIcon } from '../ui/PremiumIcon';

function buildProductShareUrl(p) {
  const origin = window.location.origin;
  if (p.seller_count > 1 || !p.business?.slug) return `${origin}/marketplace/search?q=${encodeURIComponent(p.name)}`;
  if (p.module === 'hanout') return `${origin}/h/${p.business.slug}?add=${p.id}`;
  if (p.module === 'pharmacie') return `${origin}/ph/${p.business.slug}`;
  // URL SEO canonique (voir backend/src/modules/seo/) — les liens partagés
  // pointent vers la forme indexée par Google plutôt que /r/:slug.
  return `${origin}/restaurants/${p.business.slug}`;
}

function fmtPrice(n) {
  return Number(n || 0).toFixed(2);
}

const AVAILABILITY_KEY = {
  in_stock: null,
  low_stock: 'marketplace.product.low_stock',
  out_of_stock: 'marketplace.product.out_of_stock',
  unknown: null,
};

/**
 * Carte produit unifiée — le PRODUIT est l'élément principal, le commerce
 * n'est qu'une métadonnée discrète (petit logo + nom), conformément à la
 * refonte "product-first". Consomme directement la forme normalisée renvoyée
 * par GET /marketplace/search (voir backend/.../productSearchService.js).
 *
 * Le bouton d'action branche par module :
 *  - resto     → ajoute directement au CartContext global (déjà branché /checkout)
 *  - hanout    → renvoie vers la boutique avec ?add=<id> (panier local de HanoutPage)
 *  - pharmacie → ajoute au panier comme resto SI le produit est OTC/parapharmacie
 *    (requires_prescription:false, déjà présent sur la forme normalisée du
 *    produit — voir productSearchService.js) ; sinon (sous ordonnance),
 *    jamais de panier, CTA "Vérifier disponibilité" (flux de demande inchangé
 *    — voir mission "ne jamais commander un médicament sous ordonnance
 *    automatiquement").
 * Un produit groupé (seller_count > 1, épicerie/pharmacie uniquement) ouvre
 * le comparateur de vendeurs au lieu d'agir directement.
 */
export function ProductCard({ product, onOpenSellers }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { cart, addItem } = useCart();
  const [added, setAdded] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const [showConflict, setShowConflict] = useState(false);

  const p = product;
  const image = !imgErr && p.images?.[0] ? ASSET(p.images[0]) : null;
  const isGrouped = p.seller_count > 1;
  const availabilityLabel = AVAILABILITY_KEY[p.availability] ? t(AVAILABILITY_KEY[p.availability]) : null;
  const disabled = p.availability === 'out_of_stock' && !isGrouped;
  const hasDiscount = p.compare_price != null && Number(p.compare_price) > Number(p.price);
  const discountPct = hasDiscount ? Math.round((1 - Number(p.price || 0) / Number(p.compare_price || 1)) * 100) : 0;

  function confirmAddToCart() {
    addItem(p.business.slug, p.business.name, { id: p.id, libelle: p.name, unit_price: p.price, image_url: p.images?.[0] || null }, 1, p.module);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
    setShowConflict(false);
  }

  function handleAction(e) {
    e.stopPropagation();
    if (disabled) return;

    if (isGrouped) { onOpenSellers?.(p); return; }

    // pharmacie sous ordonnance — jamais de panier, flux de demande existant
    if (p.module === 'pharmacie' && p.requires_prescription) {
      navigate(`/ph/${p.business.slug}`, { state: { openRequest: 'availability', medicineId: p.id } });
      return;
    }

    if (p.module === 'hanout') {
      navigate(`/h/${p.business.slug}?add=${p.id}`);
      return;
    }

    // resto, et pharmacie OTC/parapharmacie — même panier partagé
    if (cart && cart.orgSlug !== p.business.slug) {
      setShowConflict(true);
      return;
    }
    confirmAddToCart();
  }

  // Clic carte/image/nom → fiche produit unifiée (ProductDetailPage), quel que
  // soit le module — jamais la page commerce directement (voir handleAction
  // pour le comportement du bouton "Ajouter", qui lui reste inchangé). Un
  // produit groupé (plusieurs vendeurs, épicerie/pharmacie uniquement) ouvre
  // toujours le comparateur : il n'a pas d'id de produit unique à afficher.
  function handleCardClick() {
    if (isGrouped) { onOpenSellers?.(p); return; }
    navigate(`/product/${p.module}/${p.id}`);
  }

  function handleCardKeyDown(e) {
    if (e.currentTarget !== e.target) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    handleCardClick();
  }

  const actionLabel = isGrouped
    ? t('marketplace.product.stores_count', { count: p.seller_count })
    : (p.module === 'pharmacie' && p.requires_prescription) ? t('marketplace.product.check') : (added ? t('marketplace.product.added') : t('marketplace.product.add'));

  return (
    <div
      className="mk-card mk-product-card mk-fade-up"
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
      aria-label={p.name}
      style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: '100%', outlineOffset: 3 }}
    >
      <div className="mk-product-card-media" style={{ position: 'relative', width: '100%', paddingTop: '75%', background: 'var(--mk-bg)' }}>
        {image ? (
          <img src={image} alt={p.name} loading="lazy" onError={() => setImgErr(true)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, opacity: .35 }}>
            <PremiumIcon name={p.module === 'pharmacie' ? 'medicine' : p.module === 'resto' ? 'utensils' : 'shopping'} size={42} />
          </div>
        )}
        {(p.is_promo || hasDiscount) && (
          <span className="mk-product-card-badge" style={{ position: 'absolute', top: 8, insetInlineStart: 8, background: 'var(--mk-orange)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 20 }}>
            {hasDiscount ? '-' + discountPct + '%' : t('marketplace.common.promo')}
          </span>
        )}
        {p.sponsored && (
          <span style={{ position: 'absolute', top: 8, insetInlineEnd: 8, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>
            {t('marketplace.common.sponsored')}
          </span>
        )}
        {availabilityLabel && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ background: '#fff', color: '#0F172A', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>{availabilityLabel}</span>
          </div>
        )}
        <ShareButton compact title={p.name} text={t('marketplace.product.share_text', { name: p.name, price: fmtPrice(p.price) })} url={buildProductShareUrl(p)}
          style={{ position: 'absolute', bottom: 8, insetInlineEnd: 8 }} />
      </div>

      <div className="mk-product-card-body" style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
        <div className="mk-product-card-title" style={{ fontWeight: 800, fontSize: 14, color: 'var(--mk-text)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {p.name}
        </div>

        {!isGrouped && p.business && (
          <div className="mk-product-card-seller" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--mk-muted)' }}>
            {p.business.logo_url && (
              <img src={ASSET(p.business.logo_url)} alt="" style={{ width: 16, height: 16, borderRadius: 4, objectFit: 'cover', flexShrink: 0, opacity: .9 }} />
            )}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.business.name}</span>
          </div>
        )}
        {isGrouped && (
          <div style={{ fontSize: 11, color: 'var(--mk-muted)' }}>{t('marketplace.product.multiple_stores')}</div>
        )}

        {(p.distance_km != null || p.eta_range) && (
          <div className="mk-product-card-meta" style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--mk-muted)' }}>
            {p.distance_km != null && <span className="premium-inline-icon"><PremiumIcon name="mapPin" size={13} />{p.distance_km} km</span>}
            {p.eta_range && <span className="premium-inline-icon"><PremiumIcon name="clock" size={13} />{p.eta_range}</span>}
          </div>
        )}

        <div className="mk-product-card-bottom" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 'auto', paddingTop: 6 }}>
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
            {p.price_is_from && <span style={{ fontSize: 10, color: 'var(--mk-muted)' }}>{t('marketplace.common.from')}</span>}
            <span style={{ fontWeight: 900, fontSize: 17, color: 'var(--mk-text)', fontVariantNumeric: 'tabular-nums' }}>{fmtPrice(p.price)} MAD</span>
            {hasDiscount && (
              <span style={{ fontSize: 12, color: 'var(--mk-muted)', textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' }}>{fmtPrice(p.compare_price)}</span>
            )}
          </div>
          <button
            onClick={handleAction}
            disabled={disabled}
            className="mk-btn-add"
            aria-label={actionLabel}
            style={{
              minHeight: 38, padding: '8px 13px', borderRadius: 14, border: 'none', fontSize: 12, fontWeight: 800,
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: disabled ? 'var(--mk-border)' : (added ? 'var(--mk-green)' : 'var(--mk-orange)'),
              color: disabled ? 'var(--mk-muted)' : '#fff',
              whiteSpace: 'nowrap', transition: 'background .15s, transform .1s, box-shadow .15s', boxShadow: disabled ? 'none' : '0 6px 16px rgba(255, 93, 0, .18)', flexShrink: 0,
            }}
          >
            {actionLabel}
          </button>
        </div>
      </div>

      <CartConflictModal
        show={showConflict}
        currentOrgName={cart?.orgName}
        targetOrgName={p.business?.name}
        onCancel={() => setShowConflict(false)}
        onConfirm={confirmAddToCart}
      />
    </div>
  );
}
