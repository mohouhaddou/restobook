import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { API, ASSET } from '../api';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useCart } from '../contexts/CartContext';
import { BrandLogo } from '../components/brand/BrandLogo';
import { BRAND } from '../config/branding';
import { NotificationBell } from '../components/ui/NotificationBell';
import { CATEGORIES, getTypeConfig } from '../config/businessConfig';
import GlobalSearch from './marketplace/GlobalSearch';
import GamingHubPromoCard from '../modules/gaminghub/components/GamingHubPromoCard';
import { useMkTheme as useTheme } from '../shared/hooks/useMkTheme';
import { NeedCategoryRow } from '../shared/components/marketplace/NeedCategoryRow';
import { ProductSection } from '../shared/components/marketplace/ProductSection';
import { SellerCompareSheet } from '../shared/components/marketplace/SellerCompareSheet';
import { HeroCarousel } from '../shared/components/marketplace/HeroCarousel';
import { AdSlot } from '../shared/components/ads/AdSlot';
import { MarketplaceSidebar } from '../shared/components/marketplace/MarketplaceSidebar';
import { useI18n } from '../i18n/config';
import { translateBusinessType } from '../i18n/status';
import { PremiumIcon } from '../shared/components/ui/PremiumIcon';
function useFavorites() {
  const [favs, setFavs] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('mk-favs') || '[]')); } catch { return new Set(); }
  });
  const toggle = (slug) => setFavs(prev => {
    const n = new Set(prev);
    if (n.has(slug)) n.delete(slug); else n.add(slug);
    localStorage.setItem('mk-favs', JSON.stringify([...n]));
    return n;
  });
  return { isFav: s => favs.has(s), toggle };
}
function useHistory() {
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mk-hist') || '[]'); } catch { return []; }
  });
  const add = r => setHistory(prev => {
    const n = [r, ...prev.filter(x => x.slug !== r.slug)].slice(0, 8);
    localStorage.setItem('mk-hist', JSON.stringify(n));
    return n;
  });
  return { history, add };
}

/* ══ CONSTANTS ══════════════════════════════════════════════════════════ */

// Types pour le drawer de filtres — dérivés de businessConfig
const FILTER_TYPES = CATEGORIES.flatMap(cat => cat.types.map(type => ({ v: type.id, icon: type.icon, label: type.label })));
function businessIconName(type) {
  const key = type || '';
  if (key.includes('pharm')) return 'medicine';
  if (key.includes('boulanger')) return 'bakery';
  if (key.includes('cafe')) return 'cafe';
  if (key.includes('restaurant') || key.includes('snack') || key.includes('food')) return 'utensils';
  return 'store';
}

const SERVICE_ICON = {
  delivery: 'delivery',
  takeaway: 'shopping',
  reservation: 'calendar',
  qr: 'settings',
};

const DEFAULT_FILTERS = {
  type: "",
  sort: "featured",
  min_rating: "",
  delivery: "",
  fast_delivery: "",
  express_delivery: "",
  takeaway: "",
  available_today: "",
  in_stock: "",
  preorder: "",
  limited_stock: "",
  available_now: "",
  open_now: "",
  open_24h: "",
  opening_soon: "",
  reservation: "",
  qr_table: "",
  radius_km: "10",
  guard: "",
  priceMin: "",
  priceMax: "",
  brand: "",
  halal: "",
  bio: "",
  vegan: "",
  gluten_free: "",
  lactose_free: "",
  sugar_free: "",
};
const FILTER_URL_KEYS = Object.keys(DEFAULT_FILTERS);

function readInitialMarketplaceState() {
  const ps = new URLSearchParams(window.location.search);
  const filters = { ...DEFAULT_FILTERS };
  FILTER_URL_KEYS.forEach(key => {
    const value = ps.get(key);
    if (value != null) filters[key] = value;
  });
  if (ps.get("business_type")) filters.type = ps.get("business_type");
  if (ps.get("delivery") === "free") filters.delivery = "true";
  return {
    q: ps.get("q") || "",
    city: ps.get("city") || "",
    district: ps.get("district") || "",
    activeCategory: ps.get("category") || "",
    activeSection: ps.get("section") === "commerce" ? "commerce" : "products",
    filters,
  };
}
const AI_RESPONSES = [
  { k:['calme','tranquille','paisible','détente'],    f:{ sort:'rating', type:'restaurant' }, rKey:'marketplace.ai.intent.quiet' },
  { k:['végétarien','vegan','sans viande','végé'],    f:{ sort:'rating' }, rKey:'marketplace.ai.intent.vegetarian' },
  { k:['halal'],                                       f:{ sort:'rating' }, rKey:'marketplace.ai.intent.halal' },
  { k:['famille','familial','enfant','kids'],           f:{ type:'restaurant', sort:'rating' }, rKey:'marketplace.ai.intent.family' },
  { k:['romantique','couple','amoureux','dîner'],       f:{ type:'restaurant', sort:'rating' }, rKey:'marketplace.ai.intent.romantic' },
  { k:['rapide','vite','express','snack'],              f:{ type:'snack', sort:'featured' }, rKey:'marketplace.ai.intent.fast' },
  { k:['livraison','livré','domicile','commander'],    f:{ delivery:'true', sort:'rating' }, rKey:'marketplace.ai.intent.delivery' },
  { k:['café','thé','brunch','matin','petit déj'],      f:{ type:'cafe', sort:'rating' }, rKey:'marketplace.ai.intent.cafe' },
  { k:['boulangerie','pain','croissant','viennoiserie'],f:{ type:'boulangerie', sort:'rating' }, rKey:'marketplace.ai.intent.bakery' },
  { k:['pâtisserie','gâteau','dessert','sucrerie'],     f:{ type:'patisserie', sort:'rating' }, rKey:'marketplace.ai.intent.pastry' },
  { k:['hanout','épicerie','alimentation','courses'],   f:{ type:'hanout', sort:'featured' }, rKey:'marketplace.ai.intent.grocery' },
  { k:['boucherie','viande','kefta','merguez'],         f:{ type:'boucherie', sort:'rating' }, rKey:'marketplace.ai.intent.butcher' },
  { k:['cantine','déjeuner','midi','entreprise'],       f:{ sort:'rating' }, rKey:'marketplace.ai.intent.canteen' },
  { k:['bien noté','meilleur','top','excellent'],       f:{ sort:'rating', min_rating:'4' }, rKey:'marketplace.ai.intent.best' },
  { k:['nouveau','récent','découvrir','tendance'],      f:{ sort:'new' }, rKey:'marketplace.ai.intent.new' },
];

/* ══ COMPONENTS ══════════════════════════════════════════════════════════ */

function formatDist(km) {
  if (km == null) return null;
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function businessPathFor(r) {
  const mod  = r.module;
  const type = r.type || r.business_type;
  if (mod === 'hanout'    || type === 'hanout')    return `/h/${r.slug}`;
  if (mod === 'pharmacie' || type === 'pharmacie') return `/ph/${r.slug}`;
  return `/r/${r.slug}`;
}

function businessOrderLabel(r, t) {
  const type = r.type || r.business_type;
  const mod = r.module;
  if (mod === 'hanout' || type === 'hanout' || ['epicerie','boucherie','droguerie','primeur','quincaillerie','superette'].includes(type)) return t('marketplace.business.buy');
  if (type === 'pharmacie') return t('marketplace.business.availability');
  return t('marketplace.business.order');
}

function canOrderFromBusiness(r) {
  const type = r.type || r.business_type;
  const mod = r.module;
  if (r.is_unclaimed) return false;
  if (type === 'pharmacie') return true;
  if (mod === 'hanout' || type === 'hanout') return true;
  if (['epicerie','boucherie','droguerie','primeur','quincaillerie','superette'].includes(type)) return true;
  return !!(r.accepts_delivery || r.accepts_takeaway || r.accepts_qr_table);
}

function StarRating({ value, count }) {
  const { t } = useI18n();
  const rating = Number(value || 0);
  const total = Number(count || 0);
  const full = Math.min(5, Math.round(rating));
  const hasRating = rating > 0;
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:6, minHeight:26, padding:'3px 8px', borderRadius:999, background: hasRating ? 'rgba(255,247,237,.95)' : 'var(--mk-pill)', border: hasRating ? '1px solid rgba(245,158,11,.28)' : '1px solid var(--mk-border)', color:'var(--mk-text)', flexShrink:0 }}>
      <span aria-hidden="true" style={{ color: hasRating ? '#F59E0B' : '#CBD5E1', fontSize:12, letterSpacing:0 }}>{'★'.repeat(hasRating ? full : 1)}{hasRating ? '☆'.repeat(5 - full) : ''}</span>
      {hasRating ? (
        <strong style={{ fontSize:12, fontWeight:900, fontVariantNumeric:'tabular-nums' }}>{rating.toFixed(1)}</strong>
      ) : (
        <span style={{ fontSize:11, color:'var(--mk-muted)', fontWeight:800 }}>{t('marketplace.common.new')}</span>
      )}
      {total > 0 && <span style={{ fontSize:11, color:'var(--mk-muted)', fontWeight:700 }}>{total} avis</span>}
    </div>
  );
}

