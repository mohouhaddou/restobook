import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { API, ASSET } from '../../api';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { useCart } from '../../contexts/CartContext';
import { ShareButton } from '../../shared/components/ui/ShareMenu';
import { StoreHeroCarousel } from '../../shared/components/marketplace/StoreHeroCarousel';
import { StoreSidebar } from '../../shared/components/marketplace/StoreSidebar';
import { CartConflictModal } from '../../shared/components/marketplace/CartConflictModal';
import { CartPreviewDrawer } from '../../shared/components/marketplace/CartPreviewDrawer';
import { computeCartKey } from '../../shared/components/marketplace/productOptions';
import ProductModal from './ProductModal';
import BusinessReviewsSection from '../seo/components/BusinessReviewsSection';
import { PremiumIcon, PremiumIconBadge } from '../../shared/components/ui/PremiumIcon';

/* ══ CONSTANTES ═══════════════════════════════════════════════════════════ */
const STATUS_LABEL = { pending:'En attente', confirmed:'Confirmée', preparing:'En préparation', ready:'Prête', delivered:'Livrée', cancelled:'Annulée' };
const STATUS_COLOR = { pending:'#F59E0B', confirmed:'#3B82F6', preparing:'#8B5CF6', ready:'#10B981', delivered:'#22C55E', cancelled:'#EF4444' };
const DAY_NAMES  = { monday:'Lundi', tuesday:'Mardi', wednesday:'Mercredi', thursday:'Jeudi', friday:'Vendredi', saturday:'Samedi', sunday:'Dimanche' };
const DAYS_ORDER = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const TABS = ['Produits','Avis','Infos','Horaires'];

const BTYPE_THEME = {
  hanout:      { primary:'#10B981', secondary:'#34D399', dark:'#059669', light:'#F0FDF4', lightBorder:'#BBF7D0', glow:'rgba(16,185,129,.45)',  icon:'store' },
  boucherie:   { primary:'#DC2626', secondary:'#F87171', dark:'#B91C1C', light:'#FEF2F2', lightBorder:'#FECACA', glow:'rgba(220,38,38,.45)',    icon:'store' },
  boulangerie: { primary:'#D97706', secondary:'#FCD34D', dark:'#B45309', light:'#FFFBEB', lightBorder:'#FDE68A', glow:'rgba(217,119,6,.45)',    icon:'store' },
  patisserie:  { primary:'#EC4899', secondary:'#F9A8D4', dark:'#DB2777', light:'#FDF2F8', lightBorder:'#FBCFE8', glow:'rgba(236,72,153,.45)',   icon:'store' },
  cafe:        { primary:'#0369A1', secondary:'#38BDF8', dark:'#0284C7', light:'#F0F9FF', lightBorder:'#BAE6FD', glow:'rgba(3,105,161,.45)',    icon:'store' },
};
const DEFAULT_THEME = BTYPE_THEME.hanout;

/* ══ HOOKS ════════════════════════════════════════════════════════════════ */
// cartKey vient de productOptions.js (computeCartKey) — partagé avec
// ProductDetailPage pour que deux ajouts du même produit+options depuis des
// écrans différents fusionnent bien dans la même ligne panier.
function cartKey(product) {
  return computeCartKey(product.id, product.selected_options);
}

/**
 * Panier hanout — désormais un fin adaptateur au-dessus du CartContext
 * partagé (module='hanout') plutôt qu'un state local isolé : un seul panier
 * pour tout le marketplace (resto + hanout), persisté, visible depuis
 * n'importe quelle page (badge MarketplacePage inclus). Conserve la même
 * forme {items, add, addMany, remove, update, clear, total, count} pour ne
 * pas devoir réécrire CartDrawer/ProductModal.
 */
function useHanoutCart(slug, orgName) {
  const { cart: shared, total: sharedTotal, itemCount: sharedCount, addItem, addManyItems, removeItem, updateQuantity, clearCart } = useCart();

  // Le panier partagé peut appartenir à un autre commerce (resto ou autre
  // hanout) — dans ce cas, CETTE page doit se voir vide (total/count à 0),
  // pas afficher le panier de quelqu'un d'autre.
  const isMine = shared?.orgSlug === slug && shared?.module === 'hanout';
  const items  = isMine ? shared.items : [];

  const add = (product) => {
    const qtyValue  = product._qty_value ?? 1;
    const unitPrice = Number(product._cart_price ?? product.price) * qtyValue;
    addItem(slug, orgName, { ...product, _key: cartKey(product), unit_price: unitPrice }, 1, 'hanout');
  };

  // Ajout groupé (ex. "Commander cette liste") — les produits à options
  // (poids/variantes) sont déjà exclus par l'appelant (voir deep-link add_list).
  const addMany = (entries) => {
    const itemsWithQty = entries.map(({ product, qty }) => ({
      ...product, _key: cartKey(product),
      unit_price: Number(product._cart_price ?? product.price),
      quantity: qty,
    }));
    addManyItems(slug, orgName, itemsWithQty, 'hanout');
  };

  const remove = (key) => removeItem(key);
  const update = (key, qty) => updateQuantity(key, qty);
  const clear  = () => clearCart();

  return { items, add, addMany, remove, update, clear, total: isMine ? sharedTotal : 0, count: isMine ? sharedCount : 0 };
}

