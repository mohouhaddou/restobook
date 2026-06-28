import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import L from 'leaflet';
import { API, ASSET } from '../api';
import { useCart } from '../contexts/CartContext';

/* ══ CONSTANTS ══════════════════════════════════════════════════════════ */

const TYPE_LABELS = { canteen:'Cantine', restaurant:'Restaurant', snack:'Snack', dark_kitchen:'Dark Kitchen', bakery:'Boulangerie', cafe:'Café' };
const TYPE_ICONS  = { canteen:'🏢', restaurant:'🍽️', snack:'🥙', dark_kitchen:'📦', bakery:'🥐', cafe:'☕' };
const DAY_NAMES   = { mon:'Lundi', tue:'Mardi', wed:'Mercredi', thu:'Jeudi', fri:'Vendredi', sat:'Samedi', sun:'Dimanche' };
const DAYS_ORDER  = ['mon','tue','wed','thu','fri','sat','sun'];

/* ══ HOOKS ══════════════════════════════════════════════════════════════ */

function useTheme() {
  return localStorage.getItem('mk-theme') ||
    (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
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

/* ══ MINI-MAP ══════════════════════════════════════════════════════════ */

function RestaurantMiniMap({ lat, lng, name, theme }) {
  const ref = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!ref.current || mapRef.current || !lat || !lng) return;
    const map = L.map(ref.current, { center:[lat,lng], zoom:15, zoomControl:false, attributionControl:false, dragging:false, scrollWheelZoom:false });
    L.tileLayer(
      theme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { maxZoom:19 }
    ).addTo(map);
    const icon = L.divIcon({ className:'', html:`<div style="background:#FF8A00;color:#fff;font-size:16px;width:38px;height:38px;border-radius:50% 50% 50% 4px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.3);transform:rotate(-45deg);border:2.5px solid #fff"><span style="transform:rotate(45deg)">${TYPE_ICONS['restaurant']}</span></div>`, iconSize:[38,38], iconAnchor:[19,38] });
    L.marker([lat,lng], { icon }).addTo(map).bindPopup(name);
    mapRef.current = map;
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [lat, lng]);

  if (!lat || !lng) return null;
  return <div ref={ref} style={{ width:'100%', height:220, borderRadius:14, border:'1px solid var(--mk-border)' }} />;
}

/* ══ GALLERY LIGHTBOX ═══════════════════════════════════════════════════ */

function GalleryLightbox({ images, open, startIdx, onClose }) {
  const [idx, setIdx] = useState(startIdx || 0);
  useEffect(() => setIdx(startIdx || 0), [startIdx]);

  useEffect(() => {
    if (!open) return;
    const handler = e => {
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(0, i-1));
      if (e.key === 'ArrowRight') setIdx(i => Math.min(images.length-1, i+1));
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, images.length, onClose]);

  if (!open || !images.length) return null;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,.94)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', animation:'mk-fadeIn .2s' }}>
      <button onClick={onClose} style={{ position:'absolute', top:20, right:20, background:'rgba(255,255,255,.15)', border:'none', borderRadius:12, width:42, height:42, color:'#fff', fontSize:20, cursor:'pointer', display:'grid', placeItems:'center' }}>✕</button>
      <div style={{ fontSize:12, color:'rgba(255,255,255,.5)', marginBottom:12 }}>{idx+1} / {images.length}</div>
      <div style={{ position:'relative', maxWidth:'90vw', maxHeight:'75vh', display:'flex', alignItems:'center', gap:16 }}>
        <button onClick={() => setIdx(i => Math.max(0,i-1))} disabled={idx===0} style={{ position:'absolute', left:-50, width:40, height:40, borderRadius:'50%', background:idx===0?'transparent':'rgba(255,255,255,.15)', border:'none', color:'#fff', fontSize:20, cursor:idx===0?'default':'pointer', display:'grid', placeItems:'center', opacity:idx===0?.2:1 }}>‹</button>
        <img src={images[idx]} alt="" style={{ maxWidth:'88vw', maxHeight:'72vh', objectFit:'contain', borderRadius:12 }} />
        <button onClick={() => setIdx(i => Math.min(images.length-1,i+1))} disabled={idx===images.length-1} style={{ position:'absolute', right:-50, width:40, height:40, borderRadius:'50%', background:idx===images.length-1?'transparent':'rgba(255,255,255,.15)', border:'none', color:'#fff', fontSize:20, cursor:idx===images.length-1?'default':'pointer', display:'grid', placeItems:'center', opacity:idx===images.length-1?.2:1 }}>›</button>
      </div>
      {/* Thumbnail strip */}
      <div style={{ display:'flex', gap:8, marginTop:16, overflowX:'auto', maxWidth:'90vw', padding:'4px 4px' }}>
        {images.map((url,i) => (
          <img key={i} src={url} alt="" onClick={()=>setIdx(i)} style={{ width:60, height:60, objectFit:'cover', borderRadius:8, cursor:'pointer', border:`2px solid ${i===idx?'#FF8A00':'transparent'}`, flexShrink:0, transition:'border-color .15s', opacity:i===idx?1:.6 }} />
        ))}
      </div>
    </div>
  );
}

/* ══ OPENING HOURS ══════════════════════════════════════════════════════ */

