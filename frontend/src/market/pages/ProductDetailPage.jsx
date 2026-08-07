import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API, ASSET } from '../../api';
import { useCart } from '../../contexts/CartContext';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { ProductCard } from '../components/marketplace/ProductCard';
import { ProductOptionsSelector } from '../components/marketplace/ProductOptionsSelector';
import { AddToCartButton } from '../components/marketplace/AddToCartButton';
import { CartConflictModal } from '../components/marketplace/CartConflictModal';
import { initOptionSelections, computeOptionsPrice, buildSelectedOptionsPayload, computeCartKey } from '../components/marketplace/productOptions';
import { PremiumIcon, PremiumIconBadge } from '../../shared/components/ui/PremiumIcon';

const MODULE_ICON = { resto: 'utensils', hanout: 'cart', pharmacie: 'medicine' };
const MODULE_SHOP_PATH = { resto: 'r', hanout: 'h', pharmacie: 'ph' };
const AVAILABILITY_LABEL = { out_of_stock: 'Indisponible', low_stock: 'Bientôt épuisé', in_stock: null, unknown: null };
const fmt = n => Number(n || 0).toFixed(2);

function Spinner() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ width: 36, height: 36, border: '3px solid #E5E7EB', borderTopColor: '#FF8A00', borderRadius: '50%', animation: 'pdp-spin 1s linear infinite', display: 'inline-block' }} />
      <style>{'@keyframes pdp-spin { to { transform: rotate(360deg) } }'}</style>
    </div>
  );
}

function SimilarRow({ title, products }) {
  if (!products?.length) return null;
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--mk-text, #111827)', margin: '0 0 14px' }}>{title}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 14 }}>
        {products.map(p => <ProductCard key={`${p.module}-${p.id}`} product={p} />)}
      </div>
    </section>
  );
}

