import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import L from 'leaflet';
import { API, ASSET } from '../../api';
import { useCart } from '../../contexts/CartContext';
import { ShareButton } from '../../shared/components/ui/ShareMenu';
import { StoreHeroCarousel } from '../../shared/components/marketplace/StoreHeroCarousel';
import { StoreSidebar } from '../../shared/components/marketplace/StoreSidebar';
import { CartConflictModal } from '../../shared/components/marketplace/CartConflictModal';
import { CartPreviewDrawer } from '../../shared/components/marketplace/CartPreviewDrawer';
import BusinessReviewsSection from '../seo/components/BusinessReviewsSection';
import { PremiumIcon, PremiumIconBadge } from '../../shared/components/ui/PremiumIcon';

const PHARMACY_THEME = { primary: '#0EA5E9', dark: '#0369A1', light: '#F0F9FF' };

const DAY_NAMES  = { monday:'Lundi', tuesday:'Mardi', wednesday:'Mercredi', thursday:'Jeudi', friday:'Vendredi', saturday:'Samedi', sunday:'Dimanche' };
const DAYS_ORDER = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const TABS = ['Informations','Avis','Médicaments'];

function Spinner() {
  return <div style={{ display:'flex', justifyContent:'center', padding:60 }}><div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid #E0F2FE', borderTopColor:'#0EA5E9', animation:'ph-spin 1s linear infinite' }} /></div>;
}