function OpeningHours({ hours }) {
  if (!hours) return <div style={{ fontSize:13, color:'var(--mk-muted)' }}>Horaires non renseignés</div>;

  const today = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      {DAYS_ORDER.map(day => {
        const slot = hours[day];
        const isToday = day === today;
        return (
          <div key={day} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'5px 8px', borderRadius:8, background: isToday ? 'var(--mk-orange-light)' : 'transparent' }}>
            <span style={{ fontWeight:isToday?700:400, color:isToday?'var(--mk-orange)':'var(--mk-text)' }}>{DAY_NAMES[day]}{isToday?' (aujourd\'hui)':''}</span>
            <span style={{ color:slot?.closed?'var(--mk-red)':isToday?'var(--mk-orange)':'var(--mk-muted)', fontWeight:500 }}>
              {!slot ? '—' : slot.closed ? 'Fermé' : `${slot.open||'00:00'} – ${slot.close||'23:59'}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ══ REVIEWS SECTION ════════════════════════════════════════════════════ */

function ReviewsSection({ slug }) {
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
      {/* Summary */}
      <div style={{ display:'flex', gap:28, flexWrap:'wrap', marginBottom:20 }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:44, fontWeight:800, color:'var(--mk-text)', lineHeight:1 }}>{Number(meta.avg_rating).toFixed(1)}</div>
          <div style={{ color:'#F59E0B', fontSize:18, margin:'4px 0' }}>{'★'.repeat(Math.round(meta.avg_rating))}{'☆'.repeat(5-Math.round(meta.avg_rating))}</div>
          <div style={{ fontSize:12, color:'var(--mk-muted)' }}>{meta.total} avis</div>
        </div>
        <div style={{ flex:1, minWidth:200 }}>
          {[5,4,3,2,1].map(n => (
            <div key={n} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ fontSize:12, color:'var(--mk-muted)', width:12, textAlign:'right' }}>{n}</span>
              <span style={{ color:'#F59E0B', fontSize:12 }}>★</span>
              <div style={{ flex:1, height:6, background:'var(--mk-border)', borderRadius:4, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${(meta.distribution[n]/maxCount)*100}%`, background:'#F59E0B', borderRadius:4, transition:'width .5s' }} />
              </div>
              <span style={{ fontSize:11, color:'var(--mk-muted)', width:20, textAlign:'right' }}>{meta.distribution[n]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sort */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {[{v:'recent',l:'Récents'},{v:'rating_high',l:'Mieux notés'},{v:'rating_low',l:'Moins biens'}].map(({v,l}) => (
          <button key={v} onClick={()=>setSort(v)} className={`mk-pill${sort===v?' active':''}`}>{l}</button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'20px', color:'var(--mk-muted)' }}>
          <span className="mk-spin" style={{ display:'inline-block', width:24, height:24, border:'2px solid var(--mk-border)', borderTopColor:'var(--mk-orange)', borderRadius:'50%' }} />
        </div>
      ) : reviews.length === 0 ? (
        <div style={{ textAlign:'center', padding:'32px', color:'var(--mk-muted)', fontSize:14 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>💬</div>
          Aucun avis pour le moment. Soyez le premier !
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {reviews.map(r => (
            <div key={r.id} style={{ background:'var(--mk-surface)', borderRadius:14, padding:'16px', border:'1px solid var(--mk-border)' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,var(--mk-orange),#FBBF24)', display:'grid', placeItems:'center', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0 }}>
                    {(r.author||'A')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14, color:'var(--mk-text)' }}>{r.author}</div>
                    <div style={{ fontSize:11, color:'var(--mk-muted)' }}>{new Date(r.created_at).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })}</div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ color:'#F59E0B', fontSize:14 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--mk-text)', marginLeft:4 }}>{r.rating}.0</span>
                </div>
              </div>
              {r.comment && <p style={{ margin:0, fontSize:13, color:'var(--mk-text2)', lineHeight:1.55 }}>{r.comment}</p>}
              {r.sentiment && (
                <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                  {r.ai_summary?.strengths?.slice(0,2).map((s,i) => <span key={i} style={{ fontSize:10, background:'var(--mk-green-light)', color:'var(--mk-green)', padding:'2px 8px', borderRadius:20, fontWeight:600 }}>+ {s}</span>)}
                  {r.ai_summary?.improvements?.slice(0,1).map((s,i) => <span key={i} style={{ fontSize:10, background:'rgba(234,88,12,.1)', color:'var(--mk-orange)', padding:'2px 8px', borderRadius:20, fontWeight:600 }}>! {s}</span>)}
                </div>
              )}
            </div>
          ))}
          {pages > 1 && (
            <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:8 }}>
              <button onClick={()=>load(page-1)} disabled={page<=1} style={{ padding:'7px 16px', borderRadius:8, border:'1px solid var(--mk-border)', background:'var(--mk-surface)', color:page<=1?'var(--mk-muted)':'var(--mk-text)', cursor:page<=1?'default':'pointer', fontSize:12, fontWeight:600, opacity:page<=1?.5:1 }}>← Précédent</button>
              <button onClick={()=>load(page+1)} disabled={page>=pages} style={{ padding:'7px 16px', borderRadius:8, border:'1px solid var(--mk-border)', background:'var(--mk-surface)', color:page>=pages?'var(--mk-muted)':'var(--mk-text)', cursor:page>=pages?'default':'pointer', fontSize:12, fontWeight:600, opacity:page>=pages?.5:1 }}>Suivant →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══ ITEM CARD ══════════════════════════════════════════════════════════ */

function ItemCard({ item, onAdd, qty }) {
  const [added, setAdded] = useState(false);
  const available = item.is_available !== false && item.prix !== null;

  function handleAdd() {
    onAdd(item);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <div style={{ display:'flex', gap:14, padding:'16px 0', borderBottom:'1px solid var(--mk-border2)', alignItems:'flex-start', opacity:available?1:.45 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:15, color:'var(--mk-text)', lineHeight:1.3 }}>{item.libelle}</div>
        {item.description && <div style={{ fontSize:13, color:'var(--mk-muted)', marginTop:4, lineHeight:1.45, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{item.description}</div>}
        <div style={{ display:'flex', gap:8, marginTop:8, alignItems:'center', flexWrap:'wrap' }}>
          {item.prix !== null && <span style={{ fontWeight:800, color:'var(--mk-orange)', fontSize:15 }}>{Number(item.prix).toFixed(2)} MAD</span>}
          {item.calories && <span style={{ fontSize:11, color:'var(--mk-muted)', background:'var(--mk-pill)', padding:'1px 7px', borderRadius:20 }}>{item.calories} kcal</span>}
          {item.allergenes && item.allergenes.length > 0 && <span style={{ fontSize:11, color:'var(--mk-muted)' }}>⚠️ Allergènes</span>}
          {!available && <span style={{ fontSize:11, color:'var(--mk-red)', fontWeight:700, background:'rgba(239,68,68,.1)', padding:'1px 7px', borderRadius:20 }}>Indisponible</span>}
        </div>
      </div>
      <div style={{ position:'relative', flexShrink:0 }}>
        {item.image_url
          ? <img src={ASSET(item.image_url)} alt={item.libelle} style={{ width:90, height:90, objectFit:'cover', borderRadius:12, display:'block' }} />
          : <div style={{ width:90, height:90, borderRadius:12, background:'linear-gradient(135deg,rgba(255,138,0,.12),rgba(255,93,0,.2))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:30 }}>🍽️</div>
        }
        {available && (
          <button onClick={handleAdd} style={{
            position:'absolute', bottom:-10, right:-6,
            background: added ? '#16A34A' : qty > 0 ? 'var(--mk-orange)' : 'var(--mk-text)',
            color:'#fff', border:'none', borderRadius:'50%',
            width:32, height:32, fontSize: qty > 0 ? 12 : 20,
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 3px 10px rgba(0,0,0,.22)', transition:'background .2s, transform .1s',
            fontWeight:700,
          }}
            onMouseEnter={e=>e.currentTarget.style.transform='scale(1.12)'}
            onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
          >
            {added ? '✓' : qty > 0 ? qty : '+'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ══ CART SIDEBAR ═══════════════════════════════════════════════════════ */

function CartSidebar({ cart, total, onUpdateQty, onRemove, onCheckout, orgSlug }) {
  const active = cart && cart.orgSlug === orgSlug;
  const items  = active ? cart.items : [];

  if (!active || items.length === 0) {
    return (
      <div style={{ background:'var(--mk-surface)', borderRadius:16, padding:24, textAlign:'center', border:'1px solid var(--mk-border)' }}>
        <div style={{ fontSize:36, marginBottom:10 }}>🛒</div>
        <div style={{ fontSize:14, fontWeight:600, color:'var(--mk-text)', marginBottom:4 }}>Panier vide</div>
        <div style={{ fontSize:13, color:'var(--mk-muted)' }}>Ajoutez des plats pour commander</div>
      </div>
    );
  }

  const count = items.reduce((s,i) => s+i.quantity, 0);

  return (
    <div style={{ position:'sticky', top:80, background:'var(--mk-surface)', borderRadius:16, boxShadow:'var(--mk-shadow-md)', padding:20, border:'1px solid var(--mk-border)' }}>
      <div style={{ fontWeight:700, fontSize:15, marginBottom:14, color:'var(--mk-text)', display:'flex', alignItems:'center', gap:8 }}>
        <span>🛒 Panier</span>
        <span style={{ marginLeft:'auto', fontSize:12, color:'var(--mk-muted)', fontWeight:500 }}>{count} article{count>1?'s':''}</span>
      </div>
      <div style={{ marginBottom:14, display:'flex', flexDirection:'column', gap:8 }}>
        {items.map(item => (
          <div key={item.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ flex:1, fontSize:13, color:'var(--mk-text)', fontWeight:500 }}>{item.libelle}</div>
            <div style={{ display:'flex', alignItems:'center', gap:3, background:'var(--mk-pill)', borderRadius:8, padding:'2px 4px' }}>
              <button onClick={()=>onUpdateQty(item.id, item.quantity-1)} style={{ width:22, height:22, border:'none', borderRadius:6, cursor:'pointer', background:'var(--mk-surface)', fontSize:14, fontWeight:700, color:'var(--mk-text)', boxShadow:'var(--mk-shadow)', display:'grid', placeItems:'center' }}>−</button>
              <span style={{ fontSize:12, fontWeight:700, minWidth:16, textAlign:'center', color:'var(--mk-text)' }}>{item.quantity}</span>
              <button onClick={()=>onUpdateQty(item.id, item.quantity+1)} style={{ width:22, height:22, border:'none', borderRadius:6, cursor:'pointer', background:'var(--mk-surface)', fontSize:14, fontWeight:700, color:'var(--mk-text)', boxShadow:'var(--mk-shadow)', display:'grid', placeItems:'center' }}>+</button>
            </div>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--mk-text)', minWidth:52, textAlign:'right' }}>{(item.unit_price*item.quantity).toFixed(2)}</div>
            <button onClick={()=>onRemove(item.id)} style={{ background:'none', border:'none', color:'var(--mk-border)', cursor:'pointer', fontSize:13, padding:2 }}
              onMouseEnter={e=>e.currentTarget.style.color='var(--mk-red)'}
              onMouseLeave={e=>e.currentTarget.style.color='var(--mk-border)'}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ borderTop:'1px solid var(--mk-border)', paddingTop:12, marginBottom:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:15, color:'var(--mk-text)' }}>
          <span>Total</span>
          <span style={{ color:'var(--mk-orange)' }}>{total.toFixed(2)} MAD</span>
        </div>
      </div>
      <button onClick={onCheckout} style={{ width:'100%', padding:'14px', background:'var(--mk-orange)', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 14px rgba(234,88,12,.35)', transition:'opacity .15s, transform .1s' }}
        onMouseEnter={e=>{e.currentTarget.style.opacity='.9';e.currentTarget.style.transform='translateY(-1px)'}}
        onMouseLeave={e=>{e.currentTarget.style.opacity='1';e.currentTarget.style.transform='none'}}
      >
        Commander →
      </button>
    </div>
  );
}

/* ══ MAIN PAGE ══════════════════════════════════════════════════════════ */

const TABS = ['Menu','Avis','Infos','Horaires'];

export default function RestaurantPage() {
  const { slug } = useParams();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { cart, total, addItem, removeItem, updateQuantity } = useCart();
  const { isFav, toggle: toggleFav } = useFavorites();
  const theme = useTheme();

  const qrTableLabel = location.state?.tableLabel || null;
  const qrTableId    = location.state?.tableId    || null;
  const qrPreselect  = location.state?.preselect  || null;

  const [restaurant, setRestaurant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState('Menu');
  const [activeCategory, setActiveCategory] = useState(null);
  const [menuMode, setMenuMode]     = useState('carte'); // 'carte' | 'menu_du_jour'
  const [dailyMenu, setDailyMenu]   = useState(null);
  const [showConflict, setShowConflict]     = useState(false);
  const [pendingItem, setPendingItem]       = useState(null);
  const [showGallery, setShowGallery]       = useState(false);
  const [galleryIdx, setGalleryIdx]         = useState(0);
  const [favAnim, setFavAnim]               = useState(false);
  const [shareToast, setShareToast]         = useState(false);
  const [scrolled, setScrolled]             = useState(false);

  const catRefs = useRef({});

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 220);
    window.addEventListener('scroll', handler, { passive:true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const today = new Date().toISOString().slice(0, 10);
      const [r1, r2, r3] = await Promise.all([
          fetch(API(`/marketplace/restaurants/${slug}`)).then(r=>r.json()),
          fetch(API(`/marketplace/restaurants/${slug}/menu`)).then(r=>r.json()),
          fetch(API(`/marketplace/restaurants/${slug}/daily-menu?date=${today}`)).then(r=>r.json()).catch(()=>({ menu: null })),
        ]);
        setRestaurant(r1.restaurant || null);
        const cats = r2.categories || [];
        setCategories(cats);
        if (cats.length > 0) setActiveCategory(cats[0].id ?? cats[0].name);
        if (r3.menu && (r3.menu.items || []).length > 0) {
          setDailyMenu(r3.menu);
          setMenuMode('menu_du_jour');
        }
      } catch {}
      setLoading(false);
    }
    fetchData();
  }, [slug]);

  function handleAddItem(item) {
    if (cart && cart.orgSlug !== slug) { setPendingItem(item); setShowConflict(true); return; }
    addItem(slug, restaurant?.name || slug, { id:item.id, libelle:item.libelle, unit_price:Number(item.prix||0), image_url:item.image_url });
  }
  function confirmClearAndAdd() {
    addItem(slug, restaurant?.name || slug, { id:pendingItem.id, libelle:pendingItem.libelle, unit_price:Number(pendingItem.prix||0), image_url:pendingItem.image_url });
    setPendingItem(null); setShowConflict(false);
  }
  function getQty(itemId) {
    if (!cart || cart.orgSlug !== slug) return 0;
    return cart.items.find(i=>i.id===itemId)?.quantity || 0;
  }
  function scrollToCategory(key) {
    setActiveCategory(key);
    const el = catRefs.current[key];
    if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
  }
  function handleFav() {
    setFavAnim(true);
    toggleFav(slug);
    setTimeout(() => setFavAnim(false), 600);
  }
  function handleShare() {
    if (navigator.share) { navigator.share({ title:restaurant?.name, url:window.location.href }); }
    else { navigator.clipboard?.writeText(window.location.href); setShareToast(true); setTimeout(()=>setShareToast(false), 2500); }
  }

  const goToCheckout = () => navigate('/checkout', { state:{ tableLabel:qrTableLabel, tableId:qrTableId, preselect:qrPreselect } });
  const cartActive = cart && cart.orgSlug === slug;

  // Collect gallery images (cover + item images)
  const galleryImages = restaurant ? [
    restaurant.cover_url ? ASSET(restaurant.cover_url) : null,
    ...categories.flatMap(c => (c.items||[]).map(i => i.image_url ? ASSET(i.image_url) : null)),
  ].filter(Boolean).slice(0,20) : [];

  if (loading) return (
    <div className={`mk-wrap mk-${theme}`} style={{ minHeight:'100vh', background:'var(--mk-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14 }}>
      <div className="mk-spin" style={{ width:48, height:48, border:'3px solid var(--mk-border)', borderTopColor:'var(--mk-orange)', borderRadius:'50%' }} />
      <div style={{ color:'var(--mk-muted)', fontSize:14 }}>Chargement du menu…</div>
    </div>
  );

  if (!restaurant) return (
    <div className={`mk-wrap mk-${theme}`} style={{ minHeight:'100vh', background:'var(--mk-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:48 }}>🍽️</div>
      <div style={{ fontSize:18, fontWeight:700, color:'var(--mk-text)' }}>Restaurant introuvable</div>
      <button onClick={()=>navigate('/marketplace')} style={{ padding:'11px 24px', background:'var(--mk-orange)', color:'#fff', border:'none', borderRadius:10, cursor:'pointer', fontWeight:600 }}>← Retour</button>
    </div>
  );

  return (
    <div className={`mk-wrap mk-${theme}`} style={{ minHeight:'100vh', background:'var(--mk-bg)' }}>

      {/* ── STICKY HEADER (appears on scroll) ── */}
      <div style={{
        position:'fixed', top:0, left:0, right:0, zIndex:300,
        height:60, background:theme==='dark'?'rgba(7,13,26,.95)':'rgba(255,255,255,.95)',
        backdropFilter:'blur(16px)',
        borderBottom:'1px solid var(--mk-border)',
        display:'flex', alignItems:'center', padding:'0 clamp(14px,4vw,40px)', gap:12,
        transform: scrolled ? 'translateY(0)' : 'translateY(-100%)',
        transition:'transform .3s cubic-bezier(.4,0,.2,1)',
        boxShadow:'var(--mk-shadow)',
      }}>
        <button onClick={()=>navigate('/marketplace')} style={{ background:'var(--mk-pill)', border:'none', borderRadius:10, width:38, height:38, cursor:'pointer', fontSize:16, display:'grid', placeItems:'center', color:'var(--mk-text)', flexShrink:0 }}>←</button>
        {restaurant.logo_url && <img src={ASSET(restaurant.logo_url)} alt="" style={{ width:34, height:34, borderRadius:10, objectFit:'cover', border:'1px solid var(--mk-border)' }} />}
        <span style={{ fontWeight:700, fontSize:15, color:'var(--mk-text)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{restaurant.name}</span>
        {cartActive && cart.items.length > 0 && (
          <button onClick={goToCheckout} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10, border:'none', background:'var(--mk-orange)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700 }}>
            🛒 {total.toFixed(0)} MAD
          </button>
        )}
      </div>

      {/* ── COVER HERO ── */}
      <div style={{ position:'relative', overflow:'hidden', height:'clamp(220px,38vh,340px)' }}>
        {restaurant.cover_url
          ? <img src={ASSET(restaurant.cover_url)} alt={restaurant.name} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
          : <div style={{ width:'100%', height:'100%', background:'linear-gradient(135deg,#0F172A,#1E293B)' }} />
        }
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom,rgba(0,0,0,.1) 0%,rgba(0,0,0,.6) 100%)' }} />

        {/* Top actions */}
        <div style={{ position:'absolute', top:16, left:16, right:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <button onClick={()=>navigate('/marketplace')} style={{ background:'rgba(255,255,255,.88)', backdropFilter:'blur(8px)', border:'none', borderRadius:12, width:42, height:42, cursor:'pointer', fontSize:18, display:'grid', placeItems:'center', boxShadow:'0 2px 8px rgba(0,0,0,.2)', color:'#0F172A' }}>←</button>
          <div style={{ display:'flex', gap:8 }}>
            {galleryImages.length > 0 && (
              <button onClick={()=>{ setGalleryIdx(0); setShowGallery(true); }} style={{ background:'rgba(255,255,255,.88)', backdropFilter:'blur(8px)', border:'none', borderRadius:12, padding:'10px 14px', cursor:'pointer', fontSize:13, fontWeight:700, color:'#0F172A' }}>📷 {galleryImages.length} photos</button>
            )}
            <button onClick={handleShare} style={{ background:'rgba(255,255,255,.88)', backdropFilter:'blur(8px)', border:'none', borderRadius:12, width:42, height:42, cursor:'pointer', fontSize:16, display:'grid', placeItems:'center', boxShadow:'0 2px 8px rgba(0,0,0,.2)', color:'#0F172A' }}>📤</button>
            <button onClick={handleFav} style={{ background:isFav(slug)?'rgba(239,68,68,.9)':'rgba(255,255,255,.88)', backdropFilter:'blur(8px)', border:'none', borderRadius:12, width:42, height:42, cursor:'pointer', fontSize:16, display:'grid', placeItems:'center', boxShadow:'0 2px 8px rgba(0,0,0,.2)', animation:favAnim?'mk-heartPop .6s':'none', color:isFav(slug)?'#fff':'#0F172A' }}>
              {isFav(slug)?'❤️':'🤍'}
            </button>
          </div>
        </div>
      </div>

      {/* ── INFO BAR ── */}
      <div style={{ background:'var(--mk-surface)', borderBottom:'1px solid var(--mk-border)' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 clamp(14px,4vw,32px)' }}>
          <div style={{ display:'flex', gap:16, alignItems:'flex-start', padding:'18px 0 0' }}>
            {restaurant.logo_url && <img src={ASSET(restaurant.logo_url)} alt="" style={{ width:70, height:70, borderRadius:16, objectFit:'cover', border:`3px solid var(--mk-surface)`, flexShrink:0, marginTop:-34, boxShadow:'0 4px 16px rgba(0,0,0,.15)' }} />}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                <div>
                  <h1 style={{ margin:0, fontSize:'clamp(18px,3.5vw,28px)', fontWeight:800, color:'var(--mk-text)', lineHeight:1.2 }}>{restaurant.name}</h1>
                  <div style={{ fontSize:13, color:'var(--mk-muted)', marginTop:4 }}>{TYPE_ICONS[restaurant.type]} {TYPE_LABELS[restaurant.type]||restaurant.type}{restaurant.cuisine_type&&` · ${restaurant.cuisine_type}`}</div>
                </div>
                <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:700, background:restaurant.is_open?'var(--mk-green-light)':'rgba(239,68,68,.1)', color:restaurant.is_open?'var(--mk-green)':'var(--mk-red)', flexShrink:0 }}>
                  ● {restaurant.is_open?'Ouvert':'Fermé'}
                </span>
              </div>
              {/* Rating + services */}
              <div style={{ display:'flex', gap:12, marginTop:10, flexWrap:'wrap', alignItems:'center' }}>
                {restaurant.avg_rating > 0 && (
                  <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:13 }}>
                    <span style={{ color:'#F59E0B' }}>{'★'.repeat(Math.round(restaurant.avg_rating))}</span>
                    <span style={{ fontWeight:700, color:'var(--mk-text)' }}>{Number(restaurant.avg_rating).toFixed(1)}</span>
                    <span style={{ color:'var(--mk-muted)' }}>({restaurant.total_reviews} avis)</span>
                  </span>
                )}
                {restaurant.address && <span style={{ fontSize:12, color:'var(--mk-muted)' }}>📍 {restaurant.address}</span>}
                {restaurant.phone && <a href={`tel:${restaurant.phone}`} style={{ fontSize:12, color:'var(--mk-orange)', fontWeight:600, textDecoration:'none' }}>📞 {restaurant.phone}</a>}
                {restaurant.accepts_delivery && <span style={{ fontSize:12, color:'var(--mk-muted)' }}>🛵 {restaurant.delivery_fee>0?`${restaurant.delivery_fee} MAD`:'Livraison gratuite'}</span>}
                <span style={{ fontSize:12, color:'var(--mk-muted)' }}>⏱ ~{restaurant.avg_prep_time} min</span>
              </div>
              {restaurant.description && <p style={{ margin:'10px 0 0', fontSize:13, color:'var(--mk-muted)', lineHeight:1.55, maxWidth:520 }}>{restaurant.description}</p>}
            </div>
          </div>

          {/* ── RESERVE A TABLE CTA ── */}
          {restaurant.accepts_dine_in && (
            <div style={{ margin:'14px 0 0', display:'flex', gap:10 }}>
              <button
                onClick={() => navigate(`/r/${slug}/reserve`, { state: { org: restaurant } })}
                style={{
                  flex:1, padding:'13px 20px',
                  background:'linear-gradient(135deg,#FF8A00,#FF5D00)',
                  color:'#fff', border:'none', borderRadius:14,
                  fontWeight:800, fontSize:14, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  boxShadow:'0 4px 20px rgba(255,93,0,.3)',
                  transition:'all .2s',
                }}
                onMouseOver={e=>e.currentTarget.style.boxShadow='0 6px 28px rgba(255,93,0,.45)'}
                onMouseOut={e=>e.currentTarget.style.boxShadow='0 4px 20px rgba(255,93,0,.3)'}
              >
                🪑 Réserver une table
              </button>
            </div>
          )}

          {/* QR banner */}
          {qrTableLabel && (
            <div style={{ margin:'14px 0 0', padding:'10px 16px', background:'rgba(234,88,12,.08)', borderRadius:12, border:'1.5px solid rgba(234,88,12,.25)', display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:20 }}>🪑</span>
              <div>
                <div style={{ fontWeight:700, fontSize:13, color:'var(--mk-orange)' }}>Table {qrTableLabel}</div>
                <div style={{ fontSize:12, color:'var(--mk-muted)', marginTop:1 }}>Commande scannée depuis le QR Code</div>
              </div>
            </div>
          )}

          {/* Tab nav */}
          <div style={{ display:'flex', marginTop:14, overflowX:'auto', scrollbarWidth:'none' }}>
            {TABS.map(tab => (
              <button key={tab} onClick={()=>setActiveTab(tab)} style={{ padding:'12px 18px', border:'none', background:'none', cursor:'pointer', fontSize:14, fontWeight:activeTab===tab?700:500, color:activeTab===tab?'var(--mk-orange)':'var(--mk-muted)', borderBottom:`2px solid ${activeTab===tab?'var(--mk-orange)':'transparent'}`, whiteSpace:'nowrap', transition:'all .15s', marginBottom:-1 }}>
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="rp-main-grid">

        {/* ─ MENU TAB ─ */}
        {activeTab === 'Menu' && (
          <>
            <div>
              {/* Toggle carte / menu du jour */}
              {dailyMenu && (
                <div style={{ display:'flex', gap:0, marginBottom:20, background:'var(--mk-surface)', borderRadius:14, padding:4, border:'1px solid var(--mk-border)', width:'fit-content' }}>
                  <button onClick={()=>setMenuMode('menu_du_jour')} style={{ padding:'9px 18px', border:'none', background:menuMode==='menu_du_jour'?'var(--mk-orange)':'transparent', color:menuMode==='menu_du_jour'?'#fff':'var(--mk-muted)', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:13, fontFamily:'inherit', transition:'all .15s' }}>
                    📅 Menu du jour
                    {dailyMenu.price && <span style={{ marginLeft:6, background:'rgba(255,255,255,.2)', padding:'2px 8px', borderRadius:8, fontSize:11 }}>{Number(dailyMenu.price).toFixed(0)} MAD</span>}
                  </button>
                  <button onClick={()=>setMenuMode('carte')} style={{ padding:'9px 18px', border:'none', background:menuMode==='carte'?'var(--mk-bg)':'transparent', color:menuMode==='carte'?'var(--mk-text)':'var(--mk-muted)', borderRadius:10, cursor:'pointer', fontWeight:menuMode==='carte'?700:500, fontSize:13, fontFamily:'inherit', transition:'all .15s', boxShadow:menuMode==='carte'?'var(--mk-shadow)':'none' }}>
                    À la carte
                  </button>
                </div>
              )}

              {/* ── MENU DU JOUR ── */}
              {menuMode === 'menu_du_jour' && dailyMenu && (
                <div>
                  {dailyMenu.title && <h2 style={{ margin:'0 0 4px', fontSize:18, fontWeight:800, color:'var(--mk-text)' }}>{dailyMenu.title}</h2>}
                  {dailyMenu.description && <p style={{ margin:'0 0 16px', fontSize:13, color:'var(--mk-muted)' }}>{dailyMenu.description}</p>}
                  <div style={{ marginBottom:32 }}>
                    {(dailyMenu.items||[]).map(dmi => dmi.menu_item && (
                      <ItemCard key={dmi.id} item={dmi.menu_item} onAdd={handleAddItem} qty={getQty(dmi.menu_item.id)} />
                    ))}
                    {(dailyMenu.items||[]).length === 0 && <p style={{ color:'var(--mk-muted)', fontSize:13 }}>Aucun plat dans le menu du jour.</p>}
                  </div>
                </div>
              )}

              {/* ── À LA CARTE ── */}
              {menuMode === 'carte' && (
                <>
                  {/* Category tabs */}
                  {categories.length > 1 && (
                    <div style={{ display:'flex', gap:0, overflowX:'auto', marginBottom:20, background:'var(--mk-surface)', borderRadius:14, padding:4, border:'1px solid var(--mk-border)' }} className="mk-scroll">
                      {categories.map(cat => {
                        const key = cat.id ?? cat.name;
                        return (
                          <button key={key} onClick={()=>scrollToCategory(key)} style={{ padding:'9px 16px', border:'none', background:activeCategory===key?'var(--mk-bg)':'transparent', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:activeCategory===key?700:500, color:activeCategory===key?'var(--mk-text)':'var(--mk-muted)', whiteSpace:'nowrap', transition:'all .15s', boxShadow:activeCategory===key?'var(--mk-shadow)':'none' }}>
                            {cat.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {/* Items */}
                  {categories.map(cat => {
                    const key = cat.id ?? cat.name;
                    return (
                      <div key={key} ref={el=>catRefs.current[key]=el} style={{ marginBottom:32, scrollMarginTop:140 }}>
                        <h2 style={{ margin:'0 0 4px', fontSize:18, fontWeight:800, color:'var(--mk-text)' }}>{cat.name}</h2>
                        {cat.description && <p style={{ margin:'0 0 8px', fontSize:13, color:'var(--mk-muted)' }}>{cat.description}</p>}
                        {(cat.items||[]).map(item => <ItemCard key={item.id} item={item} onAdd={handleAddItem} qty={getQty(item.id)} />)}
                        {(cat.items||[]).length === 0 && <div style={{ padding:'20px 0', color:'var(--mk-muted)', fontSize:13 }}>Aucun plat dans cette catégorie.</div>}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
            {/* Sidebar — cachée sur mobile (barre fixe en bas prend le relais) */}
            <div className="rp-cart-col">
              <CartSidebar cart={cart} total={total} onUpdateQty={updateQuantity} onRemove={removeItem} onCheckout={goToCheckout} orgSlug={slug} />
            </div>
          </>
        )}

        {/* ─ AVIS TAB ─ */}
        {activeTab === 'Avis' && (
          <div style={{ gridColumn:'1/-1' }}>
            <ReviewsSection slug={slug} />
          </div>
        )}

        {/* ─ INFOS TAB ─ */}
        {activeTab === 'Infos' && (
          <div style={{ gridColumn:'1/-1', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
            {/* Contact */}
            <div style={{ background:'var(--mk-surface)', borderRadius:16, padding:20, border:'1px solid var(--mk-border)' }}>
              <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:700, color:'var(--mk-text)' }}>📋 Contact & Infos</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {restaurant.address && <div style={{ fontSize:13, color:'var(--mk-text2)' }}><span style={{ color:'var(--mk-muted)' }}>Adresse :</span> {restaurant.address}{restaurant.city&&`, ${restaurant.city}`}</div>}
                {restaurant.phone && <div style={{ fontSize:13 }}><span style={{ color:'var(--mk-muted)' }}>Tél :</span> <a href={`tel:${restaurant.phone}`} style={{ color:'var(--mk-orange)', fontWeight:600, textDecoration:'none' }}>{restaurant.phone}</a></div>}
                {restaurant.email && <div style={{ fontSize:13 }}><span style={{ color:'var(--mk-muted)' }}>Email :</span> <a href={`mailto:${restaurant.email}`} style={{ color:'var(--mk-orange)', fontWeight:600, textDecoration:'none' }}>{restaurant.email}</a></div>}
              </div>
              <div style={{ marginTop:16, display:'flex', gap:8, flexWrap:'wrap' }}>
                {restaurant.accepts_delivery && <span style={{ fontSize:11, background:'var(--mk-green-light)', color:'var(--mk-green)', padding:'3px 10px', borderRadius:20, fontWeight:700 }}>🛵 Livraison</span>}
                {restaurant.accepts_takeaway && <span style={{ fontSize:11, background:'var(--mk-orange-light)', color:'var(--mk-orange)', padding:'3px 10px', borderRadius:20, fontWeight:700 }}>🏃 Emporter</span>}
                {restaurant.accepts_dine_in && <span style={{ fontSize:11, background:'var(--mk-pill)', color:'var(--mk-muted)', padding:'3px 10px', borderRadius:20, fontWeight:700 }}>🍽️ Sur place</span>}
              </div>
            </div>

            {/* Horaires */}
            <div style={{ background:'var(--mk-surface)', borderRadius:16, padding:20, border:'1px solid var(--mk-border)' }}>
              <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:700, color:'var(--mk-text)' }}>🕐 Horaires</h3>
              <OpeningHours hours={restaurant.opening_hours} />
            </div>

            {/* Map */}
            {restaurant.latitude && restaurant.longitude && (
              <div style={{ background:'var(--mk-surface)', borderRadius:16, padding:20, border:'1px solid var(--mk-border)' }}>
                <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:700, color:'var(--mk-text)' }}>📍 Localisation</h3>
                <RestaurantMiniMap lat={restaurant.latitude} lng={restaurant.longitude} name={restaurant.name} theme={theme} />
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${restaurant.latitude},${restaurant.longitude}`} target="_blank" rel="noopener noreferrer" style={{ display:'block', marginTop:12, textAlign:'center', padding:'10px', background:'var(--mk-orange)', color:'#fff', borderRadius:10, textDecoration:'none', fontWeight:700, fontSize:13 }}>
                  🧭 Itinéraire Google Maps
                </a>
              </div>
            )}
          </div>
        )}

        {/* ─ HORAIRES TAB ─ */}
        {activeTab === 'Horaires' && (
          <div style={{ gridColumn:'1/-1' }}>
            <div style={{ background:'var(--mk-surface)', borderRadius:16, padding:24, border:'1px solid var(--mk-border)', maxWidth:480 }}>
              <h3 style={{ margin:'0 0 16px', fontSize:16, fontWeight:700, color:'var(--mk-text)' }}>🕐 Horaires d'ouverture</h3>
              <OpeningHours hours={restaurant.opening_hours} />
            </div>
          </div>
        )}
      </div>

      {/* ── BARRE NAVIGATION MOBILE (toujours visible) ── */}
      <div className="rp-cart-bar" style={{ background:theme==='dark'?'rgba(7,13,26,.95)':'rgba(255,255,255,.96)' }}>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <button onClick={()=>navigate('/marketplace')} style={{ flexShrink:0, width:44, height:44, borderRadius:12, border:'1.5px solid var(--mk-border)', background:'transparent', color:'var(--mk-text)', fontSize:18, cursor:'pointer', display:'grid', placeItems:'center', fontWeight:700 }}>←</button>
          {cartActive && cart.items.length > 0 ? (
            <button onClick={goToCheckout} style={{ flex:1, padding:'12px 16px', background:'var(--mk-orange)', color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 16px rgba(234,88,12,.35)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
              <span>🛒 Voir le panier · {cart.items.reduce((s,i)=>s+i.quantity,0)} article{cart.items.reduce((s,i)=>s+i.quantity,0)>1?'s':''}</span>
              <span style={{ fontWeight:800, flexShrink:0 }}>{total.toFixed(2)} MAD</span>
            </button>
          ) : (
            <div style={{ flex:1, padding:'12px 16px', background:'var(--mk-pill)', borderRadius:12, fontSize:14, color:'var(--mk-muted)', display:'flex', alignItems:'center', gap:8 }}>
              <span>🛒</span><span>Panier vide — ajoutez des plats</span>
            </div>
          )}
        </div>
      </div>

      {/* ── GALLERY ── */}
      <GalleryLightbox images={galleryImages} open={showGallery} startIdx={galleryIdx} onClose={()=>setShowGallery(false)} />

      {/* ── SHARE TOAST ── */}
      {shareToast && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'#0F172A', color:'#fff', padding:'12px 20px', borderRadius:12, fontSize:13, fontWeight:600, zIndex:1000, animation:'mk-fadeUp .3s' }}>
          ✓ Lien copié dans le presse-papier
        </div>
      )}

      {/* ── CONFLICT MODAL ── */}
      {showConflict && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(4px)', animation:'mk-fadeIn .2s' }}>
          <div style={{ background:'var(--mk-surface)', borderRadius:20, padding:28, maxWidth:360, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ fontSize:40, textAlign:'center', marginBottom:12 }}>🛒</div>
            <h3 style={{ margin:'0 0 8px', fontSize:17, fontWeight:800, color:'var(--mk-text)', textAlign:'center' }}>Changer de restaurant ?</h3>
            <p style={{ margin:'0 0 24px', fontSize:14, color:'var(--mk-muted)', lineHeight:1.5, textAlign:'center' }}>Votre panier contient des articles d'un autre restaurant. Voulez-vous le vider et commander ici ?</p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setShowConflict(false)} style={{ flex:1, padding:'12px', border:'1.5px solid var(--mk-border)', borderRadius:12, background:'transparent', cursor:'pointer', fontSize:14, fontWeight:600, color:'var(--mk-text)' }}>Annuler</button>
              <button onClick={confirmClearAndAdd} style={{ flex:1, padding:'12px', border:'none', borderRadius:12, background:'var(--mk-orange)', color:'#fff', cursor:'pointer', fontSize:14, fontWeight:700 }}>Vider & commander</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