function BusinessCardActions({ r }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const type = r.type || r.business_type;
  const isPharmacy = type === 'pharmacie' || r.module === 'pharmacie';
  const isShop = r.module === 'hanout' || type === 'hanout' || ['epicerie','boucherie','droguerie','primeur','quincaillerie','superette'].includes(type);
  const stop = e => e.stopPropagation();
  const go = (e, path, state) => { stop(e); navigate(path, state ? { state } : undefined); };
  const actionStyle = { flex:'1 1 112px', minWidth:96, minHeight:44, textAlign:'center', padding:'10px 12px', borderRadius:10, border:'1.5px solid var(--mk-border)', background:'var(--mk-surface)', color:'var(--mk-text)', fontSize:12, fontWeight:800, textDecoration:'none', cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5, lineHeight:1.15 };
  const primaryStyle = { ...actionStyle, border:'1.5px solid #BBF7D0', background:'#F0FDF4', color:'#15803D' };
  const orderLabel = businessOrderLabel(r, t);
  const actionsAvailable = r.phone || (r.latitude && r.longitude) || canOrderFromBusiness(r) || (!isPharmacy && !isShop && r.accepts_reservation) || (isPharmacy && r.accepts_prescription_upload !== false);
  if (!actionsAvailable) return null;

  return (
    <div className="mk-business-actions" style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:2 }}>
      {r.phone && (
        <a href={`tel:${r.phone}`} onClick={stop} style={primaryStyle} aria-label={t('marketplace.business.call_aria', { name: r.name })}>
          <PremiumIcon name="phone" size={15} /> {t('marketplace.business.call')}
        </a>
      )}
      {canOrderFromBusiness(r) && (
        <button type="button" onClick={e => go(e, businessPathFor(r), isPharmacy ? { openRequest: 'availability' } : undefined)} style={r.phone ? actionStyle : primaryStyle}>
          <PremiumIcon name={isPharmacy ? 'search' : 'cart'} size={15} /> {orderLabel}
        </button>
      )}
      {!isPharmacy && !isShop && r.accepts_reservation && (
        <button type="button" onClick={e => go(e, `/r/${r.slug}/reserve`)} style={actionStyle}>
          <PremiumIcon name="calendar" size={15} /> {t('marketplace.business.reserve')}
        </button>
      )}
      {isPharmacy && r.accepts_prescription_upload !== false && (
        <button type="button" onClick={e => go(e, `/ph/${r.slug}`, { openRequest: 'prescription' })} style={actionStyle}>
          <PremiumIcon name="package" size={15} /> {t('marketplace.business.prescription')}
        </button>
      )}
      {r.latitude && r.longitude && (
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${r.latitude},${r.longitude}`} target="_blank" rel="noopener noreferrer" onClick={stop} style={actionStyle} aria-label={t('marketplace.business.directions_aria', { name: r.name })}>
          <PremiumIcon name="directions" size={15} /> {t('marketplace.business.directions')}
        </a>
      )}
    </div>
  );
}

function RestaurantCard({ r, isFav, onFav, onClick, selected = false, delay = 0 }) {
  const { t } = useI18n();
  const [favAnim, setFavAnim] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const tc = getTypeConfig(r.type);
  const typeColor = tc.color;
  const isOpen = r.is_open;
  const services = [
    r.accepts_delivery    && { icon:'delivery', label: r.delivery_fee > 0 ? `${r.delivery_fee} MAD` : t('marketplace.business.free_delivery') },
    r.accepts_takeaway    && { icon:'takeaway', label:t('marketplace.business.takeaway') },
    r.accepts_reservation && { icon:'reservation', label:t('marketplace.business.reservation') },
    r.accepts_qr_table    && { icon:'qr', label:'QR Table' },
  ].filter(Boolean).slice(0,3);

  function handleFav(e) {
    e.stopPropagation();
    setFavAnim(true); onFav(r.slug);
    setTimeout(() => setFavAnim(false), 600);
  }

  function handleCardKeyDown(e) {
    if (e.currentTarget !== e.target) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onClick?.();
  }

  return (
    <div className={`mk-card mk-business-card mk-fade-up${selected ? ' is-selected' : ''}`} style={{ '--type-color': typeColor, position:'relative', display:'flex', flexDirection:'column', animationDelay:`${delay}s` }} onClick={onClick} onKeyDown={handleCardKeyDown} role="button" tabIndex={0} aria-label={r.name} aria-current={selected ? 'true' : undefined}>

      {/* Bande couleur du type de commerce — repère visuel rapide (resto/hanout/
          café/pharmacie...), .mk-card a déjà overflow:hidden + border-radius
          donc les coins hauts se calent automatiquement sur ceux de la carte. */}
      <div style={{ height:5, background:typeColor, flexShrink:0 }} />

      {/* Logo overlay — sorti du conteneur Image (overflow:hidden) et
          positionné directement par rapport à la carte (position:relative
          ajouté ci-dessus) : sinon la moitié basse du logo, censée déborder
          sur la zone de contenu, se retrouvait rognée par ce overflow:hidden
          (cf. capture — juste un fin croissant de logo visible). */}
      {r.logo_url && (
        <img src={ASSET(r.logo_url)} alt="" style={{ position:'absolute', top:173, insetInlineStart:14, width:48, height:48, borderRadius:14, objectFit:'cover', border:'3px solid var(--mk-card)', boxShadow:'0 4px 12px rgba(0,0,0,.2)', zIndex:3 }} />
      )}

      {/* ── Image ── */}
      <div style={{ position:'relative', flexShrink:0, overflow:'hidden', height:196 }}>
        {r.cover_url && !imgErr
          ? <img src={ASSET(r.cover_url)} alt={r.name} onError={()=>setImgErr(true)}
              style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', transition:'transform .45s ease' }}
              className="mk-card-img" />
          : <div style={{ width:'100%', height:'100%', background:`linear-gradient(145deg,${typeColor}28,${typeColor}55)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <PremiumIcon name={businessIconName(r.type)} size={54} style={{ color: typeColor, filter:'drop-shadow(0 2px 8px rgba(0,0,0,.12))' }} />
            </div>
        }

        {/* Gradient bas */}
        <div style={{ position:'absolute', bottom:0, insetInlineStart:0, insetInlineEnd:0, height:80, background:'linear-gradient(transparent,rgba(0,0,0,.55)', pointerEvents:'none', zIndex:1 }} />

        {/* Badges haut gauche */}
        <div style={{ position:'absolute', top:10, insetInlineStart:10, display:'flex', gap:4 }}>
          {r.is_unclaimed && (
            <span style={{ background:'rgba(255,255,255,.94)', color:'#374151', fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:20, backdropFilter:'blur(4px)' }}>{t('marketplace.business.informative')}</span>
          )}
          {r.is_featured && (
            <span style={{ background:'linear-gradient(135deg,#FF8A00,#FF5D00)', color:'#fff', fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20, backdropFilter:'blur(4px)' }}><PremiumIcon name="star" size={12} /> {t('marketplace.business.popular')}</span>
          )}
          {r.avg_rating >= 4.5 && r.total_reviews >= 5 && (
            <span style={{ background:'rgba(22,163,74,.9)', color:'#fff', fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20 }}><PremiumIcon name="award" size={12} /> {t('marketplace.business.top')}</span>
          )}
        </div>

        {/* Statut + favori haut droite */}
        <div style={{ position:'absolute', top:10, insetInlineEnd:10, display:'flex', gap:6, alignItems:'center' }}>
          {r.type === 'pharmacie' && r.guard_active && <span style={{ background:'rgba(22,163,74,.96)', color:'#fff', fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:20, letterSpacing:'.02em' }}><PremiumIcon name="shield" size={12} /> {t('marketplace.business.on_guard')}</span>}
          {!(r.type === 'pharmacie' && r.guard_active) && isOpen === true  && <span style={{ background:'rgba(220,252,231,.96)', color:'#15803D', fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:20, letterSpacing:'.02em' }}>● {t('marketplace.business.open')}</span>}
          {!(r.type === 'pharmacie' && r.guard_active) && isOpen === false && <span style={{ background:'rgba(254,226,226,.96)', color:'#DC2626', fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:20, letterSpacing:'.02em' }}>● {t('marketplace.business.closed')}</span>}
          <button onClick={handleFav} aria-label={isFav(r.slug)?t('marketplace.favorites.remove'):t('marketplace.favorites.add')}
            style={{ width:34, height:34, borderRadius:'50%', border:'none', background:'rgba(255,255,255,.9)', cursor:'pointer', display:'grid', placeItems:'center', fontSize:16, animation:favAnim?'mk-heartPop .6s':'none', boxShadow:'0 2px 10px rgba(0,0,0,.18)', flexShrink:0, backdropFilter:'blur(4px)' }}>
            <PremiumIcon name="heart" size={17} style={{ fill: isFav(r.slug) ? '#EF4444' : 'none', color: isFav(r.slug) ? '#EF4444' : '#334155' }} />
          </button>
        </div>

        {/* Type badge + infos bas (sur l'image) — remonté au-dessus du logo
            quand il y en a un (le logo déborde de 28px dans l'image, bottom:-20
            à +28 — sans ce décalage les deux se chevauchent, cf. capture). */}
        <div style={{ position:'absolute', bottom: r.logo_url ? 34 : 10, insetInlineStart:12, insetInlineEnd:12, display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:8, zIndex:2 }}>
          <span style={{ background:typeColor, color:'#fff', fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20, backdropFilter:'blur(4px)', flexShrink:0 }}>
            <PremiumIcon name={businessIconName(r.type)} size={12} /> {translateBusinessType(t, r.type, tc.label)}
          </span>
          {r.avg_prep_time > 0 && (
            <span style={{ background:'rgba(0,0,0,.55)', color:'#fff', fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20, backdropFilter:'blur(4px)', flexShrink:0 }}><PremiumIcon name="clock" size={12} /> ~{r.avg_prep_time} min</span>
          )}
        </div>

      </div>

      {/* ── Contenu ── */}
      <div style={{ padding: r.logo_url ? '28px 14px 14px' : '14px', flex:1, display:'flex', flexDirection:'column', gap:8 }}>
        {/* Nom + cuisine */}
        <div>
          <div style={{ fontWeight:800, fontSize:15, color:'var(--mk-text)', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical', letterSpacing:'-.2px' }}>{r.name}</div>
          {r.cuisine_type && <div style={{ fontSize:12, color:'var(--mk-muted)', marginTop:2 }}>{r.cuisine_type}</div>}
        </div>

        {/* Rating + distance */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
          <StarRating value={r.avg_rating} count={r.total_reviews} />
          {r.distance_km != null ? (
            <span style={{ fontSize:11, fontWeight:700, color:'var(--mk-orange)', background:'var(--mk-orange-light)', padding:'2px 8px', borderRadius:20, flexShrink:0 }}><PremiumIcon name="mapPin" size={12} /> {formatDist(r.distance_km)}</span>
          ) : (r.city || r.district) ? (
            <span style={{ fontSize:11, color:'var(--mk-muted)', flexShrink:0 }}><PremiumIcon name="mapPin" size={12} /> {r.district || r.city}</span>
          ) : null}
        </div>

        {/* Services */}
        {services.length > 0 && (
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            {services.map((s,i) => (
              <span key={i} style={{ fontSize:11, color:'var(--mk-muted)', background:'var(--mk-pill)', padding:'3px 9px', borderRadius:20 }}><PremiumIcon name={SERVICE_ICON[s.icon] || 'store'} size={12} /> {s.label}</span>
            ))}
          </div>
        )}

        {r.is_unclaimed && (
          <div style={{ fontSize:11, color:'var(--mk-muted)', background:'var(--mk-pill)', padding:'6px 8px', borderRadius:8, lineHeight:1.35 }}>
            {t('marketplace.business.unclaimed_source')}
          </div>
        )}

        {/* Actions rapides contextuelles */}
        <BusinessCardActions r={r} />
      </div>
    </div>
  );
}


function RestaurantListItem({ r, isFav, onFav, onClick, onHover, selected = false }) {
  const { t } = useI18n();
  const [imgErr, setImgErr] = useState(false);
  const tc = getTypeConfig(r.type);
  const typeColor = tc.color;
  const services = [
    r.accepts_delivery && { label: r.delivery_fee > 0 ? `${r.delivery_fee} MAD` : t('marketplace.business.free_delivery') },
    r.accepts_takeaway && { label: t('marketplace.business.takeaway') },
    r.accepts_reservation && { label: t('marketplace.business.reservation') },
    r.accepts_qr_table && { label: 'QR table' },
  ].filter(Boolean).slice(0, 3);

  function handleFav(e) {
    e.stopPropagation();
    onFav(r.slug);
  }

  return (
    <article
      className={`mk-business-list-item${selected ? ' is-selected' : ''}`}
      onClick={onClick}
      aria-current={selected ? 'true' : undefined}
      onMouseEnter={() => onHover?.(r.slug)}
      onMouseLeave={() => onHover?.(null)}
      style={{ '--type-color': typeColor }}
    >
      <div className="mk-business-list-media">
        {r.cover_url && !imgErr ? (
          <img src={ASSET(r.cover_url)} alt={r.name} loading="lazy" onError={() => setImgErr(true)} />
        ) : (
          <div className="mk-business-list-fallback"><PremiumIcon name={businessIconName(r.type)} size={30} /></div>
        )}
        {r.logo_url && <img className="mk-business-list-logo" src={ASSET(r.logo_url)} alt="" loading="lazy" />}
      </div>

      <div className="mk-business-list-body">
        <div className="mk-business-list-topline">
          <span className="mk-business-list-type"><PremiumIcon name={businessIconName(r.type)} size={13} /> {translateBusinessType(t, r.type, tc.label)}</span>
          {r.distance_km != null && <span className="mk-business-list-distance"><PremiumIcon name="mapPin" size={12} /> {formatDist(r.distance_km)}</span>}
        </div>
        <div className="mk-business-list-title-row">
          <div>
            <h3>{r.name}</h3>
            <p>{r.cuisine_type || r.district || r.city || t('marketplace.business.ifilino_store')}</p>
          </div>
          <button type="button" className="mk-business-list-fav" onClick={handleFav} aria-label={isFav(r.slug) ? t('marketplace.favorites.remove') : t('marketplace.favorites.add')}>
            <PremiumIcon name="heart" size={17} style={{ fill: isFav(r.slug) ? '#EF4444' : 'none', color: isFav(r.slug) ? '#EF4444' : 'currentColor' }} />
          </button>
        </div>
        <div className="mk-business-list-meta">
          <StarRating value={r.avg_rating} count={r.total_reviews} />
          {r.is_open === true && <span className="mk-business-list-open">{t('marketplace.business.open')}</span>}
          {r.is_open === false && <span className="mk-business-list-closed">{t('marketplace.business.closed')}</span>}
          {r.avg_prep_time > 0 && <span>~{r.avg_prep_time} min</span>}
        </div>
        {services.length > 0 && (
          <div className="mk-business-list-services">
            {services.map((service, index) => <span key={index}>{service.label}</span>)}
          </div>
        )}
        <BusinessCardActions r={r} />
      </div>
    </article>
  );
}

function CardSkeleton() {
  return (
    <div style={{ background:'var(--mk-card)', borderRadius:18, overflow:'hidden', border:'1px solid var(--mk-border)' }}>
      <div className="mk-skeleton" style={{ height:196, borderRadius:0 }} />
      <div style={{ padding:14, display:'flex', flexDirection:'column', gap:10 }}>
        <div className="mk-skeleton" style={{ height:15, width:'72%' }} />
        <div className="mk-skeleton" style={{ height:12, width:'40%' }} />
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div className="mk-skeleton" style={{ height:14, width:90 }} />
          <div className="mk-skeleton" style={{ height:22, width:64, borderRadius:20 }} />
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <div className="mk-skeleton" style={{ height:24, width:80, borderRadius:20 }} />
          <div className="mk-skeleton" style={{ height:24, width:68, borderRadius:20 }} />
        </div>
      </div>
    </div>
  );
}


function SectionCarousel({ title, titleKey, icon = 'store', restaurants, isFav, onFav, onCard, onSeeAll }) {
  const { t } = useI18n();
  const INITIAL_VISIBLE = 4;
  const STEP_VISIBLE = 4;
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  if (!restaurants?.length) return null;

  const visibleRestaurants = restaurants.slice(0, visibleCount);
  const hasHidden = visibleCount < restaurants.length;
  const canShowAll = !hasHidden && !!onSeeAll;

  function showMore() {
    setVisibleCount(count => Math.min(count + STEP_VISIBLE, restaurants.length));
  }

  return (
    <section className="mk-section-grid-block" style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--mk-text)", display: "flex", alignItems: "center", gap: 8 }}>
          <PremiumIcon name={icon} size={22} />{titleKey ? t(titleKey) : title}
        </h2>
      </div>

      <div className="mk-section-grid">
        {visibleRestaurants.map((r, i) => (
          <RestaurantCard key={r.id || r.slug} r={r} isFav={isFav} onFav={onFav} onClick={() => onCard(r)} delay={i * 0.04} />
        ))}
      </div>

      {(hasHidden || canShowAll) && (
        <div className="mk-section-more-row">
          <button type="button" className="mk-section-more-btn" onClick={hasHidden ? showMore : onSeeAll}>
            {hasHidden ? t("marketplace.common.showMore") : t("marketplace.common.seeAll")}
          </button>
        </div>
      )}
    </section>
  );
}

// Bulle de cluster — dégradé orange iFilino (cohérent avec les pins goutte
// individuels), remplace le rond bleu par défaut de leaflet.markercluster.
function clusterIcon(cluster) {
  const count = cluster.getChildCount();
  const size = count < 10 ? 36 : count < 100 ? 44 : 52;
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,#FF8A00,#FF5D00);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${count<100?14:12}px;box-shadow:0 4px 14px rgba(255,138,0,.45);border:3px solid #fff">${count}</div>`,
    className: '',
    iconSize: [size, size],
  });
}