function OpeningHours({ hours }) {
  if (!hours) return <div style={{ fontSize:13, color:'#94A3B8' }}>Horaires non renseignés</div>;
  const today = DAYS_ORDER[(new Date().getDay() + 6) % 7];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      {DAYS_ORDER.map(day => {
        const slot = hours[day];
        const isToday = day === today;
        return (
          <div key={day} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'6px 10px', borderRadius:8, background: isToday ? '#F0F9FF' : 'transparent' }}>
            <span style={{ fontWeight:isToday?700:400, color:isToday?'#0369A1':'#111827' }}>{DAY_NAMES[day]}{isToday?' (aujourd\'hui)':''}</span>
            <span style={{ color:slot?.closed?'#EF4444':isToday?'#0369A1':'#6B7280', fontWeight:500 }}>
              {!slot ? '—' : slot.closed ? 'Fermé' : `${slot.open||'00:00'} – ${slot.close||'23:59'}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PharmacyMiniMap({ lat, lng, name }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  useEffect(() => {
    if (!ref.current || mapRef.current || !lat || !lng) return;
    const map = L.map(ref.current, { center:[lat,lng], zoom:15, zoomControl:false, attributionControl:false, dragging:false, scrollWheelZoom:false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom:19 }).addTo(map);
    const icon = L.divIcon({ className:'', html:`<div style="background:#0EA5E9;color:#fff;font-size:16px;width:38px;height:38px;border-radius:50% 50% 50% 4px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.3);transform:rotate(-45deg);border:2.5px solid #fff"><span style="transform:rotate(45deg)"><PremiumIcon name="medicine" size={20} /></span></div>`, iconSize:[38,38], iconAnchor:[19,38] });
    L.marker([lat,lng], { icon }).addTo(map).bindPopup(name);
    mapRef.current = map;
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [lat, lng]);
  if (!lat || !lng) return null;
  return <div ref={ref} style={{ width:'100%', height:220, borderRadius:14, border:'1px solid #E2E8F0' }} />;
}

/* ── Modale de demande (ordonnance / disponibilité / livraison) ── */
function RequestModal({ open, type, pharmacy, onClose }) {
  const [form, setForm] = useState({ customer_name:'', customer_phone:'', product_name:'', message:'', address:'', file_url:'' });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');
  const set = (k,v) => setForm(p => ({ ...p, [k]:v }));

  useEffect(() => { if (open) { setForm({ customer_name:'', customer_phone:'', product_name:'', message:'', address:'', file_url:'' }); setDone(null); setErr(''); } }, [open, type]);

  const TITLES = { prescription:'Envoyer une ordonnance', availability:'Demander une disponibilité', delivery:'Demander une livraison', reservation:'Réserver un produit' };

  async function uploadFile(file) {
    setUploading(true);
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch(API('/pharmacy/upload'), { method:'POST', body:fd });
    const d = await res.json();
    if (d.url) set('file_url', d.url);
    setUploading(false);
  }

  async function submit() {
    if (!form.customer_name.trim() || !form.customer_phone.trim()) { setErr('Nom et téléphone requis'); return; }
    if (type === 'prescription' && !form.file_url) { setErr('Merci de joindre la photo ou le PDF de l\'ordonnance'); return; }
    if (type === 'delivery' && !form.address.trim()) { setErr('Adresse de livraison requise'); return; }
    setSubmitting(true); setErr('');
    try {
      const res = await fetch(API(`/pharmacy/${pharmacy.slug}/requests`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...form }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Erreur lors de l\'envoi'); setSubmitting(false); return; }
      setDone(data.message);
    } catch { setErr('Erreur réseau'); }
    setSubmitting(false);
  }

  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.5)', zIndex:900, backdropFilter:'blur(4px)' }} />
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:901, background:'#fff', borderRadius:18, padding:'24px 26px', width:Math.min(440, window.innerWidth-32), maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,.25)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:'#0F172A' }}>{TITLES[type]}</h3>
          <button onClick={onClose} style={{ background:'#F1F5F9', border:'none', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:14 }}>✕</button>
        </div>
        {done ? (
          <div style={{ textAlign:'center', padding:'16px 0' }}>
            <div style={{ display:'grid', placeItems:'center', color:'#10B981' }}><PremiumIconBadge name="check" size={32} /></div>
            <p style={{ fontSize:14, color:'#374151', lineHeight:1.6 }}>{done}</p>
            <button onClick={onClose} style={{ marginTop:10, padding:'10px 24px', border:'none', borderRadius:10, background:'#0EA5E9', color:'#fff', fontWeight:700, cursor:'pointer' }}>Fermer</button>
          </div>
        ) : (
          <>
            {err && <div style={{ marginBottom:14, padding:'10px 14px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, color:'#DC2626', fontSize:13 }}>{err}</div>}
            <p style={{ fontSize:12, color:'#94A3B8', marginTop:0, marginBottom:14, lineHeight:1.5 }}>Cette demande est envoyée à la pharmacie pour validation par le pharmacien — aucun médicament n'est expédié automatiquement.</p>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#64748B', display:'block', marginBottom:5 }}>Nom *</label>
              <input value={form.customer_name} onChange={e=>set('customer_name',e.target.value)} style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #E2E8F0', borderRadius:10, fontSize:14, boxSizing:'border-box' }} />
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#64748B', display:'block', marginBottom:5 }}>Téléphone *</label>
              <input value={form.customer_phone} onChange={e=>set('customer_phone',e.target.value)} type="tel" style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #E2E8F0', borderRadius:10, fontSize:14, boxSizing:'border-box' }} />
            </div>
            {(type === 'availability' || type === 'reservation') && (
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'#64748B', display:'block', marginBottom:5 }}>Produit recherché</label>
                <input value={form.product_name} onChange={e=>set('product_name',e.target.value)} style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #E2E8F0', borderRadius:10, fontSize:14, boxSizing:'border-box' }} />
              </div>
            )}
            {type === 'delivery' && (
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'#64748B', display:'block', marginBottom:5 }}>Adresse de livraison *</label>
                <input value={form.address} onChange={e=>set('address',e.target.value)} style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #E2E8F0', borderRadius:10, fontSize:14, boxSizing:'border-box' }} />
              </div>
            )}
            {type === 'prescription' && (
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'#64748B', display:'block', marginBottom:5 }}>Photo ou PDF de l'ordonnance *</label>
                <input type="file" accept="image/*,application/pdf" onChange={e=>{ const f=e.target.files[0]; if(f) uploadFile(f); }} style={{ fontSize:12 }} />
                {uploading && <span style={{ fontSize:12, color:'#94A3B8' }}> Envoi…</span>}
                {form.file_url && <div style={{ fontSize:12, color:'#10B981', marginTop:6 }}>✓ Fichier reçu</div>}
              </div>
            )}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#64748B', display:'block', marginBottom:5 }}>Message (optionnel)</label>
              <textarea value={form.message} onChange={e=>set('message',e.target.value)} rows={2} style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #E2E8F0', borderRadius:10, fontSize:13, boxSizing:'border-box', resize:'vertical' }} />
            </div>
            <button onClick={submit} disabled={submitting||uploading} style={{ width:'100%', padding:'13px', background:'linear-gradient(135deg,#0EA5E9,#0369A1)', border:'none', borderRadius:12, color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', opacity:submitting?.7:1 }}>
              {submitting ? 'Envoi…' : '✓ Envoyer la demande'}
            </button>
          </>
        )}
      </div>
    </>
  );
}

export default function PharmacyPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [pharmacy, setPharmacy] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('Informations');
  const [q, setQ] = useState('');
  const [requestModal, setRequestModal] = useState(null); // type string | null

  // Panier — uniquement pour les produits OTC/parapharmacie (requires_prescription
  // false) ; les médicaments sous ordonnance restent sur le flux de demande
  // ci-dessus (RequestModal), jamais de commande automatique. Pas besoin d'un
  // adaptateur useHanoutCart-like ici : la pharmacie n'a ni options ni variantes.
  const { cart: sharedCart, total: sharedTotal, addItem, removeItem, updateQuantity, clearCart } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [slug]);
  const [showCartConflict, setShowCartConflict] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null);
  const isMyCart = sharedCart && sharedCart.orgSlug === slug;
  const cartAdapter = {
    items: isMyCart ? sharedCart.items : [],
    total: isMyCart ? sharedTotal : 0,
    remove: (key) => removeItem(key),
    update: (key, qty) => updateQuantity(key, qty),
    clear: () => clearCart(),
  };
  const cartCount = isMyCart ? sharedCart.items.reduce((s, i) => s + i.quantity, 0) : 0;

  function addMedicineToCart(product) {
    const item = { id: product.id, libelle: product.name, unit_price: Number(product.sale_price || 0), image_url: product.image_url || null };
    if (sharedCart && sharedCart.orgSlug !== slug) { setPendingProduct(item); setShowCartConflict(true); return; }
    addItem(slug, pharmacy.name, item, 1, 'pharmacie');
  }
  function confirmCartConflict() {
    if (pendingProduct) addItem(slug, pharmacy.name, pendingProduct, 1, 'pharmacie');
    setShowCartConflict(false);
    setPendingProduct(null);
  }

  useEffect(() => {
    setLoading(true);
    fetch(API(`/pharmacy/${slug}`)).then(r => r.json()).then(d => {
      if (d.error) { setError(d.error); return; }
      setPharmacy(d);
    }).catch(() => setError('Impossible de charger cette pharmacie')).finally(() => setLoading(false));
  }, [slug]);

  // Ouvre automatiquement la modale de demande si on arrive depuis une carte marketplace
  useEffect(() => {
    if (location.state?.openRequest && pharmacy) {
      setRequestModal(location.state.openRequest);
      navigate(location.pathname, { replace: true, state: {} }); // évite la réouverture au retour arrière
    }
  }, [location.state, pharmacy]);

  useEffect(() => {
    if (activeTab !== 'Médicaments' || !pharmacy) return;
    const qs = new URLSearchParams(); if (q.trim()) qs.set('q', q.trim());
    fetch(API(`/pharmacy/${slug}/products?${qs}`)).then(r=>r.json()).then(d=>setProducts(d.products||[])).catch(()=>{});
  }, [activeTab, q, pharmacy, slug]);

  if (loading) return <div style={{ minHeight:'100vh', background:'#F8FAFC', display:'flex', alignItems:'center', justifyContent:'center' }}><Spinner /></div>;
  if (error) return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}>
      <PremiumIconBadge name="medicine" size={34} />
      <div style={{ fontWeight:700, fontSize:18, color:'#0F172A' }}>Pharmacie introuvable</div>
      <button onClick={()=>navigate('/marketplace')} style={{ padding:'10px 24px', background:'#0EA5E9', border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer' }}>← Marketplace</button>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes ph-spin { to { transform: rotate(360deg) } }
        .ph-action-btn { transition: all .15s; }
        .ph-action-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,0,0,.12); }
      `}</style>
      <div style={{ minHeight:'100vh', background:'#F8FAFC' }}>
        <nav style={{ position:'sticky', top:0, zIndex:200, background:'rgba(255,255,255,.95)', backdropFilter:'blur(12px)', borderBottom:'1px solid #E2E8F0', padding:'0 clamp(12px,4vw,32px)', display:'flex', alignItems:'center', height:56, gap:10 }}>
          <button onClick={()=>navigate('/marketplace')} style={{ background:'none', border:'none', color:'#64748B', cursor:'pointer', fontSize:20, padding:'4px 6px' }}>←</button>
          <div style={{ fontWeight:700, fontSize:15, color:'#0F172A', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', flex:1 }}>{pharmacy.name}</div>
        </nav>

        {/* ── HERO ── (mêmes dimensions que le Hero marketplace) */}
        <div className="mk-hero" style={{ position:'relative', height:'clamp(420px,62vh,680px)', overflow:'hidden' }}>
          <StoreHeroCarousel
            organizationId={pharmacy.organization_id}
            businessType={pharmacy.is_garde ? 'pharmacie_de_garde' : 'pharmacie'}
            orgName={pharmacy.name}
            logoUrl={pharmacy.logo_url}
            fallbackCoverUrl={pharmacy.cover_url}
            fallbackBadge={pharmacy.is_garde && <span style={{ fontSize:10, fontWeight:800, color:'#fff', background:'#DC2626', padding:'3px 8px', borderRadius:20 }}><PremiumIcon name="moon" size={12} /> DE GARDE</span>}
            fallbackSubtitle={`${[pharmacy.district, pharmacy.city].filter(Boolean).join(', ') || 'Position non renseignée'}`}
          />
        </div>

        <div style={{ background:'#fff', borderBottom:'1px solid #E2E8F0', padding:'12px clamp(12px,4vw,32px)', display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
          {pharmacy.total_reviews > 0 && <span style={{ fontSize:13, fontWeight:700, color:'#0F172A' }}><PremiumIcon name="star" size={14} /> {Number(pharmacy.avg_rating).toFixed(1)} <span style={{ color:'#94A3B8', fontWeight:500 }}>({pharmacy.total_reviews})</span></span>}
          {pharmacy.is_open != null && <span style={{ fontSize:12, fontWeight:700, color: pharmacy.is_open?'#059669':'#EF4444', background: pharmacy.is_open?'#F0FDF4':'#FEF2F2', padding:'3px 10px', borderRadius:20 }}>● {pharmacy.is_open ? 'Ouvert' : 'Fermé'}</span>}
          {pharmacy.accepts_delivery && <span style={{ fontSize:12, fontWeight:700, color:'#0369A1', background:'#F0F9FF', padding:'3px 10px', borderRadius:20 }}><PremiumIcon name="delivery" size={13} /> Livraison disponible</span>}
          {pharmacy.phone && <a href={`tel:${pharmacy.phone}`} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#0EA5E9', fontWeight:600, textDecoration:'none' }}><PremiumIcon name="phone" size={14} /> {pharmacy.phone}</a>}
          {pharmacy.whatsapp && <a href={`https://wa.me/${pharmacy.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#25D366', fontWeight:600, textDecoration:'none' }}><PremiumIcon name="whatsapp" size={14} /> WhatsApp</a>}
          <ShareButton title={pharmacy.name} text={`${pharmacy.name} sur iFilino`} url={window.location.href}
            className="" style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#0EA5E9', fontWeight:600, background:'none', border:'none', cursor:'pointer', padding:0 }}>
            <PremiumIcon name="share" size={14} /> Partager
          </ShareButton>
        </div>

        <div style={{ background:'#fff', borderBottom:'1px solid #E2E8F0', padding:'0 clamp(12px,4vw,32px)', display:'flex', gap:4 }}>
          {TABS.map(t => (
            <button key={t} onClick={()=>setActiveTab(t)} style={{ padding:'12px 16px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight:700, color: activeTab===t?'#0369A1':'#64748B', borderBottom: activeTab===t?'2.5px solid #0EA5E9':'2.5px solid transparent' }}>{t}</button>
          ))}
        </div>

        <div className="store-layout-with-sidebar">
          <StoreSidebar
            store={pharmacy}
            type="pharmacie"
            theme={PHARMACY_THEME}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={TABS}
            searchValue={q}
            onSearchChange={activeTab === 'Médicaments' ? setQ : undefined}
            searchPlaceholder="Rechercher un médicament..."
            cartCount={cartCount}
            cartTotal={sharedTotal}
            onCartOpen={() => setCartOpen(true)}
            primaryRequestLabel="Envoyer une ordonnance"
            onPrimaryRequest={() => setRequestModal('prescription')}
          />
          <main className="store-main-content">

          {activeTab === 'Informations' && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
              <div style={{ background:'#fff', borderRadius:16, padding:20, border:'1px solid #E2E8F0' }}>
                <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:700, color:'#0F172A' }}><span className="premium-inline-icon"><PremiumIcon name="package" size={17} /> À propos</span></h3>
                {pharmacy.description && <p style={{ fontSize:13, color:'#374151', lineHeight:1.6, marginTop:0 }}>{pharmacy.description}</p>}
                {pharmacy.address && <div style={{ fontSize:13, color:'#374151', marginBottom:6 }}><span style={{ color:'#94A3B8' }}>Adresse :</span> {pharmacy.address}{pharmacy.city && `, ${pharmacy.city}`}</div>}
                {pharmacy.services?.length > 0 && (
                  <div style={{ marginTop:14, display:'flex', flexWrap:'wrap', gap:8 }}>
                    {pharmacy.services.map(s => <span key={s} style={{ fontSize:11, background:'#F0F9FF', color:'#0369A1', padding:'4px 10px', borderRadius:20, fontWeight:600 }}>{s}</span>)}
                  </div>
                )}
                {pharmacy.is_garde && pharmacy.garde_note && <div style={{ marginTop:12, padding:'10px 14px', background:'#FEF2F2', borderRadius:10, fontSize:12, color:'#991B1B' }}><PremiumIcon name="moon" size={14} /> {pharmacy.garde_note}</div>}
              </div>

              <div style={{ background:'#fff', borderRadius:16, padding:20, border:'1px solid #E2E8F0' }}>
                <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:700, color:'#0F172A' }}><span className="premium-inline-icon"><PremiumIcon name="clock" size={17} /> Horaires</span></h3>
                <OpeningHours hours={pharmacy.opening_hours} />
              </div>

              {pharmacy.latitude && pharmacy.longitude && (
                <div style={{ background:'#fff', borderRadius:16, padding:20, border:'1px solid #E2E8F0' }}>
                  <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:700, color:'#0F172A' }}><span className="premium-inline-icon"><PremiumIcon name="mapPin" size={17} /> Localisation</span></h3>
                  <PharmacyMiniMap lat={pharmacy.latitude} lng={pharmacy.longitude} name={pharmacy.name} />
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${pharmacy.latitude},${pharmacy.longitude}`} target="_blank" rel="noopener noreferrer" style={{ display:'block', marginTop:12, textAlign:'center', padding:'10px', background:'#0EA5E9', color:'#fff', borderRadius:10, textDecoration:'none', fontWeight:700, fontSize:13 }}><PremiumIcon name="directions" size={15} /> Itinéraire Google Maps</a>
                </div>
              )}

              <div style={{ gridColumn:'1/-1', background:'#fff', borderRadius:16, padding:20, border:'1px solid #E2E8F0' }}>
                <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:700, color:'#0F172A' }}><span className="premium-inline-icon"><PremiumIcon name="package" size={17} /> Faire une demande</span></h3>
                <p style={{ fontSize:12, color:'#94A3B8', marginTop:0, marginBottom:14 }}>Aucun achat de médicament n'est automatique — votre demande est transmise au pharmacien qui vous recontacte.</p>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10 }}>
                  <button className="ph-action-btn" onClick={()=>setRequestModal('prescription')} style={{ padding:'14px', border:'1.5px solid #E2E8F0', borderRadius:12, background:'#fff', cursor:'pointer', fontSize:13, fontWeight:700, color:'#0F172A' }}><PremiumIcon name="package" size={16} /> Envoyer une ordonnance</button>
                  <button className="ph-action-btn" onClick={()=>setRequestModal('availability')} style={{ padding:'14px', border:'1.5px solid #E2E8F0', borderRadius:12, background:'#fff', cursor:'pointer', fontSize:13, fontWeight:700, color:'#0F172A' }}><PremiumIcon name="search" size={16} /> Demander une disponibilité</button>
                  {pharmacy.accepts_delivery && <button className="ph-action-btn" onClick={()=>setRequestModal('delivery')} style={{ padding:'14px', border:'1.5px solid #E2E8F0', borderRadius:12, background:'#fff', cursor:'pointer', fontSize:13, fontWeight:700, color:'#0F172A' }}><PremiumIcon name="delivery" size={16} /> Demander une livraison</button>}
                  <button className="ph-action-btn" onClick={()=>setRequestModal('reservation')} style={{ padding:'14px', border:'1.5px solid #E2E8F0', borderRadius:12, background:'#fff', cursor:'pointer', fontSize:13, fontWeight:700, color:'#0F172A' }}><PremiumIcon name="package" size={16} /> Réserver un produit</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Avis' && (pharmacy.business_id || pharmacy.id) && <BusinessReviewsSection businessId={pharmacy.business_id || pharmacy.id} />}

          {activeTab === 'Médicaments' && (
            <div>
              <div style={{ display:'flex', gap:10, alignItems:'center', background:'#fff', borderRadius:14, padding:'10px 14px', border:'1px solid #E2E8F0', boxShadow:'0 2px 8px rgba(0,0,0,.04)', marginBottom:16 }}>
                <PremiumIcon name="search" size={16} style={{ color:'#94A3B8' }} />
                <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un médicament (nom, DCI)…" style={{ flex:1, border:'none', outline:'none', fontSize:14, background:'transparent' }} />
              </div>
              <p style={{ fontSize:12, color:'#94A3B8', marginBottom:16 }}>Catalogue informatif — disponibilité réelle et prix à confirmer auprès du pharmacien.</p>
              {products.length === 0 ? (
                <div style={{ textAlign:'center', padding:48, color:'#94A3B8' }}>
                  <div style={{ display:'grid', placeItems:'center', color:'#94A3B8', marginBottom:8 }}><PremiumIconBadge name="medicine" size={30} /></div>
                  Aucun médicament visible dans le catalogue public pour le moment.
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:14 }}>
                  {products.map(p => (
                    <div key={p.id} onClick={() => navigate(`/product/pharmacie/${p.id}`)} style={{ position:'relative', background:'#fff', borderRadius:14, border:'1px solid #E2E8F0', padding:14, cursor:'pointer' }}>
                      <ShareButton compact title={p.name} text={`${p.name}${p.dosage ? ' ' + p.dosage : ''} — disponible chez ${pharmacy.name} sur iFilino`} url={`${window.location.origin}/ph/${slug}`}
                        style={{ position:'absolute', top:10, right:10 }} />
                      {p.image_url ? <img src={ASSET(p.image_url)} alt="" style={{ width:'100%', height:90, objectFit:'cover', borderRadius:10, marginBottom:10 }} /> : <div style={{ width:'100%', height:90, borderRadius:10, marginBottom:10, background:'#F0F9FF', display:'flex', alignItems:'center', justifyContent:'center', fontSize:30 }}><PremiumIcon name="medicine" size={30} /></div>}
                      <div style={{ fontSize:13, fontWeight:700, color:'#0F172A', marginBottom:2 }}>{p.name}</div>
                      {p.dci && <div style={{ fontSize:11, color:'#94A3B8', marginBottom:4 }}>{p.dci}{p.dosage ? ` · ${p.dosage}` : ''}</div>}
                      {p.requires_prescription
                        ? <span style={{ fontSize:10, fontWeight:700, color:'#EF4444', background:'#FEF2F2', padding:'2px 8px', borderRadius:20 }}>Sous ordonnance</span>
                        : (p.sale_price != null && <span style={{ fontSize:14, fontWeight:800, color:'#0369A1' }}>{Number(p.sale_price).toFixed(2)} MAD</span>)
                      }
                      {p.requires_prescription ? (
                        <button onClick={e => { e.stopPropagation(); setRequestModal('availability'); }} style={{ display:'block', width:'100%', marginTop:10, padding:'8px', border:'1.5px solid #E2E8F0', borderRadius:9, background:'#fff', cursor:'pointer', fontSize:12, fontWeight:700, color:'#0369A1' }}>Demander disponibilité</button>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); addMedicineToCart(p); }} style={{ display:'block', width:'100%', marginTop:10, padding:'8px', border:'none', borderRadius:9, background:PHARMACY_THEME.primary, cursor:'pointer', fontSize:12, fontWeight:700, color:'#fff' }}><PremiumIcon name="cart" size={14} /> Ajouter au panier</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </main>
        </div>

        <RequestModal open={!!requestModal} type={requestModal} pharmacy={pharmacy} onClose={()=>setRequestModal(null)} />

        {cartCount > 0 && !cartOpen && (
          <button onClick={() => setCartOpen(true)} style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:400, display:'flex', alignItems:'center', gap:10, padding:'13px 24px', background:`linear-gradient(135deg,${PHARMACY_THEME.primary},${PHARMACY_THEME.dark})`, border:'none', borderRadius:999, color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer', boxShadow:`0 8px 24px rgba(14,165,233,.4)`, whiteSpace:'nowrap' }}>
            <PremiumIcon name="cart" size={16} /> Voir le panier ({cartCount}) — {sharedTotal.toFixed(2)} MAD
          </button>
        )}
        <CartPreviewDrawer open={cartOpen} onClose={() => setCartOpen(false)} cart={cartAdapter} businessName={pharmacy.name} theme={PHARMACY_THEME} />
        <CartConflictModal
          show={showCartConflict}
          currentOrgName={sharedCart?.orgName}
          targetOrgName={pharmacy.name}
          onCancel={() => { setShowCartConflict(false); setPendingProduct(null); }}
          onConfirm={confirmCartConflict}
        />
      </div>
    </>
  );
}