export default function ProductDetailPage() {
  // Deux routes mènent ici : /product/:module/:id (legacy, module connu) et
  // /produits/:slug (URL SEO canonique à plat — resto/hanout/pharmacie
  // partagent le même espace d'URL, le module n'est pas dans le chemin). Sur
  // cette 2e route on ne peut pas deviner le module côté client : l'effet
  // ci-dessous appelle l'endpoint de résolution cross-module dédié
  // (GET /marketplace/products/by-slug/:slug, voir productDetailService
  // .getProductBySlug côté backend) plutôt que /products/:module/:id.
  const params = useParams();
  const module = params.module || null;
  const id = params.id || params.slug;
  const navigate = useNavigate();
  const { cart, itemCount, addItem } = useCart();
  const { user: customerUser } = useCustomerAuth();

  // Même logique que MarketplacePage.goToCart : un panier hanout n'a pas de
  // tunnel /checkout dédié, on rouvre la boutique (tiroir panier sur place).
  function goToCart() {
    if (cart?.module === 'hanout') navigate(`/h/${cart.orgSlug}`);
    else navigate('/checkout');
  }

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [selections, setSelections] = useState({});
  const [errors, setErrors] = useState({});
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [showConflict, setShowConflict] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    const url = module ? `/marketplace/products/${module}/${id}` : `/marketplace/products/by-slug/${id}`;
    fetch(API(url))
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(d => {
        setData(d);
        setSelections(initOptionSelections(d.product.options));
        setErrors({});
        setQty(1);
        setImgIdx(0);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    window.scrollTo({ top: 0 });
  }, [module, id]);

  if (loading) return <Spinner />;
  if (notFound || !data) return (
    <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20, textAlign: 'center' }}>
      <PremiumIconBadge name={MODULE_ICON[module] || 'package'} size={28} />
      <div style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>Produit introuvable</div>
      <button onClick={() => navigate('/marketplace')} style={{ padding: '10px 24px', background: '#FF8A00', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
        ← Retour au marketplace
      </button>
    </div>
  );

  const { product, similar_business, similar_category } = data;
  const shopPath = MODULE_SHOP_PATH[product.module] || 'r';
  const images = product.images?.length ? product.images : [];
  const hasDiscount = product.compare_price && Number(product.compare_price) > Number(product.price);
  const discountPct = hasDiscount ? Math.round((1 - product.price / product.compare_price) * 100) : 0;
  const availabilityLabel = AVAILABILITY_LABEL[product.availability];
  const unavailable = product.availability === 'out_of_stock';

  const { total: unitPrice } = computeOptionsPrice(product.price, product.options, selections);

  function set(optId, val) {
    setSelections(prev => ({ ...prev, [optId]: val }));
    setErrors(prev => { const n = { ...prev }; delete n[optId]; return n; });
  }

  function doAdd() {
    const { errs, selected_options } = buildSelectedOptionsPayload(product.options, selections);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    if (product.module === 'hanout') {
      addItem(product.business.slug, product.business.name, {
        id: product.id, name: product.name, price: product.price, unit: product.unit,
        images: product.images, available: !unavailable,
        _key: computeCartKey(product.id, selected_options),
        unit_price: unitPrice,
        ...(selected_options.length && { selected_options }),
      }, qty, 'hanout');
    } else if (product.module === 'pharmacie') {
      // OTC/parapharmacie uniquement — les produits sous ordonnance ne
      // passent jamais par ici (handleAddClick redirige avant d'appeler doAdd).
      // Pas d'options/variantes en pharmacie, forme la plus simple.
      addItem(product.business.slug, product.business.name, {
        id: product.id, libelle: product.name, unit_price: unitPrice,
        image_url: product.images?.[0] || null,
      }, qty, 'pharmacie');
    } else {
      // resto — même convention que RestaurantPage.cartItemFromItem : _key/
      // selected_options seulement si des options ont été choisies, pour que
      // les ajouts sans option (depuis la carte ou depuis cette page) fusionnent
      // toujours sur la même ligne panier (clé = id numérique brut sinon).
      const _key = selected_options.length ? computeCartKey(product.id, selected_options) : undefined;
      addItem(product.business.slug, product.business.name, {
        id: product.id, libelle: product.name, unit_price: unitPrice,
        image_url: product.images?.[0] || null,
        ...(_key && { _key }),
        ...(selected_options.length && { selected_options }),
      }, qty, 'resto');
    }

    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  function handleAddClick() {
    if (product.module === 'pharmacie' && product.requires_prescription) {
      navigate(`/ph/${product.business.slug}`, { state: { openRequest: 'availability', medicineId: product.id } });
      return;
    }
    if (cart && cart.orgSlug !== product.business.slug) { setShowConflict(true); return; }
    doAdd();
  }

  return (
    <div className="pdp-page" style={{ minHeight: '100vh', background: '#F9FAFB' }}>
      <style>{`
        @keyframes pdp-spin { to { transform: rotate(360deg) } }
        .pdp-grid { display: grid; grid-template-columns: 1fr; gap: 28px; }
        @media (min-width: 860px) { .pdp-grid { grid-template-columns: 1fr 1fr; gap: 40px; } }
        @media (max-width: 767px) { .pdp-page { padding-bottom: 76px; } }
      `}</style>

      {/* ── Topbar (desktop + mobile) — panier toujours accessible, comme sur
          les autres pages marketplace (RestaurantPage/HanoutPage) ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #E5E7EB', padding: '0 clamp(12px,4vw,32px)', height: 56, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', padding: '4px 6px' }}>←</button>
        <div style={{ flex: 1 }} />
        <button onClick={goToCart} style={{ position: 'relative', background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', padding: '4px 6px' }}>
          <PremiumIcon name="cart" size={22} />
          {itemCount > 0 && (
            <span style={{ position: 'absolute', top: -2, right: -2, background: '#FF8A00', color: '#fff', borderRadius: '50%', width: 17, height: 17, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{itemCount}</span>
          )}
        </button>
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px clamp(12px,4vw,32px) 64px' }}>
        <div className="pdp-grid">
          {/* ── Galerie ── */}
          <div>
            <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', background: '#F3F4F6', aspectRatio: '1/1' }}>
              {images.length > 0
                ? <img src={ASSET(images[imgIdx])} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PremiumIcon name={MODULE_ICON[product.module] || 'package'} size={72} style={{ color:'#9CA3AF' }} /></div>
              }
              {hasDiscount && (
                <span style={{ position: 'absolute', top: 14, left: 14, background: '#EF4444', color: '#fff', fontWeight: 800, fontSize: 13, padding: '4px 12px', borderRadius: 20 }}>-{discountPct}%</span>
              )}
              {availabilityLabel && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ background: '#fff', color: '#0F172A', fontSize: 14, fontWeight: 700, padding: '6px 16px', borderRadius: 20 }}>{availabilityLabel}</span>
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto' }}>
                {images.map((img, i) => (
                  <button key={i} onClick={() => setImgIdx(i)} style={{
                    width: 64, height: 64, borderRadius: 10, overflow: 'hidden', padding: 0, flexShrink: 0,
                    border: i === imgIdx ? '2.5px solid #FF8A00' : '2px solid #E5E7EB', cursor: 'pointer', background: 'none',
                  }}>
                    <img src={ASSET(img)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Infos ── */}
          <div>
            <button onClick={() => navigate(`/${shopPath}/${product.business.slug}`)} style={{
              display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 14,
            }}>
              {product.business.logo_url
                ? <img src={ASSET(product.business.logo_url)} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} />
                : <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PremiumIcon name={MODULE_ICON[product.module] || 'store'} size={15} /></div>
              }
              <span style={{ fontSize: 13, fontWeight: 700, color: '#6B7280' }}>{product.business.name}</span>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>Voir la boutique →</span>
            </button>

            <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 800, color: '#111827', lineHeight: 1.25 }}>{product.name}</h1>

            {product.category?.name && (
              <span style={{ display: 'inline-block', fontSize: 12, color: '#6B7280', background: '#F3F4F6', padding: '3px 10px', borderRadius: 20, marginBottom: 10 }}>
                {product.category.name}
              </span>
            )}

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '6px 0 16px' }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: '#FF8A00' }}>{fmt(product.price)} MAD</span>
              {product.unit && <span style={{ fontSize: 13, color: '#9CA3AF' }}>/ {product.unit}</span>}
              {hasDiscount && <span style={{ fontSize: 15, color: '#9CA3AF', textDecoration: 'line-through' }}>{fmt(product.compare_price)}</span>}
              {product.requires_prescription && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', padding: '3px 9px', borderRadius: 20 }}>Sous ordonnance</span>
              )}
            </div>

            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
              {product.description || 'Aucune description disponible pour ce produit.'}
            </p>

            {product.nutrition && (
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20, fontSize: 12, color: '#6B7280' }}>
                {product.nutrition.calories && <span className="premium-inline-icon"><PremiumIcon name="flame" size={14} />{product.nutrition.calories} kcal</span>}
                {product.nutrition.allergenes?.length > 0 && <span className="premium-inline-icon"><PremiumIcon name="alert" size={14} />Allergènes : {product.nutrition.allergenes.join(', ')}</span>}
              </div>
            )}

            <ProductOptionsSelector options={product.options} selections={selections} errors={errors} onChange={set} theme={{ primary: '#FF8A00', dark: '#FF5D00' }} />

            {(product.module !== 'pharmacie' || !product.requires_prescription) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '20px 0' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Quantité</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 34, height: 34, borderRadius: 9, border: '1.5px solid #E5E7EB', background: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>−</button>
                  <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 800, fontSize: 15 }}>{qty}</span>
                  <button onClick={() => setQty(q => q + 1)} style={{ width: 34, height: 34, borderRadius: 9, border: 'none', background: '#FF8A00', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>+</button>
                </div>
              </div>
            )}

            {product.options?.length > 0 && (product.module !== 'pharmacie' || !product.requires_prescription) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13, color: '#6B7280' }}>
                <span>Total estimé</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#FF8A00' }}>{fmt(unitPrice * qty)} MAD</span>
              </div>
            )}

            <AddToCartButton
              label={(product.module === 'pharmacie' && product.requires_prescription) ? 'Vérifier disponibilité' : `Ajouter au panier — ${fmt(unitPrice * qty)} MAD`}
              disabled={unavailable}
              added={added}
              onClick={handleAddClick}
            />
          </div>
        </div>

        <SimilarRow title={`Autres produits de ${product.business.name}`} products={similar_business} />
        <SimilarRow title="Vous pourriez aussi aimer" products={similar_category} />
      </div>

      {/* ── BOTTOM BAR MOBILE — même barre que MarketplacePage (classes mk-*
          globales, masquée sur desktop) pour garder une navigation cohérente
          depuis la fiche produit ── */}
      <div className="mk-bottom-bar">
        <button className="mk-bottom-tab" onClick={() => navigate('/marketplace')}>
          <span className="mk-bottom-tab-icon"><PremiumIcon name="home" size={18} /></span>
          Marketplace
        </button>
        <button className="mk-bottom-tab" onClick={() => navigate(`/${MODULE_SHOP_PATH[product.module]}/${product.business.slug}`)}>
          <span className="mk-bottom-tab-icon"><PremiumIcon name={MODULE_ICON[product.module] || 'store'} size={18} /></span>
          Boutique
        </button>
        <button className={`mk-bottom-tab${itemCount > 0 ? ' active' : ''}`} onClick={() => itemCount > 0 && goToCart()} style={{ position: 'relative' }}>
          <span className="mk-bottom-tab-icon"><PremiumIcon name="cart" size={18} /></span>
          {itemCount > 0 && <span className="mk-bottom-badge">{itemCount}</span>}
          Panier
        </button>
        <button className="mk-bottom-tab" onClick={() => navigate(customerUser ? '/dashboard' : '/account')}>
          <span className="mk-bottom-tab-icon"><PremiumIcon name="user" size={18} /></span>
          {customerUser ? (customerUser.nom || '').split(' ')[0] || 'Compte' : 'Compte'}
        </button>
      </div>

      <CartConflictModal
        show={showConflict}
        currentOrgName={cart?.orgName}
        targetOrgName={product.business.name}
        onCancel={() => setShowConflict(false)}
        onConfirm={() => { setShowConflict(false); doAdd(); }}
      />
    </div>
  );
}