/* ══ COMPOSANTS UTILITAIRES ═══════════════════════════════════════════════ */
function Spinner({ theme = DEFAULT_THEME }) {
  return <div style={{ display:'flex', justifyContent:'center', padding:60 }}><div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid #E5E7EB', borderTopColor:theme.primary, animation:'hn-spin 1s linear infinite' }} /></div>;
}

/* ══ HORAIRES D'OUVERTURE ═══════════════════════════════════════════════ */
function OpeningHours({ hours, theme = DEFAULT_THEME }) {
  if (!hours) return <div style={{ fontSize:13, color:'#9CA3AF' }}>Horaires non renseignés</div>;
  const today = DAYS_ORDER[(new Date().getDay() + 6) % 7];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      {DAYS_ORDER.map(day => {
        const slot = hours[day];
        const isToday = day === today;
        return (
          <div key={day} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'6px 10px', borderRadius:8, background: isToday ? theme.light : 'transparent' }}>
            <span style={{ fontWeight:isToday?700:400, color:isToday?theme.dark:'#111827' }}>{DAY_NAMES[day]}{isToday?' (aujourd\'hui)':''}</span>
            <span style={{ color:slot?.closed?'#EF4444':isToday?theme.dark:'#6B7280', fontWeight:500 }}>
              {!slot ? '—' : slot.closed ? 'Fermé' : `${slot.open||'00:00'} – ${slot.close||'23:59'}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ══ MINI-CARTE LOCALISATION ════════════════════════════════════════════ */
function HanoutMiniMap({ lat, lng, name, theme = DEFAULT_THEME }) {
  const ref = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!ref.current || mapRef.current || !lat || !lng) return;
    const map = L.map(ref.current, { center:[lat,lng], zoom:15, zoomControl:false, attributionControl:false, dragging:false, scrollWheelZoom:false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom:19 }).addTo(map);
    const icon = L.divIcon({ className:'', html:`<div style="background:${theme.primary};color:#fff;font-size:16px;width:38px;height:38px;border-radius:50% 50% 50% 4px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.3);transform:rotate(-45deg);border:2.5px solid #fff"><span style="transform:rotate(45deg)">${theme.icon}</span></div>`, iconSize:[38,38], iconAnchor:[19,38] });
    L.marker([lat,lng], { icon }).addTo(map).bindPopup(name);
    mapRef.current = map;
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [lat, lng]);

  if (!lat || !lng) return null;
  return <div ref={ref} style={{ width:'100%', height:220, borderRadius:14, border:'1px solid #E5E7EB' }} />;
}

/* ══ AVIS ═══════════════════════════════════════════════════════════════ */
function ReviewsSection({ slug, theme = DEFAULT_THEME }) {
  const [reviews, setReviews] = useState([]);
  const [meta, setMeta]       = useState({ avg_rating:0, total:0, distribution:{1:0,2:0,3:0,4:0,5:0} });
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [pages, setPages]     = useState(1);
  const [sort, setSort]       = useState('recent');

  async function load(p=1) {
    setLoading(true);
    try {
      const res  = await fetch(API(`/marketplace/restaurants/${slug}/reviews?page=${p}&limit=6&sort=${sort}`));
      const data = await res.json();
      setReviews(data.reviews||[]);
      setMeta({ avg_rating: data.avg_rating||0, total: data.total||0, distribution: data.distribution||{1:0,2:0,3:0,4:0,5:0} });
      setPages(data.pages||1); setPage(p);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(1); }, [slug, sort]);

  const maxCount = Math.max(1, ...Object.values(meta.distribution));

  return (
    <div>
      <div style={{ display:'flex', gap:28, flexWrap:'wrap', marginBottom:20 }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:44, fontWeight:800, color:'#111827', lineHeight:1 }}>{Number(meta.avg_rating).toFixed(1)}</div>
          <div style={{ color:'#F59E0B', fontSize:18, margin:'4px 0' }}>{'★'.repeat(Math.round(meta.avg_rating))}{'☆'.repeat(5-Math.round(meta.avg_rating))}</div>
          <div style={{ fontSize:12, color:'#9CA3AF' }}>{meta.total} avis</div>
        </div>
        <div style={{ flex:1, minWidth:200 }}>
          {[5,4,3,2,1].map(n => (
            <div key={n} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ fontSize:12, color:'#9CA3AF', width:12, textAlign:'right' }}>{n}</span>
              <span style={{ color:'#F59E0B', fontSize:12 }}>★</span>
              <div style={{ flex:1, height:6, background:'#E5E7EB', borderRadius:4, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${(meta.distribution[n]/maxCount)*100}%`, background:'#F59E0B', borderRadius:4, transition:'width .5s' }} />
              </div>
              <span style={{ fontSize:11, color:'#9CA3AF', width:20, textAlign:'right' }}>{meta.distribution[n]}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {[{v:'recent',l:'Récents'},{v:'rating_high',l:'Mieux notés'},{v:'rating_low',l:'Moins biens'}].map(({v,l}) => (
          <button key={v} onClick={()=>setSort(v)} className={`hn-cat-pill${sort===v?' active':''}`}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'20px' }}>
          <span style={{ display:'inline-block', width:24, height:24, border:'2px solid #E5E7EB', borderTopColor:theme.primary, borderRadius:'50%', animation:'hn-spin 1s linear infinite' }} />
        </div>
      ) : reviews.length === 0 ? (
        <div style={{ textAlign:'center', padding:'32px', color:'#9CA3AF', fontSize:14 }}>
          <div style={{ display:'grid', placeItems:'center', color:'#9CA3AF', marginBottom:8 }}><PremiumIconBadge name="message" size={24} /></div>
          Aucun avis pour le moment. Soyez le premier !
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {reviews.map(r => (
            <div key={r.id} style={{ background:'#F9FAFB', borderRadius:14, padding:'16px', border:'1px solid #E5E7EB' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:`linear-gradient(135deg,${theme.primary},${theme.secondary})`, display:'grid', placeItems:'center', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0 }}>
                    {(r.author||'A')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14, color:'#111827' }}>{r.author}</div>
                    <div style={{ fontSize:11, color:'#9CA3AF' }}>{new Date(r.created_at).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })}</div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ color:'#F59E0B', fontSize:14 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:'#111827', marginLeft:4 }}>{r.rating}.0</span>
                </div>
              </div>
              {r.comment && <p style={{ margin:0, fontSize:13, color:'#374151', lineHeight:1.55 }}>{r.comment}</p>}
            </div>
          ))}
          {pages > 1 && (
            <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:8 }}>
              <button onClick={()=>load(page-1)} disabled={page<=1} style={{ padding:'7px 16px', borderRadius:8, border:'1px solid #E5E7EB', background:'#fff', color:page<=1?'#9CA3AF':'#111827', cursor:page<=1?'default':'pointer', fontSize:12, fontWeight:600, opacity:page<=1?.5:1 }}>← Précédent</button>
              <button onClick={()=>load(page+1)} disabled={page>=pages} style={{ padding:'7px 16px', borderRadius:8, border:'1px solid #E5E7EB', background:'#fff', color:page>=pages?'#9CA3AF':'#111827', cursor:page>=pages?'default':'pointer', fontSize:12, fontWeight:600, opacity:page>=pages?.5:1 }}>Suivant →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProductCard({ p, onOpen, theme = DEFAULT_THEME, slug }) {
  const navigate = useNavigate();
  const hasDiscount = p.compare_price && Number(p.compare_price) > Number(p.price);
  const discount = hasDiscount ? Math.round((1 - p.price / p.compare_price) * 100) : 0;
  const imgSrc = Array.isArray(p.images) && p.images[0] ? ASSET(p.images[0]) : null;
  const hasOptions = p.options && p.options.length > 0;

  // Clic carte/image/nom → fiche produit unifiée ; le bouton "Ajouter"/
  // "Choisir" (stopPropagation) garde son comportement actuel (ouvre le
  // sélecteur d'options le temps de confirmer, jamais la fiche détail).
  return (
    <div className="hn-card" onClick={() => navigate(`/product/hanout/${p.id}`)}
      style={{ background:'#fff', borderRadius:14, overflow:'hidden', border:'1px solid #E5E7EB', display:'flex', flexDirection:'column', transition:'box-shadow .2s, transform .15s', cursor:'pointer' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.10)'; e.currentTarget.style.transform='translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='none'; }}>
      <div style={{ position:'relative', height:140, background:'#F9FAFB', flexShrink:0 }}>
        {imgSrc
          ? <img src={imgSrc} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36 }}><PremiumIcon name="shopping" size={34} /></div>
        }
        {hasDiscount && <span style={{ position:'absolute', top:8, left:8, background:'#EF4444', color:'#fff', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20 }}>-{discount}%</span>}
        {!p.available && <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ color:'#fff', fontWeight:700, fontSize:13 }}>Indisponible</span></div>}
        {p.track_stock && p.stock_quantity !== null && p.stock_quantity <= 5 && p.available && (
          <span style={{ position:'absolute', bottom:6, right:6, background:'rgba(245,158,11,.9)', color:'#fff', fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:20 }}><PremiumIcon name="alert" size={12} /> {p.stock_quantity} restant{p.stock_quantity !== 1 ? 's' : ''}</span>
        )}
        {hasOptions && (
          <span style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,.45)', color:'#fff', fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:20 }}>Options ▸</span>
        )}
        <ShareButton compact title={p.name} text={`${p.name} — ${Number(p.price).toFixed(2)} MAD sur iFilino`} url={`${window.location.origin}/h/${slug}?add=${p.id}`}
          style={{ position:'absolute', bottom:8, left:8 }} />
      </div>
      <div style={{ padding:12, flex:1, display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ fontWeight:700, fontSize:14, color:'#111827', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{p.name}</div>
        {p.category && <span style={{ fontSize:11, color:'#6B7280' }}>{p.category.icon} {p.category.name}</span>}
        {p.description && <p style={{ fontSize:12, color:'#6B7280', margin:0, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{p.description}</p>}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:'auto' }}>
          <div>
            <span style={{ fontWeight:800, fontSize:16, color:theme.primary }}>{Number(p.price).toFixed(2)} MAD</span>
            {hasDiscount && <span style={{ fontSize:11, color:'#9CA3AF', textDecoration:'line-through', marginLeft:4 }}>{Number(p.compare_price).toFixed(2)}</span>}
            <span style={{ fontSize:10, color:'#9CA3AF', marginLeft:3 }}>/{p.unit}</span>
          </div>
          <button onClick={e => { e.stopPropagation(); onOpen(p); }} disabled={!p.available}
            style={{ marginLeft:'auto', padding:'7px 14px', borderRadius:10, border:'none', background: p.available ? theme.primary : '#E5E7EB', color:'#fff', fontWeight:700, fontSize:12, cursor:p.available ? 'pointer' : 'default', transition:'all .2s', flexShrink:0 }}>
            {hasOptions ? <span className="premium-inline-icon"><PremiumIcon name="settings" size={14} /> Choisir</span> : '+ Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Le tiroir panier n'a plus de formulaire de commande embarqué — voir
// CartPreviewDrawer (shared/components/marketplace/), qui redirige vers la
// page de commande unifiée (CheckoutPage.jsx, branchée sur cart.module) au
// lieu de dupliquer un 2ᵉ tunnel de commande propre au hanout.

/* ══ PAGE PRINCIPALE ═══════════════════════════════════════════════════════ */
export default function HanoutPage() {
  const { slug } = useParams();
  const navigate  = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { cart: sharedCart } = useCart();
  const { authHeader } = useCustomerAuth();
  const [listImportWarning, setListImportWarning] = useState(null);
  const [showCartConflict, setShowCartConflict] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null);

  const [hanout, setHanout]       = useState(null);
  const [products, setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [prodLoading, setProdLoading] = useState(false);
  const [error, setError]         = useState('');

  const cart = useHanoutCart(slug, hanout?.name);

  const [q, setQ]                 = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [cartOpen, setCartOpen]   = useState(false);
  const [activeTab, setActiveTab] = useState('Produits');
  const [trackNum, setTrackNum]   = useState('');
  const [trackResult, setTrackResult] = useState(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [modalProduct, setModalProduct] = useState(null);

  const debRef = useRef(null);
  const theme = BTYPE_THEME[hanout?.business_type] || DEFAULT_THEME;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [slug]);

  // Charger la fiche hanout
  useEffect(() => {
    setLoading(true);
    fetch(API(`/hanout/${slug}`))
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setHanout(d);
        setCategories(d.categories || []);
      })
      .catch(() => setError('Impossible de charger ce hanout'))
      .finally(() => setLoading(false));
  }, [slug]);

  // Charger les produits avec debounce
  const loadProducts = useCallback(() => {
    if (!hanout) return;
    setProdLoading(true);
    const qs = new URLSearchParams({ limit: 100 });
    if (q.trim())   qs.set('q', q.trim());
    if (catFilter)  qs.set('category_id', catFilter);
    fetch(API(`/hanout/${slug}/products?${qs}`))
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .catch(() => {})
      .finally(() => setProdLoading(false));
  }, [hanout, q, catFilter, slug]);

  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(loadProducts, 250);
    return () => clearTimeout(debRef.current);
  }, [loadProducts]);

  // Lien profond depuis une carte produit marketplace (?add=<id>) — ouvre le
  // même modal qu'un clic normal sur la carte (gère aussi bien l'ajout direct
  // que la sélection d'options), puis nettoie l'URL pour ne pas rouvrir au
  // moindre refresh.
  useEffect(() => {
    const addId = searchParams.get('add');
    if (!addId || !products.length) return;
    const product = products.find(p => String(p.id) === addId);
    if (product) setModalProduct(product);
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete('add'); return p; }, { replace: true });
  }, [searchParams, products]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lien profond depuis "Commander cette liste" (?add_list=<id>&only_org=<orgId>)
  // — pré-remplit le panier local avec les quantités exactes des articles de la
  // liste vendus par CE hanout, ouvre directement le tiroir panier (sans passer
  // par ProductModal), et signale les articles non trouvés/nécessitant des
  // options (jamais devinées automatiquement).
  useEffect(() => {
    const listId = searchParams.get('add_list');
    const onlyOrg = searchParams.get('only_org');
    if (!listId || !products.length || !hanout) return;
    if (onlyOrg && String(hanout.organization_id) !== onlyOrg) return;

    fetch(API(`/dashboard/lists`), { headers: authHeader })
      .then(r => r.json())
      .then(d => {
        const list = (d.lists || []).find(l => String(l.id) === listId);
        if (!list) return;
        const candidates = (list.items || []).filter(i => i.source_module === 'hanout' && !i.checked);

        const entries = [];
        const notFound = [];
        for (const it of candidates) {
          const product = products.find(p => p.id === it.source_product_id);
          if (!product) { notFound.push(it.name); continue; }
          if (product.options?.length) { notFound.push(it.name); continue; }
          entries.push({ product, qty: Math.max(1, Math.round(it.quantity_value || 1)) });
        }
        if (entries.length) cart.addMany(entries);
        if (notFound.length) setListImportWarning(notFound);
        setCartOpen(true);
      })
      .catch(() => {});

    setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete('add_list'); p.delete('only_org'); return p; }, { replace: true });
  }, [searchParams, products, hanout]); // eslint-disable-line react-hooks/exhaustive-deps

  // Panier partagé déjà occupé par un autre commerce (resto ou autre hanout) —
  // proposer de le vider plutôt que de le remplacer silencieusement (même
  // garde que RestaurantPage/ProductCard, désormais valable aussi côté hanout
  // puisque le panier est commun).
  function handleAddToCart(product) {
    if (sharedCart && sharedCart.orgSlug !== slug) {
      setPendingProduct(product);
      setShowCartConflict(true);
      return;
    }
    cart.add(product);
  }
  function confirmClearAndAdd() {
    cart.add(pendingProduct);
    setPendingProduct(null);
    setShowCartConflict(false);
  }

  async function trackOrder() {
    if (!trackNum.trim()) return;
    setTrackLoading(true); setTrackResult(null);
    try {
      const res  = await fetch(API(`/hanout/track/${trackNum.trim().toUpperCase()}`));
      const data = await res.json();
      setTrackResult(data);
    } catch { setTrackResult({ error: 'Erreur réseau' }); }
    setTrackLoading(false);
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#F9FAFB', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <Spinner />
    </div>
  );
  if (error) return (
    <div style={{ minHeight:'100vh', background:'#F9FAFB', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}>
      <PremiumIconBadge name="store" size={34} />
      <div style={{ fontWeight:700, fontSize:18, color:'#111827' }}>Hanout introuvable</div>
      <button onClick={() => navigate('/marketplace')} style={{ padding:'10px 24px', background:theme.primary, border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer' }}>← Marketplace</button>
    </div>
  );

  const byCategory = categories.reduce((acc, cat) => {
    acc[cat.id] = products.filter(p => p.category_id === cat.id);
    return acc;
  }, {});
  const uncategorized = products.filter(p => !p.category_id);

  return (
    <>
      <style>{`
        @keyframes hn-spin { to { transform: rotate(360deg) } }
        @keyframes hn-slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
        .hn-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,.1); transform: translateY(-2px); }
        .hn-cat-pill { padding: 6px 14px; border-radius: 20px; border: 1.5px solid #E5E7EB; background: #fff; cursor: pointer; font-size: 13px; font-weight: 600; color: #374151; transition: all .15s; }
        .hn-cat-pill.active { border-color: ${theme.primary}; background: ${theme.light}; color: ${theme.dark}; }
        .hn-cat-pill:hover { border-color: ${theme.primary}; color: ${theme.dark}; }
      `}</style>

      <div style={{ minHeight:'100vh', background:'#F9FAFB' }}>

        {/* ── NAVBAR ── */}
        <nav style={{ position:'sticky', top:0, zIndex:200, background:'rgba(255,255,255,.95)', backdropFilter:'blur(12px)', borderBottom:'1px solid #E5E7EB', padding:'0 clamp(12px,4vw,32px)', display:'flex', alignItems:'center', height:56, gap:10 }}>
          <button onClick={() => navigate('/marketplace')} style={{ background:'none', border:'none', color:'#6B7280', cursor:'pointer', fontSize:20, padding:'4px 6px', display:'flex', alignItems:'center' }}>←</button>
          <div style={{ fontWeight:700, fontSize:15, color:'#111827', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', flex:1 }}>{hanout.name}</div>
          <button onClick={() => setCartOpen(true)} style={{ position:'relative', background:theme.primary, border:'none', borderRadius:10, width:40, height:40, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'#fff', flexShrink:0 }}>
            <PremiumIcon name="cart" size={19} />
            {cart.count > 0 && <span style={{ position:'absolute', top:-6, right:-6, background:'#EF4444', color:'#fff', borderRadius:'50%', width:18, height:18, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{cart.count}</span>}
          </button>
        </nav>

        {/* ── HERO ── (mêmes dimensions que le Hero marketplace) */}
        <div className="mk-hero" style={{ position:'relative', height:'clamp(420px,62vh,680px)', overflow:'hidden' }}>
          <StoreHeroCarousel
            organizationId={hanout.organization_id}
            businessType={hanout.business_type}
            orgName={hanout.name}
            logoUrl={hanout.logo_url}
            fallbackCoverUrl={hanout.cover_url}
            fallbackSubtitle={`${[hanout.district, hanout.city].filter(Boolean).join(', ') || 'Position non renseignée'}`}
          />
        </div>

        {/* ── INFO RAPIDE ── */}
        <div style={{ background:'#fff', borderBottom:'1px solid #E5E7EB', padding:'12px clamp(12px,4vw,32px)', display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
          {hanout.total_reviews > 0 && (
            <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:13, fontWeight:700, color:'#111827' }}>
              ⭐ {Number(hanout.avg_rating).toFixed(1)} <span style={{ color:'#9CA3AF', fontWeight:500 }}>({hanout.total_reviews})</span>
            </span>
          )}
          {hanout.is_open != null && (
            <span style={{ fontSize:12, fontWeight:700, color: hanout.is_open ? '#059669' : '#EF4444', background: hanout.is_open ? '#F0FDF4' : '#FEF2F2', padding:'3px 10px', borderRadius:20 }}>
              ● {hanout.is_open ? 'Ouvert' : 'Fermé'}
            </span>
          )}
          {hanout.phone && <a href={`tel:${hanout.phone}`} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:theme.primary, fontWeight:600, textDecoration:'none' }}><PremiumIcon name="phone" size={14} /> {hanout.phone}</a>}
          {hanout.whatsapp && <a href={`https://wa.me/${hanout.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#25D366', fontWeight:600, textDecoration:'none' }}><PremiumIcon name="whatsapp" size={14} /> WhatsApp</a>}
          <span style={{ fontSize:13, color:'#6B7280' }}><PremiumIcon name="package" size={14} /> {hanout.product_count} produit{hanout.product_count !== 1 ? 's' : ''}</span>
          <ShareButton title={hanout.name} text={`${hanout.name} sur iFilino`} url={window.location.href}
            className="" style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:theme.primary, fontWeight:600, background:'none', border:'none', cursor:'pointer', padding:0 }}>
            <PremiumIcon name="share" size={14} /> Partager
          </ShareButton>
        </div>

        {/* ── ONGLETS ── */}
        <div style={{ background:'#fff', borderBottom:'1px solid #E5E7EB', padding:'0 clamp(12px,4vw,32px)', display:'flex', gap:4, overflowX:'auto' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ padding:'12px 16px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight:700, color: activeTab===t ? theme.dark : '#6B7280', borderBottom: activeTab===t ? `2.5px solid ${theme.primary}` : '2.5px solid transparent', whiteSpace:'nowrap', transition:'all .15s' }}>
              {t}
            </button>
          ))}
        </div>

        <div className="store-layout-with-sidebar">
          <StoreSidebar
            store={hanout}
            type="hanout"
            theme={theme}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={TABS}
            searchValue={q}
            onSearchChange={setQ}
            searchPlaceholder="Rechercher un produit..."
            categories={categories.map(c => ({ ...c, count: byCategory[c.id]?.length || 0 }))}
            activeCategory={catFilter}
            onCategoryChange={setCatFilter}
            cartCount={cart.count}
            cartTotal={cart.total}
            onCartOpen={() => setCartOpen(true)}
          />
          <main className="store-main-content">

          {activeTab === 'Produits' && (
            <>
              {/* ── RECHERCHE ── */}
              <div style={{ display:'flex', gap:10, alignItems:'center', background:'#fff', borderRadius:14, padding:'10px 14px', border:'1px solid #E5E7EB', boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
                <PremiumIcon name="search" size={16} style={{ color:'#9CA3AF' }} />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un produit…" style={{ flex:1, border:'none', outline:'none', fontSize:14, color:'#111827', background:'transparent' }} />
                {q && <button onClick={() => setQ('')} style={{ background:'none', border:'none', color:'#9CA3AF', cursor:'pointer', fontSize:14 }}>✕</button>}
              </div>

              {/* ── FILTRES CATÉGORIES ── */}
              {categories.length > 0 && (
                <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4 }}>
                  <button onClick={() => setCatFilter('')} className={`hn-cat-pill${catFilter===''?' active':''}`}>Tout</button>
                  {categories.map(c => (
                    <button key={c.id} onClick={() => setCatFilter(catFilter === String(c.id) ? '' : String(c.id))} className={`hn-cat-pill${catFilter===String(c.id)?' active':''}`} style={{ whiteSpace:'nowrap' }}>
                      {c.icon} {c.name}
                    </button>
                  ))}
                </div>
              )}

              {/* ── GRILLE PRODUITS ── */}
              {prodLoading ? <Spinner theme={theme} /> : products.length === 0 ? (
                <div style={{ textAlign:'center', padding:48, color:'#9CA3AF' }}>
                  <div style={{ display:'grid', placeItems:'center', color:'#9CA3AF', marginBottom:8 }}><PremiumIconBadge name="package" size={30} /></div>
                  <div style={{ fontWeight:600 }}>Aucun produit trouvé</div>
                </div>
              ) : (
                catFilter === '' && categories.length > 0
                  ? <>
                      {categories.map(cat => byCategory[cat.id]?.length > 0 && (
                        <section key={cat.id}>
                          <h2 style={{ margin:'0 0 14px', fontSize:16, fontWeight:800, color:'#111827', display:'flex', alignItems:'center', gap:8 }}>
                            <PremiumIcon name="package" size={17} />{cat.name}
                            <span style={{ fontSize:12, color:'#9CA3AF', fontWeight:400 }}>({byCategory[cat.id].length})</span>
                          </h2>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:14 }}>
                            {byCategory[cat.id].map(p => <ProductCard key={p.id} p={p} onOpen={setModalProduct} theme={theme} />)}
                          </div>
                        </section>
                      ))}
                      {uncategorized.length > 0 && (
                        <section>
                          <h2 style={{ margin:'0 0 14px', fontSize:16, fontWeight:800, color:'#111827' }}><span className="premium-inline-icon"><PremiumIcon name="shopping" size={17} /> Autres produits</span></h2>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:14 }}>
                            {uncategorized.map(p => <ProductCard key={p.id} p={p} onOpen={setModalProduct} theme={theme} />)}
                          </div>
                        </section>
                      )}
                    </>
                  : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:14 }}>
                      {products.map(p => <ProductCard key={p.id} p={p} onOpen={setModalProduct} theme={theme} slug={slug} />)}
                    </div>
              )}

              {/* ── SUIVI COMMANDE ── */}
              <section style={{ background:'#fff', borderRadius:16, padding:'20px 20px', border:'1px solid #E5E7EB', boxShadow:'0 2px 8px rgba(0,0,0,.04)' }}>
                <h2 style={{ margin:'0 0 14px', fontSize:15, fontWeight:800, color:'#111827' }}><span className="premium-inline-icon"><PremiumIcon name="package" size={17} /> Suivre ma commande</span></h2>
                <div style={{ display:'flex', gap:8 }}>
                  <input value={trackNum} onChange={e => setTrackNum(e.target.value)} onKeyDown={e => e.key==='Enter' && trackOrder()} placeholder="Ex: HNT-20260629-A1B2C3" style={{ flex:1, padding:'10px 12px', border:'1.5px solid #E5E7EB', borderRadius:10, fontSize:13, outline:'none' }} />
                  <button onClick={trackOrder} disabled={trackLoading} style={{ padding:'10px 18px', background:theme.primary, border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer', fontSize:13, flexShrink:0 }}>
                    {trackLoading ? '…' : 'Suivre'}
                  </button>
                </div>
                {trackResult && !trackResult.error && (
                  <div style={{ marginTop:14, padding:'14px 16px', borderRadius:12, background:`${STATUS_COLOR[trackResult.status]}15`, border:`1.5px solid ${STATUS_COLOR[trackResult.status]}50` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                      <span style={{ fontWeight:800, fontSize:14, color:'#111827' }}>{trackResult.order_number}</span>
                      <span style={{ fontSize:12, fontWeight:700, color: STATUS_COLOR[trackResult.status], background: `${STATUS_COLOR[trackResult.status]}20`, padding:'3px 10px', borderRadius:20 }}>● {STATUS_LABEL[trackResult.status]}</span>
                    </div>
                    <div style={{ fontSize:12, color:'#6B7280' }}>Client : {trackResult.customer_name} · {trackResult.delivery_type === 'pickup' ? 'Retrait' : 'Livraison'} · {Number(trackResult.total).toFixed(2)} MAD</div>
                  </div>
                )}
                {trackResult?.error && <div style={{ marginTop:10, color:'#EF4444', fontSize:13 }}>{trackResult.error}</div>}
              </section>
            </>
          )}

          {activeTab === 'Avis' && (hanout.business_id || hanout.id ? <BusinessReviewsSection businessId={hanout.business_id || hanout.id} /> : <ReviewsSection slug={slug} theme={theme} />)}

          {activeTab === 'Infos' && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
              <div style={{ background:'#fff', borderRadius:16, padding:20, border:'1px solid #E5E7EB' }}>
                <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:700, color:'#111827' }}><span className="premium-inline-icon"><PremiumIcon name="package" size={17} /> Contact & Infos</span></h3>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {hanout.address && <div style={{ fontSize:13, color:'#374151' }}><span style={{ color:'#9CA3AF' }}>Adresse :</span> {hanout.address}{hanout.city && `, ${hanout.city}`}</div>}
                  {hanout.phone && <div style={{ fontSize:13 }}><span style={{ color:'#9CA3AF' }}>Tél :</span> <a href={`tel:${hanout.phone}`} style={{ color:theme.primary, fontWeight:600, textDecoration:'none' }}>{hanout.phone}</a></div>}
                  {hanout.whatsapp && <div style={{ fontSize:13 }}><span style={{ color:'#9CA3AF' }}>WhatsApp :</span> <a href={`https://wa.me/${hanout.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" style={{ color:'#25D366', fontWeight:600, textDecoration:'none' }}>{hanout.whatsapp}</a></div>}
                </div>
              </div>

              <div style={{ background:'#fff', borderRadius:16, padding:20, border:'1px solid #E5E7EB' }}>
                <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:700, color:'#111827' }}><span className="premium-inline-icon"><PremiumIcon name="clock" size={17} /> Horaires</span></h3>
                <OpeningHours hours={hanout.opening_hours} theme={theme} />
              </div>

              {hanout.latitude && hanout.longitude && (
                <div style={{ background:'#fff', borderRadius:16, padding:20, border:'1px solid #E5E7EB' }}>
                  <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:700, color:'#111827' }}><span className="premium-inline-icon"><PremiumIcon name="mapPin" size={17} /> Localisation</span></h3>
                  <HanoutMiniMap lat={hanout.latitude} lng={hanout.longitude} name={hanout.name} theme={theme} />
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${hanout.latitude},${hanout.longitude}`} target="_blank" rel="noopener noreferrer" style={{ display:'block', marginTop:12, textAlign:'center', padding:'10px', background:theme.primary, color:'#fff', borderRadius:10, textDecoration:'none', fontWeight:700, fontSize:13 }}>
                    <PremiumIcon name="directions" size={15} /> Itinéraire Google Maps
                  </a>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Horaires' && (
            <div style={{ background:'#fff', borderRadius:16, padding:24, border:'1px solid #E5E7EB', maxWidth:480 }}>
              <h3 style={{ margin:'0 0 16px', fontSize:16, fontWeight:700, color:'#111827' }}><span className="premium-inline-icon"><PremiumIcon name="clock" size={17} /> Horaires</span> d'ouverture</h3>
              <OpeningHours hours={hanout.opening_hours} />
            </div>
          )}
          </main>
        </div>

        {/* ── FAB PANIER ── */}
        {cart.count > 0 && !cartOpen && (
          <button onClick={() => setCartOpen(true)} style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:400, display:'flex', alignItems:'center', gap:10, padding:'13px 24px', background:`linear-gradient(135deg,${theme.primary},${theme.dark})`, border:'none', borderRadius:999, color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer', boxShadow:`0 8px 24px ${theme.glow}`, whiteSpace:'nowrap' }}>
            <PremiumIcon name="cart" size={16} /> Voir le panier ({cart.count}) — {cart.total.toFixed(2)} MAD
          </button>
        )}

        {listImportWarning && (
          <div style={{ position:'fixed', bottom:cart.count>0 ? 90 : 24, left:'50%', transform:'translateX(-50%)', zIndex:401, maxWidth:'90vw', background:'#FEF3C7', border:'1px solid #F59E0B', borderRadius:12, padding:'10px 16px', display:'flex', alignItems:'center', gap:10, boxShadow:'0 8px 24px rgba(0,0,0,.12)' }}>
            <span style={{ fontSize:13, color:'#92400E' }}>
              <PremiumIcon name="alert" size={14} /> {listImportWarning.length} article{listImportWarning.length>1?'s':''} de la liste introuvable{listImportWarning.length>1?'s':''} ici : {listImportWarning.join(', ')}
            </span>
            <button onClick={() => setListImportWarning(null)} style={{ background:'none', border:'none', color:'#92400E', fontWeight:700, cursor:'pointer', fontSize:16 }}>×</button>
          </div>
        )}

        <CartPreviewDrawer open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} businessName={hanout?.name} theme={theme} />

        {modalProduct && (
          <ProductModal
            product={modalProduct}
            hanoutName={hanout?.name}
            slug={slug}
            theme={{ primary: theme.primary, dark: theme.dark }}
            onClose={() => setModalProduct(null)}
            onAddToCart={product => { handleAddToCart(product); setModalProduct(null); }}
          />
        )}

        <CartConflictModal
          show={showCartConflict}
          currentOrgName={sharedCart?.orgName}
          targetOrgName={hanout?.name}
          onCancel={() => { setShowCartConflict(false); setPendingProduct(null); }}
          onConfirm={confirmClearAndAdd}
        />
      </div>
    </>
  );
}