function MkMap({ restaurants, theme, selectedSlug, onSelect, userPos, onAreaSearch, onMapError, recenterKey }) {
  const { t } = useI18n();
  const ref = useRef(null);
  const mapRef = useRef(null);
  const clusterRef = useRef(null);
  const mksRef = useRef({});
  const userMkRef = useRef(null);
  const userInteractingRef = useRef(false);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    try {
      const center = userPos ? [userPos.lat, userPos.lng] : [33.5731, -7.5898];
      const map = L.map(ref.current, { center, zoom:12 });

      const streetLayer = L.tileLayer(
        theme === 'dark'
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { attribution:'© CARTO © OpenStreetMap', maxZoom:19 }
      ).addTo(map);
      const satelliteLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution:'© Esri, Maxar, Earthstar Geographics', maxZoom:19 }
      );
      L.control.layers({ 'Plan': streetLayer, 'Satellite': satelliteLayer }, null, { position:'topright' }).addTo(map);
      L.control.scale({ metric:true, imperial:false, position:'bottomleft' }).addTo(map);

      const clusterGroup = L.markerClusterGroup({ maxClusterRadius:60, spiderfyOnMaxZoom:true, showCoverageOnHover:false, iconCreateFunction:clusterIcon });
      clusterGroup.addTo(map);
      clusterRef.current = clusterGroup;

      if (userPos) {
        userMkRef.current = L.circleMarker([userPos.lat,userPos.lng], { radius:10, color:'#3B82F6', fillColor:'#3B82F6', fillOpacity:1, weight:3 }).addTo(map).bindPopup(t('marketplace.location.your_position'));
      }
      map.on('dragstart zoomstart', () => { userInteractingRef.current = true; });
      map.on('moveend', () => {
        if (userInteractingRef.current && onAreaSearch) {
          const c = map.getCenter();
          onAreaSearch({ lat: c.lat, lng: c.lng });
        }
        userInteractingRef.current = false;
      });
      mapRef.current = map;
    } catch {
      onMapError?.();
    }
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; clusterRef.current = null; mksRef.current = {}; } };
  }, []);

  // Recentrer la carte (sans déclencher "rechercher dans cette zone") quand l'adresse change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPos) return;
    map.setView([userPos.lat, userPos.lng], map.getZoom() < 12 ? 13 : map.getZoom());
    if (userMkRef.current) userMkRef.current.setLatLng([userPos.lat, userPos.lng]);
    else userMkRef.current = L.circleMarker([userPos.lat,userPos.lng], { radius:10, color:'#3B82F6', fillColor:'#3B82F6', fillOpacity:1, weight:3 }).addTo(map).bindPopup(t('marketplace.location.your_position'));
  }, [recenterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;
    cluster.clearLayers();
    mksRef.current = {};
    restaurants.forEach(r => {
      if (!r.latitude || !r.longitude) return;
      const tc = getTypeConfig(r.type);
      const sel = r.slug === selectedSlug;
      const isPharmacy = r.module === 'pharmacie' || r.type === 'pharmacie';
      const onGuard = isPharmacy && r.guard_active;
      const pinColor = onGuard ? '#DC2626' : sel ? '#FF8A00' : tc.color;
      const icon = L.divIcon({ className:'', html:`
        <div style="position:relative;">
          <div style="background:${pinColor};color:#fff;font-size:16px;width:38px;height:38px;border-radius:50% 50% 50% 4px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.3);transform:rotate(-45deg);border:2.5px solid #fff">
            <span style="transform:rotate(45deg)">${tc.icon}</span>
          </div>
          ${onGuard ? `<div style="position:absolute;top:-9px;right:-14px;background:#DC2626;color:#fff;font-size:8px;font-weight:800;padding:2px 5px;border-radius:8px;border:1.5px solid #fff;white-space:nowrap">GARDE</div>` : ''}
        </div>`, iconSize:[38,38], iconAnchor:[19,38] });
      const statusChip = onGuard
        ? `<span style="font-size:10px;margin-left:auto;padding:2px 8px;border-radius:20px;background:#FEE2E2;color:#DC2626;font-weight:700">${t('marketplace.business.on_guard')}</span>`
        : `<span style="font-size:10px;margin-left:auto;padding:2px 8px;border-radius:20px;background:${r.is_open?'#F0FDF4':'#FEF2F2'};color:${r.is_open?'#16A34A':'#DC2626'};font-weight:700">● ${r.is_open?t('marketplace.business.open'):t('marketplace.business.closed')}</span>`;
      const popup = L.popup({ className:'mk-popup', closeButton:false, offset:[0,-6] }).setContent(`<div style="border-radius:14px;overflow:hidden;min-width:200px;font-family:Inter,sans-serif">${r.cover_url?`<img src="${ASSET(r.cover_url)}" style="width:100%;height:110px;object-fit:cover">`:`<div style="height:80px;background:linear-gradient(135deg,${tc.color}22,${tc.color}44);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:${tc.color}">${translateBusinessType(t, r.type, tc.label)}</div>`}<div style="padding:12px"><div style="font-weight:700;font-size:14px;color:#1E1E1E;margin-bottom:4px">${r.name}</div><div style="display:flex;align-items:center;gap:6px;margin-bottom:8px"><span style="color:#F59E0B;font-size:11px">${'★'.repeat(Math.round(r.avg_rating))}${'☆'.repeat(5-Math.round(r.avg_rating))}</span><span style="font-size:12px;font-weight:600;color:#374151">${r.avg_rating>0?r.avg_rating.toFixed(1):'—'}</span>${statusChip}</div><button onclick="window.__mkGoTo('${r.slug}','${r.type}','${r.module||''}')" style="width:100%;padding:9px;background:linear-gradient(135deg,${tc.color},${tc.dark});color:#fff;border:none;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer">${t('marketplace.map.view_shop')}</button></div></div>`);
      const mk = L.marker([r.latitude,r.longitude], { icon }).bindPopup(popup);
      mk.on('click', () => onSelect(r.slug));
      mksRef.current[r.slug] = mk;
      cluster.addLayer(mk);
    });
  }, [restaurants, selectedSlug, theme]);

  // Cadrer automatiquement la carte sur TOUS les commerces affichés (+ la
  // position de l'utilisateur si connue) — la position étant désormais
  // obligatoire (voir "Localisation d'abord"), un simple centrage sur
  // userPos à zoom fixe (12) ne suffit plus : le rayon de recherche peut
  // aller jusqu'à 50km, et des résultats bien réels (pharmacies, cafés...)
  // se retrouvaient hors champ, donc invisibles sans zoom arrière manuel —
  // pas un filtrage par type, juste un cadrage qui ne les couvrait pas.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pts = restaurants.filter(r => r.latitude && r.longitude).map(r => [r.latitude, r.longitude]);
    if (userPos) pts.push([userPos.lat, userPos.lng]);
    if (pts.length === 0) return;
    if (pts.length === 1) map.setView(pts[0], 14);
    else map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
  }, [restaurants, userPos]);

  return <div ref={ref} style={{ width:'100%', height:'100%', borderRadius:16 }} />;
}

function FiltersDrawer({ open, onClose, filters, onChange, district, onDistrict }) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:500, backdropFilter:'blur(4px)', animation:'mk-fadeIn .2s' }} />
      <div style={{ position:'fixed', top:0, right:0, bottom:0, width:Math.min(420,window.innerWidth-24), background:'var(--mk-surface)', zIndex:501, boxShadow:'-8px 0 40px rgba(0,0,0,.2)', padding:24, overflowY:'auto', animation:'mk-slideIn .25s cubic-bezier(.4,0,.2,1)', display:'flex', flexDirection:'column', gap:24 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--mk-text)' }}>{t('marketplace.filters.advanced')}</h3>
          <button onClick={onClose} style={{ background:'var(--mk-pill)', border:'none', borderRadius:10, width:36, height:36, cursor:'pointer', fontSize:16, color:'var(--mk-muted)' }}>✕</button>
        </div>

        <div>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--mk-muted)', marginBottom:10 }}>{t('marketplace.filters.district')}</div>
          <input value={district} onChange={e => onDistrict(e.target.value)} placeholder={t('marketplace.filters.district_placeholder')} style={{ width:'100%', padding:'10px 14px', border:'1.5px solid var(--mk-border)', borderRadius:12, background:'var(--mk-input-bg)', color:'var(--mk-text)', fontSize:13, outline:'none', boxSizing:'border-box' }} />
        </div>

        <div>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--mk-muted)', marginBottom:10 }}>{t('marketplace.filters.business_type')}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {[{ v:'', l:t('marketplace.common.all') }, ...FILTER_TYPES].map(({ v, l }) => (
              <button key={v} onClick={() => onChange('type', v)} className={`mk-pill${filters.type===v?' active':''}`}>{l}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--mk-muted)', marginBottom:10 }}>{t('marketplace.filters.sort')}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {[{v:'featured',l:t('marketplace.filters.popular')},{v:'rating',l:t('marketplace.filters.rating')},{v:'new',l:t('marketplace.filters.new')}] .map(({v,l}) => (
              <button key={v} onClick={() => onChange('sort', v)} className={`mk-pill${filters.sort===v?' active':''}`}>{l}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--mk-muted)', marginBottom:10 }}>{t('marketplace.filters.min_rating')}</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {[{v:'',l:t('marketplace.common.all_feminine')},{v:'3',l:'3★+'},{v:'4',l:'4★+'},{v:'4.5',l:'4.5★+'}].map(({v,l}) => (
              <button key={v} onClick={() => onChange('min_rating', v)} className={`mk-pill${filters.min_rating===v?' active':''}`}>{l}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--mk-muted)', marginBottom:10 }}>{t('marketplace.filters.services')}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              {k:'delivery',    l:t('marketplace.filters.delivery_home')},
              {k:'takeaway',    l:t('marketplace.filters.takeaway')},
              {k:'reservation', l:t('marketplace.filters.online_reservation')},
              {k:'qr_table',    l:t('marketplace.filters.qr_order')},
              {k:'open_now',    l:t('marketplace.filters.open_now')},
            ].map(({k,l}) => (
              <label key={k} style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer', padding:'12px 14px', borderRadius:12, border:`1.5px solid ${filters[k]==='true'?'var(--mk-orange)':'var(--mk-border)'}`, background:filters[k]==='true'?'var(--mk-orange-light)':'transparent', transition:'all .15s' }}>
                <input type="checkbox" checked={filters[k]==='true'} onChange={e => onChange(k, e.target.checked?'true':'')} style={{ accentColor:'var(--mk-orange)', width:16, height:16 }} />
                <span style={{ fontSize:14, fontWeight:600, color:'var(--mk-text)' }}>{l}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:'auto', paddingTop:16, borderTop:'1px solid var(--mk-border)' }}>
          <button onClick={() => { onChange('__reset'); onClose(); }} style={{ flex:1, padding:'13px', border:'1.5px solid var(--mk-border)', borderRadius:12, background:'transparent', cursor:'pointer', color:'var(--mk-muted)', fontWeight:600, fontSize:14 }}>{t('marketplace.common.reset')}</button>
          <button onClick={onClose} style={{ flex:2, padding:'13px', background:'var(--mk-orange)', border:'none', borderRadius:12, cursor:'pointer', color:'#fff', fontWeight:700, fontSize:14 }}>{t('marketplace.filters.view_results')}</button>
        </div>
      </div>
    </>
  );
}

function AIAssistant({ open, onClose, restaurants, onApply }) {
  const { t } = useI18n();
  const [msg, setMsg] = useState('');
  const [chat, setChat] = useState([{ role:'bot', text:t('marketplace.ai.initial') }]);

  function sendMsg() {
    if (!msg.trim()) return;
    const userMsg = msg.trim(); setMsg('');
    setChat(p => [...p, { role:'user', text: userMsg }]);
    const lower = userMsg.toLowerCase();
    const matched = AI_RESPONSES.find(intent => intent.k.some(kw => lower.includes(kw)));
    setTimeout(() => {
      if (matched) {
        const cnt = restaurants.length;
        setChat(p => [...p, { role:'bot', text:`${t(matched.rKey)}\n\n${t('marketplace.ai.found', { count: cnt })}`, action: matched.f }]);
      } else if (['merci','ok','super','parfait','top'].some(w => lower.includes(w))) {
        setChat(p => [...p, { role:'bot', text:t('marketplace.ai.thanks') }]);
      } else {
        setChat(p => [...p, { role:'bot', text:t('marketplace.ai.default'), action:{ sort:'rating', min_rating:'4' } }]);
      }
    }, 500);
  }

  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:500, backdropFilter:'blur(4px)', animation:'mk-fadeIn .2s' }} />
      <div style={{ position:'fixed', bottom:24, insetInlineEnd:24, width:Math.min(380,window.innerWidth-32), background:'var(--mk-surface)', borderRadius:20, zIndex:501, boxShadow:'0 20px 60px rgba(0,0,0,.25)', display:'flex', flexDirection:'column', maxHeight:'76vh', animation:'mk-fadeUp .3s', border:'1px solid var(--mk-border)' }}>
        <div style={{ padding:'16px 18px', borderBottom:'1px solid var(--mk-border)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:12, background:'linear-gradient(135deg,#7C3AED,#4F46E5)', display:'grid', placeItems:'center', color:'#fff' }}><PremiumIcon name="sparkles" size={19} /></div>
          <div>
            <div style={{ fontWeight:700, color:'var(--mk-text)', fontSize:14 }}>{t('marketplace.ai.title')}</div>
            <div style={{ fontSize:11, color:'var(--mk-green)', fontWeight:600 }}>● {t('marketplace.ai.online')}</div>
          </div>
          <button onClick={onClose} style={{ marginInlineStart:'auto', background:'none', border:'none', color:'var(--mk-muted)', cursor:'pointer', fontSize:18 }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }} className="mk-scroll">
          {chat.map((m,i) => (
            <div key={i} style={{ display:'flex', flexDirection:m.role==='user'?'row-reverse':'row', gap:8 }}>
              {m.role==='bot' && <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#7C3AED,#4F46E5)', display:'grid', placeItems:'center', flexShrink:0, color:'#fff' }}><PremiumIcon name="sparkles" size={14} /></div>}
              <div style={{ maxWidth:'78%', padding:'10px 14px', borderRadius:m.role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px', background:m.role==='user'?'var(--mk-orange)':'var(--mk-pill)', color:m.role==='user'?'#fff':'var(--mk-text)', fontSize:13, lineHeight:1.5, whiteSpace:'pre-line' }}>
                {m.text}
                {m.action && <button onClick={() => { onApply(m.action); onClose(); }} style={{ display:'block', marginTop:8, width:'100%', padding:'8px', background:'var(--mk-orange)', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:12 }}>{t('marketplace.ai.apply')}</button>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:'12px 14px', borderTop:'1px solid var(--mk-border)', display:'flex', gap:8 }}>
          <input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMsg()} placeholder={t('marketplace.ai.placeholder')} style={{ flex:1, padding:'10px 14px', border:'1.5px solid var(--mk-border)', borderRadius:12, background:'var(--mk-input-bg)', color:'var(--mk-text)', fontSize:13, outline:'none' }} />
          <button onClick={sendMsg} style={{ padding:'10px 14px', background:'var(--mk-orange)', border:'none', borderRadius:12, color:'#fff', cursor:'pointer', fontWeight:700, fontSize:13 }}>→</button>
        </div>
      </div>
    </>
  );
}

function LocationModal({ open, mandatory, onClose, onConfirm, customerToken }) {
  const { t } = useI18n();
  const [addrQuery, setAddrQuery] = useState('');
  const [addrResults, setAddrResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState('');
  const debRef = useRef(null);

  useEffect(() => {
    if (open && customerToken) {
      fetch(API('/marketplace/me/addresses'), { headers: { Authorization: `Bearer ${customerToken}` } })
        .then(r => r.json()).then(d => setSavedAddresses(d.addresses || [])).catch(() => {});
    }
  }, [open, customerToken]);

  function searchAddr(text) {
    setAddrQuery(text);
    clearTimeout(debRef.current);
    if (text.trim().length < 3) { setAddrResults([]); return; }
    debRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(API(`/marketplace/geocode?q=${encodeURIComponent(text.trim())}`));
        const data = await res.json();
        setAddrResults(Array.isArray(data) ? data.slice(0, 5) : []);
      } catch { setAddrResults([]); }
      setSearching(false);
    }, 400);
  }

  function confirmFrom(a) { onConfirm(a); setError(''); }

  function useGPS() {
    if (!navigator.geolocation) { setError(t('marketplace.location.unsupported')); return; }
    setGeoLoading(true); setError('');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const res = await fetch(API(`/marketplace/geocode?lat=${lat}&lon=${lng}`));
          const data = await res.json();
          const a = data.address || {};
          const city = a.city || a.town || a.village || '';
          const short = a.road ? `${a.house_number ? a.house_number + ' ' : ''}${a.road}` : (data.display_name || t('marketplace.location.current_position'));
          confirmFrom({ lat, lng, address: short, city, formatted_address: data.display_name || short });
        } catch {
          confirmFrom({ lat, lng, address: t('marketplace.location.current_position'), city: '', formatted_address: t('marketplace.location.current_position') });
        }
        setGeoLoading(false);
      },
      () => { setGeoLoading(false); setError(t('marketplace.location.denied')); },
      { timeout: 8000, maximumAge: 300000 }
    );
  }

  function pickResult(item) {
    const a = item.address || {};
    const city = a.city || a.town || a.village || '';
    const short = a.road ? `${a.house_number ? a.house_number + ' ' : ''}${a.road}` : (item.display_name || '');
    confirmFrom({ lat: parseFloat(item.lat), lng: parseFloat(item.lon), address: short, city, formatted_address: item.display_name || short });
  }

  const [savedLoading, setSavedLoading] = useState(null);
  async function pickSaved(addr) {
    const text = [addr.street, addr.city].filter(Boolean).join(', ');
    setSavedLoading(addr.id); setError('');
    try {
      const res = await fetch(API(`/marketplace/geocode?q=${encodeURIComponent(text)}`));
      const data = await res.json();
      const item = Array.isArray(data) ? data[0] : null;
      if (!item) { setError(t('marketplace.location.not_found')); setSavedLoading(null); return; }
      confirmFrom({ lat: parseFloat(item.lat), lng: parseFloat(item.lon), address: addr.label || addr.street, city: addr.city || '', formatted_address: text });
    } catch { setError(t('marketplace.location.geocode_error')); }
    setSavedLoading(null);
  }

  if (!open) return null;
  return (
    <>
      <div onClick={mandatory ? undefined : onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', zIndex: 900, backdropFilter: 'blur(4px)', animation: 'mk-fadeIn .2s' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(440px, calc(100vw - 32px))', maxHeight: '86vh', overflowY: 'auto', background: 'var(--mk-surface)', borderRadius: 22, zIndex: 901, boxShadow: '0 24px 70px rgba(0,0,0,.35)', padding: 'clamp(20px,4vw,28px)', display: 'flex', flexDirection: 'column', gap: 16 }} className="mk-scroll">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ marginBottom: 6, color:'var(--mk-orange)' }}><PremiumIcon name="mapPin" size={30} /></div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--mk-text)' }}>{t('marketplace.location.title')}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--mk-muted)' }}>{t('marketplace.location.subtitle')}</p>
          </div>
          {!mandatory && <button onClick={onClose} style={{ background: 'var(--mk-pill)', border: 'none', borderRadius: 10, width: 32, height: 32, cursor: 'pointer', fontSize: 14, color: 'var(--mk-muted)', flexShrink: 0 }}>✕</button>}
        </div>

        <button onClick={useGPS} disabled={geoLoading} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#FF8A00,#FF5D00)', color: '#fff', cursor: geoLoading ? 'default' : 'pointer', fontWeight: 700, fontSize: 14, boxShadow: '0 6px 18px rgba(255,138,0,.3)' }}>
          {geoLoading
            ? <span className="mk-spin" style={{ display: 'inline-block', width: 16, height: 16, border: '2.5px solid rgba(255,255,255,.5)', borderTopColor: '#fff', borderRadius: '50%' }} />
            : <PremiumIcon name="locate" size={18} />}
          {t('marketplace.location.use_current')}
        </button>

        <div>
          <input value={addrQuery} onChange={e => searchAddr(e.target.value)} placeholder={t('marketplace.location.input_placeholder')}
            style={{ width: '100%', padding: '12px 14px', border: '1.5px solid var(--mk-border)', borderRadius: 14, background: 'var(--mk-input-bg)', color: 'var(--mk-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          {searching && <div style={{ fontSize: 12, color: 'var(--mk-muted)', marginTop: 6 }}>{t('marketplace.location.searching')}</div>}
          {addrResults.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {addrResults.map((item, i) => (
                <button key={i} onClick={() => pickResult(item)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--mk-border)', background: 'var(--mk-surface)', cursor: 'pointer', fontSize: 12.5, color: 'var(--mk-text)' }}>
                  <span className="premium-inline-icon"><PremiumIcon name="mapPin" size={14} /> {item.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {savedAddresses.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--mk-muted)', marginBottom: 8 }}>{t('marketplace.location.saved')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {savedAddresses.map(addr => (
                <button key={addr.id} onClick={() => pickSaved(addr)} disabled={savedLoading === addr.id} style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--mk-border)', background: 'var(--mk-surface)', cursor: savedLoading === addr.id ? 'default' : 'pointer', fontSize: 12.5, color: 'var(--mk-text)' }}>
                  {savedLoading === addr.id ? <span className="mk-spin" /> : <PremiumIcon name="home" size={15} />} <span>{addr.label ? `${addr.label} — ` : ''}{addr.street}{addr.city ? `, ${addr.city}` : ''}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <div style={{ fontSize: 12.5, color: '#DC2626', background: '#FEF2F2', padding: '10px 12px', borderRadius: 10 }}>{error}</div>}

      </div>
    </>
  );
}

/* ══ MAIN PAGE ══════════════════════════════════════════════════════════ */

export default function MarketplacePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user: customerUser, token: customerToken } = useCustomerAuth();
  const { cart, itemCount } = useCart();
  // Le panier partagé peut porter un module hanout ou resto (voir CartContext) —
  // /checkout ne gère que le moteur resto, un panier hanout renvoie donc vers
  // la boutique (où le tiroir panier gère sa propre commande/paiement).
  const goToCart = () => {
    if (cart?.module === 'hanout') navigate(`/h/${cart.orgSlug}`);
    else navigate('/checkout');
  };
  const [theme, toggleTheme] = useTheme();
  const { isFav, toggle: toggleFav } = useFavorites();
  const { history: browseHistory, add: addToHistory } = useHistory();
  const initialStateRef = useRef(null);
  if (!initialStateRef.current) initialStateRef.current = readInitialMarketplaceState();

  const [q, setQ] = useState(initialStateRef.current.q);
  const [city, setCity] = useState(initialStateRef.current.city);
  const [district, setDistrict] = useState(initialStateRef.current.district);
  const [filters, setFilters] = useState(initialStateRef.current.filters);
  const [showFilters, setShowFilters] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [activeMarketplaceSection, setActiveMarketplaceSection] = useState(initialStateRef.current.activeSection);
  const [productPreset, setProductPreset] = useState("all");
  const [view, setView] = useState(() => window.innerWidth >= 1024 ? 'map' : 'grid');
  const [commerceView, setCommerceView] = useState(() => localStorage.getItem('mk-commerce-view') || 'grid');
  const [mapSelectedSlug, setMapSelectedSlug] = useState(null);

  const [restaurants, setRestaurants] = useState([]);
  // Référence stable tant que `restaurants` ne change pas vraiment — un
  // .filter() inline recréait un nouveau tableau à CHAQUE rendu du parent
  // (survol, favoris...), ce qui redéclenchait l'effet de cadrage de MkMap
  // en boucle et annulait tout zoom manuel de l'utilisateur ("zoom verrouillé").
  const mapRestaurants = useMemo(() => restaurants.filter(r => r.latitude && r.longitude), [restaurants]);
  const [allLoaded, setAllLoaded] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [sectionPop, setSectionPop]   = useState([]);
  const [sectionNew, setSectionNew]   = useState([]);
  const [sectionTop, setSectionTop]   = useState([]);
  const [sectLoading, setSectLoading] = useState(true);

  const [userPos, setUserPos]       = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);

  // ── Localisation d'abord ────────────────────────────────────────────────
  const [address, setAddress] = useState(() => { try { return JSON.parse(localStorage.getItem('mk-location') || 'null'); } catch { return null; } });
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState(initialStateRef.current.activeCategory);
  const [typeCounts, setTypeCounts] = useState({});
  const [hoveredSlug, setHoveredSlug] = useState(null);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [searchAreaCenter, setSearchAreaCenter] = useState(null);
  const [showSearchArea, setShowSearchArea] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [compareProduct, setCompareProduct] = useState(null);
  const mapSectionRef = useRef(null);
  const gridSectionRef = useRef(null);
  const cardRefs = useRef({});

  useEffect(() => {
    if (address) {
      setUserPos({ lat: address.lat, lng: address.lng });
      if (address.city) setCity(address.city);
      setFilters(prev => ({ ...prev, sort: 'distance' }));
    } else {
      setShowLocationModal(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    const ps = new URLSearchParams();
    if (q.trim()) ps.set("q", q.trim());
    if (city.trim()) ps.set("city", city.trim());
    if (district.trim()) ps.set("district", district.trim());
    if (activeCategory) ps.set("category", activeCategory);
    if (activeMarketplaceSection === 'commerce') ps.set('section', 'commerce');
    FILTER_URL_KEYS.forEach(key => {
      const value = filters[key];
      if (value && value !== DEFAULT_FILTERS[key]) ps.set(key, value);
    });
    const next = ps.toString();
    const url = `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  }, [q, city, district, filters, activeCategory, activeMarketplaceSection]);

  function handleLocationConfirm(loc) {
    setShowLocationModal(false);
    setAddress(loc);
    localStorage.setItem('mk-location', JSON.stringify(loc));
    setUserPos({ lat: loc.lat, lng: loc.lng });
    setCity(loc.city || '');
    setSearchAreaCenter(null); setShowSearchArea(false);
    setFilters(prev => ({ ...prev, sort: 'distance' }));
  }

  function searchThisArea(center) {
    setUserPos(center);
    setSearchAreaCenter(center);
    setShowSearchArea(false);
    setFilters(prev => ({ ...prev, sort: 'distance' }));
  }

  useEffect(() => {
    if (activeMarketplaceSection !== 'commerce') { setTypeCounts({}); return; }
    const ps = new URLSearchParams();
    if (userPos) { ps.set('lat', userPos.lat); ps.set('lng', userPos.lng); ps.set('radius', filters.radius_km || '10'); }
    if (q.trim())    ps.set('q', q.trim());
    if (city.trim()) ps.set('city', city.trim());
    fetch(API(`/marketplace/categories?${ps}`))
      .then(r => r.json())
      .then(d => {
        const m = {};
        for (const c of (d.categories || [])) m[c.value] = c.count;
        setTypeCounts(m);
      })
      .catch(() => {});
  }, [activeMarketplaceSection, userPos, filters.radius_km, q, city]);

  const catCounts = useMemo(() => {
    const m = {};
    for (const [typeId, count] of Object.entries(typeCounts)) {
      const catId = getTypeConfig(typeId).category?.id;
      if (catId) m[catId] = (m[catId] || 0) + count;
    }
    return m;
  }, [typeCounts]);

  const debRef = useRef(null);

  const buildQS = useCallback((p=1) => {
    const ps = new URLSearchParams({ page:p, limit:12 });
    if (q.trim())                     ps.set('q', q.trim());
    if (city.trim())                  ps.set('city', city.trim());
    if (district.trim())              ps.set('district', district.trim());
    if (filters.type) {
      ps.set('business_type', filters.type);
    } else if (activeCategory) {
      const cat = CATEGORIES.find(c => c.id === activeCategory);
      if (cat) ps.set('category', cat.module);
    }
    if (filters.min_rating)           ps.set('min_rating', filters.min_rating);
    if (filters.delivery==='true')    ps.set('delivery', 'true');
    if (filters.takeaway==='true')    ps.set('takeaway', 'true');
    if (filters.reservation==='true') ps.set('reservation', 'true');
    if (filters.qr_table==='true')    ps.set('qr_table', 'true');
    if (filters.fast_delivery==='true') ps.set('max_eta', '20');
    if (filters.priceMin)             ps.set('price_min', filters.priceMin);
    if (filters.priceMax)             ps.set('price_max', filters.priceMax);
    if (filters.brand)                ps.set('brand', filters.brand);
    if (filters.open_now==='true')    ps.set('open_now', 'true');
    if (filters.guard==='true')       ps.set('guard', 'true');
    if (filters.open_24h==='true')    ps.set('open_24h', 'true');
    if (userPos) {
      ps.set('lat', userPos.lat);
      ps.set('lng', userPos.lng);
      ps.set('radius_km', filters.radius_km || '10');
      ps.set('sort', 'distance');
    } else if (filters.sort) {
      ps.set('sort', filters.sort);
    }
    return ps.toString();
  }, [q, city, district, filters, userPos, activeCategory]);

  async function load(p=1, append=false) {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const res  = await fetch(API(`/marketplace/businesses?${buildQS(p)}`));
      const data = await res.json();
      const biz  = data.businesses||[];
      if (append) {
        setAllLoaded(prev => [...prev, ...biz]);
        setRestaurants(prev => [...prev, ...biz]);
      } else {
        setAllLoaded(biz);
        setRestaurants(biz);
      }
      setTotal(data.total||0); setPages(data.pages||1); setPage(p);
    } catch { if (!append) { setRestaurants([]); setAllLoaded([]); } }
    if (append) setLoadingMore(false); else setLoading(false);
  }

  useEffect(() => {
    if (activeMarketplaceSection !== 'commerce') { setLoading(false); return; }
    if (!userPos) { setLoading(false); return; }
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => load(1), 300);
    return () => clearTimeout(debRef.current);
  }, [q, city, district, filters, activeCategory, userPos, activeMarketplaceSection]);

  useEffect(() => {
    if (activeMarketplaceSection !== 'commerce') { setSectLoading(false); return; }
    if (!userPos) { setSectLoading(false); return; }
    const nearQS = `lat=${userPos.lat}&lng=${userPos.lng}&radius_km=${filters.radius_km || '10'}`;
    setSectLoading(true);
    Promise.all([
      fetch(API(`/marketplace/businesses?sort=featured&limit=8&${nearQS}`)).then(r=>r.json()),
      fetch(API(`/marketplace/businesses?sort=new&limit=8&${nearQS}`)).then(r=>r.json()),
      fetch(API(`/marketplace/businesses?sort=rating&min_rating=4&limit=8&${nearQS}`)).then(r=>r.json()),
    ]).then(([pop,nw,top]) => {
      setSectionPop(pop.businesses||[]); setSectionNew(nw.businesses||[]); setSectionTop(top.businesses||[]);
    }).catch(()=>{}).finally(() => setSectLoading(false));
  }, [userPos, filters.radius_km, activeMarketplaceSection]);

  function handleFilterChange(key, val) {
    if (key==='__reset') { setFilters({ ...DEFAULT_FILTERS }); setUserPos(null); setDistrict(''); setActiveCategory(''); return; }
    setFilters(prev => ({ ...prev, [key]: val }));
  }

  function handleCategoryTab(catId) {
    setActiveCategory(prev => prev === catId ? '' : catId);
    setFilters(prev => ({ ...prev, type: '', guard: '' }));
  }

  function handleHorizontalRailWheel(e) {
    const el = e.currentTarget;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!delta) return;
    e.preventDefault();
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }
  function bizPath(r) { return businessPathFor(r); }
  function handleCardClick(r) { addToHistory(r); navigate(bizPath(r)); }

  function handleHeroNavigate(slide) {
    if (!slide?.cta_url) return;
    if (slide.cta_type === 'external_url') window.open(slide.cta_url, '_blank', 'noopener');
    else navigate(slide.cta_url);
  }

  function detectLocation() {
    if (!navigator.geolocation) { setLocationError(t('marketplace.location.unsupported')); return; }
    setGeoLoading(true); setLocationError('');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude:lat, longitude:lng } = pos.coords;
        setUserPos({ lat, lng });
        setCity('');
        try {
          const res  = await fetch(API(`/marketplace/geocode?lat=${lat}&lon=${lng}`));
          const data = await res.json();
          const a    = data.address || {};
          const c    = a.city||a.town||a.village||'';
          if (c) setCity(c);
          const short = a.road ? `${a.house_number?a.house_number+' ':''}${a.road}` : (data.display_name||t('marketplace.location.current_position'));
          const loc = { lat, lng, address: short, city: c, formatted_address: data.display_name||short };
          setAddress(loc); localStorage.setItem('mk-location', JSON.stringify(loc));
        } catch {}
        setFilters(prev => ({ ...prev, sort:'distance' }));
        setGeoLoading(false);
      },
      () => { setGeoLoading(false); setLocationError(t('marketplace.location.denied_short')); },
      { timeout:8000, maximumAge:300000 }
    );
  }

  function changeLocation() {
    setShowLocationModal(true);
  }

  window.__mkGoTo = (slug, type, mod) => navigate((mod === 'hanout' || type === 'hanout') ? `/h/${slug}` : (mod === 'pharmacie' || type === 'pharmacie') ? `/ph/${slug}` : `/r/${slug}`);

  const hasActive = filters.type || activeCategory || filters.min_rating || filters.delivery==='true' || filters.open_now==='true' || district || userPos;

  function changeCommerceView(nextView) {
    setCommerceView(nextView);
    localStorage.setItem('mk-commerce-view', nextView);
  }

  const productFilterPresets = [
    { key: 'all', labelKey: 'marketplace.product_filters.all', hintKey: 'marketplace.product_filters.all_hint', query: null, href: null, titleKey: null },
    { key: 'promo', labelKey: 'marketplace.product_filters.promo', hintKey: 'marketplace.product_filters.promo_hint', query: { sort: 'promo' }, href: '/marketplace/search?sort=promo', titleKey: 'marketplace.products.promo' },
    { key: 'popular', labelKey: 'marketplace.product_filters.popular', hintKey: 'marketplace.product_filters.popular_hint', query: { sort: 'popular' }, href: '/marketplace/search?sort=popular', titleKey: 'marketplace.products.top' },
    { key: 'fast', labelKey: 'marketplace.product_filters.fast', hintKey: 'marketplace.product_filters.fast_hint', query: { sort: 'new', max_eta: 20 }, href: '/marketplace/search?sort=new&max_eta=20', titleKey: 'marketplace.products.fast_delivery' },
    { key: 'meals', labelKey: 'marketplace.product_filters.meals', hintKey: 'marketplace.product_filters.meals_hint', query: { sort: 'popular', need_category: 'repas' }, href: '/marketplace/search?sort=popular&need_category=repas', titleKey: 'marketplace.products.meals' },
    { key: 'daily', labelKey: 'marketplace.product_filters.daily', hintKey: 'marketplace.product_filters.daily_hint', query: { need_category: 'laitiers' }, href: '/marketplace/search?need_category=laitiers', titleKey: 'marketplace.products.daily' },
    { key: 'butcher', labelKey: 'marketplace.product_filters.butcher', hintKey: 'marketplace.product_filters.butcher_hint', query: { need_category: 'viandes' }, href: '/marketplace/search?need_category=viandes', titleKey: 'marketplace.products.butcher' },
    { key: 'bakery', labelKey: 'marketplace.product_filters.bakery', hintKey: 'marketplace.product_filters.bakery_hint', query: { need_category: 'boulangerie' }, href: '/marketplace/search?need_category=boulangerie', titleKey: 'marketplace.products.bakery' },
  ];
  const selectedProductPreset = productFilterPresets.find(p => p.key === productPreset) || productFilterPresets[0];

  return (
    <div className={`mk-wrap mk-${theme}`} style={{ minHeight:'100vh', background:'var(--mk-bg)', transition:'background .3s' }}>

      {/* ── NAVBAR ── */}
      <nav style={{ position:'sticky', top:0, zIndex:300, background:theme==='dark'?'rgba(7,13,26,.92)':'rgba(255,255,255,.92)', backdropFilter:'blur(16px)', borderBottom:'1px solid var(--mk-border)', padding:'0 clamp(12px,4vw,40px)', display:'flex', alignItems:'center', gap:8, height:72 }}>
        {/* Logo : full sur tablette/desktop, icon sur mobile */}
        <div onClick={() => navigate('/marketplace')} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', flexShrink:0 }}>
          <BrandLogo variant="full" theme={theme} size="xs" style={{ height:72 }} />
        </div>

        <div className="mk-nav-location">
          <button type="button" className="mk-nav-location-main" onClick={() => setShowLocationModal(true)}>
            <span className="mk-nav-location-pin"><PremiumIcon name="mapPin" size={18} /></span>
            <span className="mk-nav-location-copy">
              <strong>{address ? (address.address || address.city || t('marketplace.location.selected')) : t('marketplace.location.choose')}</strong>
              <small>{userPos ? t('marketplace.location.radius', { radius: filters.radius_km || '10' }) : t('marketplace.location.near_offers')}</small>
            </span>
          </button>
          <button type="button" className="mk-nav-locate" onClick={detectLocation} disabled={geoLoading} aria-label={t('marketplace.location.use_current')}>
            {geoLoading ? <span className="mk-spin" /> : '⌖'}
          </button>
          {userPos && (
            <div className="mk-nav-radius" aria-label={t('marketplace.location.radius', { radius: filters.radius_km || '10' })}>
              {['2','5','10','20'].map(r => (
                <button key={r} type="button" className={(filters.radius_km || '10') === r ? 'is-active' : ''} onClick={() => setFilters(prev => ({ ...prev, radius_km: r }))}>{r} km</button>
              ))}
            </div>
          )}
        </div>

        {/* Actions desktop (cachées sur mobile → bottom bar) */}
        <div className="mk-nav-act" style={{ display:'flex', gap:6, flexShrink:0, marginInlineStart:'auto' }}>
          <button onClick={()=>navigate('/play')} style={{ padding:'8px 12px', borderRadius:10, border:'1.5px solid var(--mk-border)', background:'transparent', color:'var(--mk-text)', cursor:'pointer', fontSize:13, fontWeight:700, flexShrink:0, whiteSpace:'nowrap' }}>🎮 Jouer</button>
          <button onClick={()=>navigate('/discover')} style={{ padding:'8px 12px', borderRadius:10, border:'1.5px solid var(--mk-border)', background:'transparent', color:'var(--mk-text)', cursor:'pointer', fontSize:13, fontWeight:700, flexShrink:0, whiteSpace:'nowrap' }}>Discover</button>
          <button onClick={()=>navigate('/gaming')} style={{ padding:'8px 12px', borderRadius:10, border:'1.5px solid var(--mk-border)', background:'transparent', color:'var(--mk-text)', cursor:'pointer', fontSize:13, fontWeight:700, flexShrink:0, whiteSpace:'nowrap' }}>🎮 Gaming Hub</button>
          <button onClick={()=>setShowAI(v=>!v)} title={t('marketplace.ai.title')} style={{ width:36, height:36, borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,rgba(124,58,237,.15),rgba(79,70,229,.15))', color:'#7C3AED', fontSize:17, display:'grid', placeItems:'center', flexShrink:0 }}><PremiumIcon name="sparkles" size={18} /></button>
          <button onClick={toggleTheme} style={{ width:36, height:36, borderRadius:10, border:'none', cursor:'pointer', background:'var(--mk-pill)', color:'var(--mk-text)', fontSize:15, display:'grid', placeItems:'center', flexShrink:0 }}><PremiumIcon name={theme === 'dark' ? 'sun' : 'moon'} size={17} /></button>
          {customerToken && <NotificationBell token={customerToken} theme={theme} onNavigate={url => navigate(url)} />}
          {itemCount>0 && (
            <button onClick={goToCart} style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 12px', borderRadius:10, border:'none', background:'var(--mk-orange)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700, boxShadow:'0 4px 14px rgba(234,88,12,.3)', flexShrink:0 }}>
              <PremiumIcon name="cart" size={16} /> <span>{itemCount}</span>
            </button>
          )}
          {customerUser
            ? <button onClick={()=>navigate('/dashboard')} style={{ padding:'8px 12px', borderRadius:10, border:'1.5px solid var(--mk-border)', background:'transparent', color:'var(--mk-text)', cursor:'pointer', fontSize:13, fontWeight:600, flexShrink:0, whiteSpace:'nowrap', overflow:'hidden', maxWidth:120, textOverflow:'ellipsis' }}><PremiumIcon name="user" size={15} /> {(customerUser.nom||'').split(' ')[0]}</button>
            : <button onClick={()=>navigate('/account')} style={{ padding:'8px 12px', borderRadius:10, border:'1.5px solid var(--mk-border)', background:'transparent', color:'var(--mk-text)', cursor:'pointer', fontSize:13, fontWeight:600, flexShrink:0, whiteSpace:'nowrap' }}>{t('marketplace.nav.login')}</button>
          }
        </div>
        {/* Thème seul — visible sur mobile dans la navbar (reste des actions → bottom bar) */}
        <button onClick={()=>navigate('/play')} className="mk-nav-magazine-mobile" style={{ minHeight:36, padding:'0 12px', borderRadius:10, border:'1.5px solid var(--mk-border)', background:'transparent', color:'var(--mk-text)', cursor:'pointer', fontSize:12, fontWeight:800, display:'none', alignItems:'center', flexShrink:0, marginInlineStart:'auto' }}>🎮</button>
        <button onClick={()=>navigate('/discover')} className="mk-nav-magazine-mobile" style={{ minHeight:36, padding:'0 12px', borderRadius:10, border:'1.5px solid var(--mk-border)', background:'transparent', color:'var(--mk-text)', cursor:'pointer', fontSize:12, fontWeight:800, display:'none', alignItems:'center', flexShrink:0, marginInlineStart:8 }}>{t('marketplace.nav.magazine')}</button>
        <button onClick={()=>navigate('/gaming')} className="mk-nav-magazine-mobile" style={{ minHeight:36, padding:'0 12px', borderRadius:10, border:'1.5px solid var(--mk-border)', background:'transparent', color:'var(--mk-text)', cursor:'pointer', fontSize:12, fontWeight:800, display:'none', alignItems:'center', flexShrink:0, marginInlineStart:8 }}>🎮 Gaming</button>
        <button onClick={toggleTheme} className="mk-nav-theme-mobile" style={{ width:36, height:36, borderRadius:10, border:'none', cursor:'pointer', background:'var(--mk-pill)', color:'var(--mk-text)', fontSize:15, display:'none', placeItems:'center', flexShrink:0 }}><PremiumIcon name={theme === 'dark' ? 'sun' : 'moon'} size={17} /></button>
      </nav>

      {userPos && (
        <div className="mk-mobile-radius-bar" aria-label={t('marketplace.location.radius', { radius: filters.radius_km || '10' })}>
          <span>{t('marketplace.sidebar.distance')}</span>
          {['2','5','10','20','50'].map(r => (
            <button key={r} type="button" className={(filters.radius_km || '10') === r ? 'is-active' : ''} onClick={() => setFilters(prev => ({ ...prev, radius_km: r }))}>
              {r} km
            </button>
          ))}
        </div>
      )}

      {/* ── HERO ── */}
      <div className="mk-hero" style={{ position:'relative', height:'clamp(420px,62vh,680px)', overflow:'hidden' }}>
        <HeroCarousel customerToken={customerToken} onNavigate={handleHeroNavigate} />

      </div>

      <div style={{ maxWidth: 1300, margin: '16px auto 0', padding: '0 clamp(14px,4vw,40px)' }}>
        <AdSlot placement="below_header" platform="marketplace" />
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth:1300, margin:'0 auto', padding:'28px clamp(14px,4vw,40px) 80px' }}>

        {/* ── GlobalSearch ── remontée pour flotter entre le Hero et le contenu */}
        <div style={{ marginTop: -15, marginBottom: 24, position: 'relative', zIndex: 5 }}>
          <GlobalSearch userPos={userPos} radiusKm={filters.radius_km || '10'} />
        </div>

        <GamingHubPromoCard />

        <section className="mk-marketplace-section-switch" aria-label={t("marketplace.sections.choose")}>
          <button type="button" className={activeMarketplaceSection === "products" ? "is-active" : ""} onClick={() => setActiveMarketplaceSection("products")}>
            <strong>{t("marketplace.sections.products")}</strong>
            <span>{t("marketplace.sections.products_hint")}</span>
          </button>
          <button type="button" className={activeMarketplaceSection === "commerce" ? "is-active" : ""} onClick={() => setActiveMarketplaceSection("commerce")}>
            <strong>{t("marketplace.sections.businesses")}</strong>
            <span>{t("marketplace.sections.businesses_hint")}</span>
          </button>
        </section>

        {activeMarketplaceSection === "products" && (
          <div className="mk-product-mode-layout">
            <aside className="mk-product-filter-sidebar" aria-label={t("marketplace.product_filters.title")}>
              <div className="mk-product-filter-head">
                <span>{t("marketplace.product_filters.kicker")}</span>
                <strong>{t("marketplace.product_filters.title")}</strong>
              </div>
              <div className="mk-product-filter-list">
                {productFilterPresets.map(preset => (
                  <button
                    key={preset.key}
                    type="button"
                    className={productPreset === preset.key ? "is-active" : ""}
                    onClick={() => setProductPreset(preset.key)}
                  >
                    <strong>{t(preset.labelKey)}</strong>
                    <span>{t(preset.hintKey)}</span>
                  </button>
                ))}
              </div>
            </aside>

            <main className="mk-product-mode-content">
              {productPreset === "all" ? (
                <>
                  <NeedCategoryRow
                    active={null}
                    onSelect={(id) => id && navigate(`/marketplace/search?need_category=${id}`)}
                  />

                  <ProductSection titleKey="marketplace.products.promo" fetchQuery={{ sort: 'promo' }} seeAllHref="/marketplace/search?sort=promo" onOpenSellers={setCompareProduct} userPos={userPos} radiusKm={filters.radius_km || '10'} />
                  <ProductSection titleKey="marketplace.products.top" fetchQuery={{ sort: 'popular' }} seeAllHref="/marketplace/search?sort=popular" onOpenSellers={setCompareProduct} userPos={userPos} radiusKm={filters.radius_km || '10'} />
                  <ProductSection titleKey="marketplace.business.new_places" fetchQuery={{ sort: 'new' }} seeAllHref="/marketplace/search?sort=new" onOpenSellers={setCompareProduct} userPos={userPos} radiusKm={filters.radius_km || '10'} />
                  <ProductSection titleKey="marketplace.products.fast_delivery" fetchQuery={{ sort: 'new', max_eta: 20 }} seeAllHref="/marketplace/search?sort=new&max_eta=20" onOpenSellers={setCompareProduct} userPos={userPos} radiusKm={filters.radius_km || '10'} />
                  <ProductSection titleKey="marketplace.products.daily" fetchQuery={{ need_category: 'laitiers' }} seeAllHref="/marketplace/search?need_category=laitiers" onOpenSellers={setCompareProduct} userPos={userPos} radiusKm={filters.radius_km || '10'} />
                  <ProductSection titleKey="marketplace.products.meals" fetchQuery={{ sort: 'popular', need_category: 'repas' }} seeAllHref="/marketplace/search?sort=popular&need_category=repas" onOpenSellers={setCompareProduct} userPos={userPos} radiusKm={filters.radius_km || '10'} />
                  <ProductSection titleKey="marketplace.products.butcher" fetchQuery={{ need_category: 'viandes' }} seeAllHref="/marketplace/search?need_category=viandes" onOpenSellers={setCompareProduct} userPos={userPos} radiusKm={filters.radius_km || '10'} />
                  <ProductSection titleKey="marketplace.products.bakery" fetchQuery={{ need_category: 'boulangerie' }} seeAllHref="/marketplace/search?need_category=boulangerie" onOpenSellers={setCompareProduct} userPos={userPos} radiusKm={filters.radius_km || '10'} />
                </>
              ) : (
                <ProductSection
                  key={selectedProductPreset.key}
                  titleKey={selectedProductPreset.titleKey}
                  fetchQuery={selectedProductPreset.query}
                  seeAllHref={selectedProductPreset.href}
                  onOpenSellers={setCompareProduct}
                  userPos={userPos}
                  radiusKm={filters.radius_km || '10'}
                />
              )}
            </main>
          </div>
        )}

        {activeMarketplaceSection === "commerce" && (
          <>
        {locationError && (
          <div style={{ fontSize:12.5, color:'#DC2626', background:'#FEF2F2', padding:'10px 14px', borderRadius:10, marginBottom:16 }}><PremiumIcon name="alert" size={15} /> {locationError}</div>
        )}

        <div className="mk-explorer-layout">
          <MarketplaceSidebar
            mode="marketplace"
            filters={filters}
            onChange={handleFilterChange}
            query={q}
            onQueryChange={setQ}
            district={district}
            onDistrict={setDistrict}
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryTab}
            typeCounts={typeCounts}
            catCounts={catCounts}
            total={total}
          />
          <main className="mk-explorer-main">

        {/* ── Filtres catégories au-dessus de la carte ── */}
        <section className="mk-map-filter-panel" aria-label={t('marketplace.business.map_category_filter')}>
          <div className="mk-map-filter-head">
            <div>
              <span>{t('marketplace.business.nearby_businesses')}</span>
              <strong>{activeCategory ? translateBusinessType(t, activeCategory, CATEGORIES.find(c => c.id === activeCategory)?.label) : t('marketplace.business.all_categories')}</strong>
            </div>
            <button
              type="button"
              className={!activeCategory && !filters.type ? 'is-active' : ''}
              onClick={() => { setActiveCategory(''); setFilters(p => ({ ...p, type: '', guard: '' })); }}
            >
              {t('marketplace.common.all')}
              <em>{Object.values(catCounts).reduce((sum, value) => sum + Number(value || 0), 0) || total}</em>
            </button>
          </div>

          <div className="mk-map-category-strip mk-scroll" onWheel={handleHorizontalRailWheel}>
            {CATEGORIES.map(cat => {
              const active = activeCategory === cat.id;
              const c0 = cat.types[0];
              const cnt = catCounts[cat.id] || 0;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={active ? 'is-active' : ''}
                  style={{ '--cat-color': c0?.color || '#64748B', '--cat-soft': c0?.light || 'var(--mk-pill)' }}
                  onClick={() => handleCategoryTab(cat.id)}
                >
                  <span className="mk-map-category-icon">{cat.icon}</span>
                  <span className="mk-map-category-text">
                    <strong>{translateBusinessType(t, cat.id, cat.label)}</strong>
                    <small>{t('marketplace.business.category_count', { count: cnt })}</small>
                  </span>
                </button>
              );
            })}
          </div>

          {activeCategory && (() => {
            const cat = CATEGORIES.find(c => c.id === activeCategory);
            if (!cat) return null;
            return (
              <div className="mk-map-subfilter-strip mk-scroll" onWheel={handleHorizontalRailWheel}>
                <button
                  type="button"
                  className={!filters.type ? 'is-active' : ''}
                  onClick={() => setFilters(p => ({ ...p, type: '', guard: '' }))}
                >
                  {t('marketplace.business.all_category', { category: translateBusinessType(t, cat.id, cat.label).toLowerCase() })}
                </button>
                {cat.types.map(type => {
                  const active = filters.type === type.id;
                  const cnt = typeCounts[type.id] || 0;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      className={active ? 'is-active' : ''}
                      style={{ '--type-color': type.color, '--type-soft': type.light }}
                      onClick={() => setFilters(p => ({ ...p, type: p.type === type.id ? '' : type.id, guard: '' }))}
                    >
                      <span>{type.icon}</span>
                      {translateBusinessType(t, type.id, type.label)}
                      {cnt > 0 && <em>{cnt}</em>}
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </section>

        {/* ── Carte toujours visible ── */}
        <div ref={mapSectionRef} className={`mk-map-top${mapFullscreen?' mk-map-top-fullscreen':''}`} style={{ position:'relative', height: mapFullscreen ? '100vh' : 'clamp(220px,26vw,320px)', borderRadius: mapFullscreen?0:20, overflow:'hidden', marginBottom:8, boxShadow:'var(--mk-shadow-md)' }}>
          {mapError ? (
            <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, background:'var(--mk-pill)', color:'var(--mk-muted)' }}>
              <PremiumIcon name="map" size={34} />
              <span style={{ fontSize:13, fontWeight:600 }}>{t('marketplace.map.load_error')}</span>
            </div>
          ) : (
            <MkMap
              restaurants={mapRestaurants}
              theme={theme}
              selectedSlug={mapSelectedSlug || hoveredSlug}
              onSelect={(slug)=>{ setMapSelectedSlug(slug); cardRefs.current[slug]?.scrollIntoView({ behavior:'smooth', block:'center' }); }}
              userPos={userPos}
              recenterKey={userPos ? `${userPos.lat},${userPos.lng}` : null}
              onAreaSearch={(c)=>{ setSearchAreaCenter(c); setShowSearchArea(true); }}
              onMapError={()=>setMapError(true)}
            />
          )}
          {showSearchArea && searchAreaCenter && (
            <button onClick={()=>searchThisArea(searchAreaCenter)}
              style={{ position:'absolute', top:14, insetInlineStart:'50%', transform:'translateX(-50%)', padding:'9px 18px', borderRadius:30, border:'none', background:'#fff', color:'var(--mk-orange)', fontWeight:700, fontSize:12.5, cursor:'pointer', boxShadow:'0 6px 18px rgba(0,0,0,.25)', zIndex:10 }}>
              <PremiumIcon name="search" size={14} /> {t('marketplace.map.search_area')}
            </button>
          )}
          <button onClick={()=>setMapFullscreen(v=>!v)} title={mapFullscreen?t('marketplace.map.reduce'):t('marketplace.map.fullscreen')}
            style={{ position:'absolute', top:14, insetInlineEnd:14, width:36, height:36, borderRadius:10, border:'none', background:'#fff', color:'#1E1E1E', fontSize:15, cursor:'pointer', boxShadow:'0 4px 14px rgba(0,0,0,.2)', display:'grid', placeItems:'center', zIndex:10 }}>
            {mapFullscreen ? '✕' : '⛶'}
          </button>
        </div>

        {/* ── Filter bar (rapides) ── */}
        <div className="mk-scroll" style={{ display:'flex', gap:8, alignItems:'center', overflowX:'auto', padding:'10px 0', scrollbarWidth:'none', WebkitOverflowScrolling:'touch', marginBottom:8 }}>
          <button onClick={()=>setShowFilters(true)} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:10, border:`1.5px solid ${hasActive?'var(--mk-orange)':'var(--mk-border)'}`, background:hasActive?'var(--mk-orange-light)':'var(--mk-surface)', color:hasActive?'var(--mk-orange)':'var(--mk-text)', cursor:'pointer', fontWeight:600, fontSize:12, flexShrink:0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
            {t('marketplace.common.filters')} {hasActive && <span style={{ background:'var(--mk-orange)', color:'#fff', borderRadius:'50%', width:16, height:16, fontSize:9, display:'grid', placeItems:'center', fontWeight:800 }}>{[filters.min_rating,filters.delivery,filters.open_now,filters.reservation,filters.qr_table,filters.takeaway,district].filter(Boolean).length||'!'}</span>}
          </button>

          <button onClick={()=>setFilters(p=>({...p,open_now:p.open_now==='true'?'':'true'}))}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:10, border:`1.5px solid ${filters.open_now==='true'?'var(--mk-green)':'var(--mk-border)'}`, background:filters.open_now==='true'?'var(--mk-green-light)':'var(--mk-surface)', color:filters.open_now==='true'?'var(--mk-green)':'var(--mk-muted)', cursor:'pointer', fontWeight:600, fontSize:12, flexShrink:0 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'currentColor', display:'inline-block', flexShrink:0 }} /> {t('marketplace.filters.quick_open')}
          </button>

          <button onClick={()=>setFilters(p=>({...p,delivery:p.delivery==='true'?'':'true'}))}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:10, border:`1.5px solid ${filters.delivery==='true'?'var(--mk-orange)':'var(--mk-border)'}`, background:filters.delivery==='true'?'var(--mk-orange-light)':'var(--mk-surface)', color:filters.delivery==='true'?'var(--mk-orange)':'var(--mk-muted)', cursor:'pointer', fontWeight:600, fontSize:12, flexShrink:0 }}>
            <PremiumIcon name="delivery" size={14} /> {t('marketplace.filters.quick_delivery')}
          </button>

          <button onClick={()=>setFilters(p=>({...p, guard:p.guard==='true'?'':'true', type:p.guard==='true'?p.type:'pharmacie'}))}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:10, border:`1.5px solid ${filters.guard==='true'?'#16A34A':'var(--mk-border)'}`, background:filters.guard==='true'?'#F0FDF4':'var(--mk-surface)', color:filters.guard==='true'?'#16A34A':'var(--mk-muted)', cursor:'pointer', fontWeight:600, fontSize:12, flexShrink:0 }}>
            <PremiumIcon name="shield" size={14} /> {t('marketplace.filters.guard')}
          </button>

          <button onClick={()=>setFilters(p=>({...p,open_24h:p.open_24h==='true'?'':'true'}))}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:10, border:`1.5px solid ${filters.open_24h==='true'?'#16A34A':'var(--mk-border)'}`, background:filters.open_24h==='true'?'#F0FDF4':'var(--mk-surface)', color:filters.open_24h==='true'?'#16A34A':'var(--mk-muted)', cursor:'pointer', fontWeight:600, fontSize:12, flexShrink:0 }}>
            <PremiumIcon name="clock" size={14} /> {t('marketplace.filters.open_24h')}
          </button>

          <button onClick={()=>setFilters(p=>({...p,min_rating:p.min_rating==='4.5'?'':'4.5'}))}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:10, border:`1.5px solid ${filters.min_rating==='4.5'?'#F59E0B':'var(--mk-border)'}`, background:filters.min_rating==='4.5'?'#FFFBEB':'var(--mk-surface)', color:filters.min_rating==='4.5'?'#D97706':'var(--mk-muted)', cursor:'pointer', fontWeight:600, fontSize:12, flexShrink:0 }}>
            <PremiumIcon name="star" size={14} /> {t('marketplace.filters.top_rated')}
          </button>

          {userPos && ['2','5','10'].map(r => (
            <button key={r} onClick={()=>setFilters(p=>({...p, radius_km:p.radius_km===r?'10':r}))}
              style={{ padding:'7px 12px', borderRadius:10, border:`1.5px solid ${filters.radius_km===r?'var(--mk-orange)':'var(--mk-border)'}`, background:filters.radius_km===r?'var(--mk-orange-light)':'var(--mk-surface)', color:filters.radius_km===r?'var(--mk-orange)':'var(--mk-muted)', cursor:'pointer', fontWeight:600, fontSize:12, flexShrink:0, whiteSpace:'nowrap' }}>
              &lt; {r} km
            </button>
          ))}

          <span style={{ fontSize:12, color:'var(--mk-muted)', fontWeight:500, flexShrink:0, whiteSpace:'nowrap', marginInlineStart:'auto', paddingInlineStart:8 }}>
            {loading ? '…' : t('marketplace.business.results_count', { count: total })}
          </span>
        </div>

        {/* ── Titre résultats ── */}
        <div ref={gridSectionRef} className="mk-business-results-head">
          <div>
            <h2>{userPos ? t('marketplace.business.near_you') : t('marketplace.business.all_businesses')}</h2>
            {userPos && <p>{t('marketplace.business.around', { address: address?.address || city || t('marketplace.location.your_position'), radius: filters.radius_km || '10' })}</p>}
          </div>
          <div className="mk-business-view-switch" role="group" aria-label={t('marketplace.business.view_group')}>
            <button type="button" className={commerceView === 'grid' ? 'is-active' : ''} onClick={() => changeCommerceView('grid')} aria-label={t('marketplace.business.grid_view')}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>
            </button>
            <button type="button" className={commerceView === 'list' ? 'is-active' : ''} onClick={() => changeCommerceView('list')} aria-label={t('marketplace.business.list_view')}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h12"/><path d="M8 12h12"/><path d="M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>
            </button>
          </div>
        </div>

        {/* ── Grille de résultats ── */}
        <div className={commerceView === 'list' ? 'mk-business-list' : 'mk-business-grid'}>
          {loading
            ? Array(8).fill(0).map((_,i)=><CardSkeleton key={i}/>)
            : restaurants.length===0
              ? <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'80px 20px' }}>
                  <div style={{ display:'grid', placeItems:'center', marginBottom:12, color:'var(--mk-orange)', filter:'drop-shadow(0 4px 12px rgba(0,0,0,.08))' }}><PremiumIcon name="utensils" size={58} /></div>
                  <div style={{ fontWeight:800, fontSize:20, color:'var(--mk-text)', marginBottom:8 }}>
                    {userPos ? t('marketplace.business.no_near') : t('marketplace.business.no_results')}
                  </div>
                  <div style={{ color:'var(--mk-muted)', fontSize:14, marginBottom:24, maxWidth:340, margin:'0 auto 24px' }}>
                    {userPos
                      ? <>{t('marketplace.business.expand_radius_prefix')}<button onClick={()=>setFilters(p=>({...p,radius_km:'50'}))} style={{ background:'none', border:'none', color:'var(--mk-orange)', fontWeight:700, cursor:'pointer', padding:0 }}>{t('marketplace.business.expand_50')}</button></>
                      : <>{t('marketplace.business.try_other_filters_prefix')}<button onClick={()=>setQ('')} style={{ background:'none', border:'none', color:'var(--mk-orange)', fontWeight:700, cursor:'pointer', padding:0 }}>{t('marketplace.business.clear_search')}</button></>
                    }
                  </div>
                  <button onClick={()=>{setFilters({ ...DEFAULT_FILTERS }); setQ('');}} style={{ padding:'11px 28px', border:'none', borderRadius:12, background:'linear-gradient(135deg,#FF8A00,#FF5D00)', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:14, boxShadow:'0 6px 20px rgba(255,138,0,.3)' }}>
                    {t('marketplace.business.reset_filters')}
                  </button>
                </div>
              : restaurants.map((r,i)=>(
                  <div key={r.id||r.slug} ref={el => { if (el) cardRefs.current[r.slug] = el; }}
                    onMouseEnter={()=>setHoveredSlug(r.slug)} onMouseLeave={()=>setHoveredSlug(s=>s===r.slug?null:s)}>
                    {commerceView === 'list' ? (
                      <RestaurantListItem r={r} isFav={isFav} onFav={toggleFav} onClick={()=>{ setMapSelectedSlug(r.slug); handleCardClick(r); }} onHover={setHoveredSlug} selected={mapSelectedSlug === r.slug} />
                    ) : (
                      <RestaurantCard r={r} isFav={isFav} onFav={toggleFav} onClick={()=>{ setMapSelectedSlug(r.slug); handleCardClick(r); }} selected={mapSelectedSlug === r.slug} delay={(i%12)*0.03}/>
                    )}
                  </div>
                ))
          }
        </div>

        {/* Load more */}
        {!loading && page < pages && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, marginTop:40 }}>
            <button onClick={()=>load(page+1,true)} disabled={loadingMore}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'13px 32px', border:'2px solid var(--mk-border)', borderRadius:14, background:'var(--mk-surface)', color:'var(--mk-text)', cursor:loadingMore?'default':'pointer', fontWeight:700, fontSize:14, transition:'all .2s', boxShadow:'var(--mk-shadow)' }}
              onMouseEnter={e=>{ if(!loadingMore){ e.currentTarget.style.borderColor='var(--mk-orange)'; e.currentTarget.style.color='var(--mk-orange)'; }}}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--mk-border)'; e.currentTarget.style.color='var(--mk-text)'; }}>
              {loadingMore
                ? <><span className="mk-spin" style={{ display:'inline-block', width:16, height:16, border:'2.5px solid var(--mk-border)', borderTopColor:'var(--mk-orange)', borderRadius:'50%' }} /> {t('common.loading')}</>
                : <>{t('marketplace.business.more_count', { count: Math.min(12, total - restaurants.length) })} <span style={{ opacity:.5 }}>({restaurants.length}/{total})</span></>
              }
            </button>
          </div>
        )}

        {/* ── Separator ── */}
          <div style={{ margin:'48px 0 32px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ flex:1, height:1, background:'var(--mk-border)' }} />
            <span style={{ fontSize:12, color:'var(--mk-muted)', fontWeight:600, whiteSpace:'nowrap' }}>{t('marketplace.business.current_selections')}</span>
            <div style={{ flex:1, height:1, background:'var(--mk-border)' }} />
          </div>

          {browseHistory.length > 0 && (
            <SectionCarousel titleKey="marketplace.business.history" icon="clock" restaurants={browseHistory} isFav={isFav} onFav={toggleFav} onCard={handleCardClick} />
          )}

          {sectLoading
            ? <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:16, marginBottom:36 }}>{Array(4).fill(0).map((_,i)=><CardSkeleton key={i}/>)}</div>
            : <>
                <SectionCarousel titleKey="marketplace.business.popular_section" icon="sparkles" restaurants={sectionPop} isFav={isFav} onFav={toggleFav} onCard={handleCardClick}
                  onSeeAll={() => handleFilterChange('sort','featured')} />
                <SectionCarousel titleKey="marketplace.business.top_rated" icon="star" restaurants={sectionTop} isFav={isFav} onFav={toggleFav} onCard={handleCardClick}
                  onSeeAll={() => { handleFilterChange('sort','rating'); handleFilterChange('min_rating','4'); }} />
                <SectionCarousel titleKey="marketplace.business.new_places" icon="award" restaurants={sectionNew} isFav={isFav} onFav={toggleFav} onCard={handleCardClick}
                  onSeeAll={() => handleFilterChange('sort','new')} />
              </>
          }
          </main>
        </div>
          </>
        )}
      </div>

      {compareProduct && <SellerCompareSheet product={compareProduct} onClose={() => setCompareProduct(null)} />}

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 clamp(14px,4vw,40px) 24px' }}>
        <AdSlot placement="content_bottom" platform="marketplace" />
      </div>

      {/* ── FOOTER ── */}
      <div style={{ borderTop:'1px solid var(--mk-border)', padding:'18px clamp(14px,4vw,40px)', background:'var(--mk-surface)', display:'flex', flexWrap:'wrap', gap:10, alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:13, color:'var(--mk-muted)' }}>{t('marketplace.footer.pro_question')} <button onClick={()=>navigate('/login')} style={{ background:'none', border:'none', color:'var(--mk-orange)', fontWeight:700, cursor:'pointer', fontSize:13, padding:0 }}>{t('marketplace.footer.pro_area')}</button></span>
        <button onClick={()=>navigate('/discover')} style={{ background:'none', border:'none', color:'var(--mk-orange)', fontWeight:700, cursor:'pointer', fontSize:13, padding:0 }}>{t('marketplace.footer.discover')}</button>
        <button onClick={()=>navigate('/gaming')} style={{ background:'none', border:'none', color:'var(--mk-orange)', fontWeight:700, cursor:'pointer', fontSize:13, padding:0 }}>🎮 Gaming Hub</button>
        <span style={{ fontSize:12, color:'var(--mk-muted)' }}>© {new Date().getFullYear()} {BRAND.APP_NAME}</span>
      </div>

      {/* ── FLOATING AI ── */}
      {!showAI && (
        <button onClick={()=>setShowAI(true)} className="mk-floating-ai" style={{ position:'fixed', bottom:24, insetInlineEnd:24, zIndex:400, width:52, height:52, borderRadius:'50%', border:'none', background:'linear-gradient(135deg,#7C3AED,#4F46E5)', color:'#fff', fontSize:22, cursor:'pointer', boxShadow:'0 8px 24px rgba(124,58,237,.4)', display:'grid', placeItems:'center', transition:'transform .2s' }}
          onMouseEnter={e=>e.currentTarget.style.transform='scale(1.12)'}
          onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
          title="Assistant IA"><PremiumIcon name="sparkles" size={23} /></button>
      )}

      {/* ── BOTTOM BAR MOBILE (navigation app-native) ── */}
      <div className="mk-bottom-bar" style={{ background:theme==='dark'?'rgba(7,13,26,.94)':'rgba(255,255,255,.94)' }}>
        <button className={`mk-bottom-tab${view==='grid'?' active':''}`} onClick={() => { setActiveMarketplaceSection('products'); setView('grid'); }}>
          <span className="mk-bottom-tab-icon"><PremiumIcon name="home" size={20} /></span>
          {t('marketplace.bottom.explore')}
        </button>
        <button className={`mk-bottom-tab${userPos?' active':''}`} onClick={()=>{ userPos?changeLocation():detectLocation(); }} disabled={geoLoading}>
          <span className="mk-bottom-tab-icon">{geoLoading ? <span className="mk-spin" /> : <PremiumIcon name={userPos ? 'check' : 'mapPin'} size={20} />}</span>
          {t('marketplace.bottom.near_me')}
        </button>
        <button className={`mk-bottom-tab${view==='map'?' active':''}`} onClick={() => { setActiveMarketplaceSection('commerce'); setView('map'); setTimeout(() => mapSectionRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 0); }}>
          <span className="mk-bottom-tab-icon"><PremiumIcon name="map" size={20} /></span>
          {t('marketplace.bottom.map')}
        </button>
        <button className={`mk-bottom-tab${itemCount>0?' active':''}`} onClick={()=>itemCount>0&&goToCart()} style={{ position:'relative' }}>
          <span className="mk-bottom-tab-icon"><PremiumIcon name="cart" size={20} /></span>
          {itemCount>0 && <span className="mk-bottom-badge">{itemCount}</span>}
          {t('marketplace.bottom.cart')}
        </button>
        <button className="mk-bottom-tab" onClick={()=>navigate(customerUser?'/dashboard':'/account')}>
          <span className="mk-bottom-tab-icon"><PremiumIcon name="user" size={20} /></span>
          {customerUser?(customerUser.nom||'').split(' ')[0]||t('marketplace.bottom.account'):t('marketplace.bottom.account')}
        </button>
      </div>

      <MarketplaceSidebar
        mode="marketplace"
        variant="drawer"
        open={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onChange={handleFilterChange}
        query={q}
        onQueryChange={setQ}
        district={district}
        onDistrict={setDistrict}
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryTab}
        typeCounts={typeCounts}
        catCounts={catCounts}
        total={total}
      />
      <AIAssistant open={showAI} onClose={()=>setShowAI(false)} restaurants={restaurants} onApply={f=>setFilters(prev=>({...prev,...f}))} />
      <LocationModal open={showLocationModal} mandatory={!address} onClose={()=>setShowLocationModal(false)} onConfirm={handleLocationConfirm} customerToken={customerToken} />
    </div>
  );
}
