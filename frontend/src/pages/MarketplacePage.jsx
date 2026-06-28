import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { API, ASSET } from '../api';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useCart } from '../contexts/CartContext';
import { BrandLogo } from '../components/brand/BrandLogo';
import { NotificationBell } from '../components/ui/NotificationBell';

/* ══ HOOKS ══════════════════════════════════════════════════════════════ */

function useTheme() {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('mk-theme') ||
    (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );
  const toggle = () => setTheme(t => { const n = t === 'dark' ? 'light' : 'dark'; localStorage.setItem('mk-theme', n); return n; });
  return [theme, toggle];
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

// Les cantines sont exclues de la marketplace publique — elles ont leur propre module interne
const TYPE_LABELS = { restaurant:'Restaurant', snack:'Snack', dark_kitchen:'Dark Kitchen', bakery:'Boulangerie', cafe:'Café' };
const TYPE_ICONS  = { restaurant:'🍽️', snack:'🥙', dark_kitchen:'📦', bakery:'🥐', cafe:'☕' };
const TYPE_COLORS = { restaurant:'#FF8A00', snack:'#FF5D00', dark_kitchen:'#7C3AED', bakery:'#D97706', cafe:'#0369A1' };
const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1920&q=80',
];
const AI_RESPONSES = [
  { k:['calme','tranquille','paisible','détente'],  f:{ sort:'rating', type:'restaurant' }, r:'Voici les restaurants les plus calmes et bien notés 🌿' },
  { k:['végétarien','vegan','sans viande','végé'],  f:{ sort:'rating' }, r:'Établissements avec options végétariennes ♻️' },
  { k:['halal'],                                     f:{ sort:'rating' }, r:'Établissements halal les mieux notés ✅' },
  { k:['famille','familial','enfant','kids'],         f:{ type:'restaurant', sort:'rating' }, r:'Ces restaurants accueillent chaleureusement les familles 👨‍👩‍👧' },
  { k:['romantique','couple','amoureux','dîner'],     f:{ type:'restaurant', sort:'rating' }, r:'Parfait pour une soirée en amoureux 🕯️' },
  { k:['rapide','vite','express','snack'],            f:{ type:'snack', sort:'featured' }, r:'Vos snacks favoris pour manger vite ⚡' },
  { k:['livraison','livré','domicile','commander'],  f:{ delivery:'true', sort:'rating' }, r:'Ces restaurants livrent à votre porte 🛵' },
  { k:['café','petit déj','brunch','matin'],          f:{ type:'cafe', sort:'rating' }, r:'Nos meilleurs cafés pour bien commencer la journée ☕' },
  { k:['boulangerie','pain','pâtisserie','croissant'],f:{ type:'bakery', sort:'rating' }, r:'Les meilleures boulangeries près de vous 🥐' },
  { k:['cantine','déjeuner','midi','entreprise'],     f:{ sort:'rating' }, r:'Pour les cantines d\'entreprise, utilisez votre espace cantine dédié 🏢. Voici nos meilleurs restaurants pour le déjeuner !' },
  { k:['bien noté','meilleur','top','excellent'],     f:{ sort:'rating', min_rating:'4' }, r:'Les établissements les mieux notés ⭐' },
  { k:['nouveau','récent','découvrir','tendance'],    f:{ sort:'new' }, r:'Les nouvelles adresses à découvrir 🆕' },
];

/* ══ COMPONENTS ══════════════════════════════════════════════════════════ */

function formatDist(km) {
  if (km == null) return null;
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function RestaurantCard({ r, isFav, onFav, onClick, delay = 0 }) {
  const [favAnim, setFavAnim] = useState(false);
  const typeColor = TYPE_COLORS[r.type] || '#64748B';

  function handleFav(e) {
    e.stopPropagation();
    setFavAnim(true);
    onFav(r.slug);
    setTimeout(() => setFavAnim(false), 600);
  }

  return (
    <div className="mk-card mk-fade-up" style={{ display:'flex', flexDirection:'column', animationDelay:`${delay}s` }} onClick={onClick}>
      <div style={{ position:'relative', flexShrink:0, overflow:'hidden' }}>
        {r.cover_url
          ? <img src={ASSET(r.cover_url)} alt={r.name} style={{ width:'100%', height:175, objectFit:'cover', display:'block', transition:'transform .4s' }}
              onMouseEnter={e=>e.currentTarget.style.transform='scale(1.05)'}
              onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'} />
          : <div style={{ width:'100%', height:175, background:`linear-gradient(135deg,${typeColor}22,${typeColor}44)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:44 }}>{TYPE_ICONS[r.type]||'🍽️'}</div>
        }
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:70, background:'linear-gradient(transparent,rgba(0,0,0,.45))' }} />
        <div style={{ position:'absolute', top:10, left:10, display:'flex', gap:4, flexWrap:'wrap' }}>
          {r.is_featured && <span style={{ background:'rgba(234,88,12,.92)', color:'#fff', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:20 }}>⭐ Populaire</span>}
          {r.avg_rating >= 4.5 && r.total_reviews >= 3 && <span style={{ background:'rgba(22,163,74,.92)', color:'#fff', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:20 }}>Top noté</span>}
        </div>
        <div style={{ position:'absolute', top:10, right:10, display:'flex', gap:6 }}>
          {r.is_open === true  && <span style={{ background:'rgba(220,252,231,.95)', color:'#16A34A', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:20 }}>● Ouvert</span>}
          {r.is_open === false && <span style={{ background:'rgba(254,226,226,.95)', color:'#DC2626', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:20 }}>● Fermé</span>}
          <button onClick={handleFav} style={{ width:32, height:32, borderRadius:'50%', border:'none', background:'rgba(255,255,255,.92)', cursor:'pointer', display:'grid', placeItems:'center', fontSize:15, animation: favAnim ? 'mk-heartPop .6s' : 'none', boxShadow:'0 2px 8px rgba(0,0,0,.15)' }}>
            {isFav(r.slug) ? '❤️' : '🤍'}
          </button>
        </div>
        {r.logo_url && <img src={ASSET(r.logo_url)} alt="" style={{ position:'absolute', bottom:-18, left:14, width:44, height:44, borderRadius:12, objectFit:'cover', border:'2.5px solid var(--mk-card)', boxShadow:'0 2px 8px rgba(0,0,0,.18)' }} />}
      </div>

      <div style={{ padding: r.logo_url ? '26px 14px 14px' : '14px', flex:1, display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ fontWeight:700, fontSize:15, color:'var(--mk-text)', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical' }}>{r.name}</div>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <span style={{ background:typeColor+'18', color:typeColor, fontWeight:700, fontSize:10, padding:'2px 8px', borderRadius:20 }}>{TYPE_ICONS[r.type]} {TYPE_LABELS[r.type]||r.type}</span>
          {r.cuisine_type && <span style={{ fontSize:12, color:'var(--mk-muted)' }}>{r.cuisine_type}</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
          <span style={{ color:'#F59E0B', fontSize:12 }}>{'★'.repeat(Math.min(5,Math.round(r.avg_rating)))}{'☆'.repeat(Math.max(0,5-Math.round(r.avg_rating)))}</span>
          <span style={{ fontSize:13, fontWeight:700, color:'var(--mk-text)' }}>{r.avg_rating > 0 ? r.avg_rating.toFixed(1) : '—'}</span>
          {r.total_reviews > 0 && <span style={{ fontSize:11, color:'var(--mk-muted)' }}>({r.total_reviews})</span>}
          {r.distance_km != null
            ? <span style={{ fontSize:11, color:'var(--mk-orange)', fontWeight:700, marginLeft:4 }}>📍 {formatDist(r.distance_km)}</span>
            : (r.city||r.zone) && <span style={{ fontSize:11, color:'var(--mk-muted)', marginLeft:4 }}>· 📍 {[r.city, r.zone].filter(Boolean).join(', ')}</span>
          }
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:2 }}>
          {r.accepts_delivery    && <span style={{ fontSize:11, color:'var(--mk-muted)', background:'var(--mk-pill)', padding:'2px 8px', borderRadius:20 }}>🛵 {r.delivery_fee>0?`${r.delivery_fee} MAD`:'Gratuit'}</span>}
          {r.accepts_takeaway    && <span style={{ fontSize:11, color:'var(--mk-muted)', background:'var(--mk-pill)', padding:'2px 8px', borderRadius:20 }}>🏃 Emporter</span>}
          {r.accepts_reservation && <span style={{ fontSize:11, color:'var(--mk-muted)', background:'var(--mk-pill)', padding:'2px 8px', borderRadius:20 }}>📅 Réservation</span>}
          {r.accepts_qr_table    && <span style={{ fontSize:11, color:'var(--mk-muted)', background:'var(--mk-pill)', padding:'2px 8px', borderRadius:20 }}>📱 QR Table</span>}
          <span style={{ fontSize:11, color:'var(--mk-muted)', background:'var(--mk-pill)', padding:'2px 8px', borderRadius:20 }}>⏱ ~{r.avg_prep_time} min</span>
        </div>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div style={{ background:'var(--mk-card)', borderRadius:18, overflow:'hidden', border:'1px solid var(--mk-border)' }}>
      <div className="mk-skeleton" style={{ height:175, borderRadius:0 }} />
      <div style={{ padding:14 }}>
        <div className="mk-skeleton" style={{ height:15, width:'70%', marginBottom:8 }} />
        <div className="mk-skeleton" style={{ height:12, width:'45%', marginBottom:12 }} />
        <div style={{ display:'flex', gap:6 }}>
          <div className="mk-skeleton" style={{ height:22, width:80, borderRadius:20 }} />
          <div className="mk-skeleton" style={{ height:22, width:60, borderRadius:20 }} />
        </div>
      </div>
    </div>
  );
}

function SectionCarousel({ title, emoji, restaurants, isFav, onFav, onCard }) {
  if (!restaurants?.length) return null;
  return (
    <section style={{ marginBottom:36 }}>
      <h2 style={{ margin:'0 0 14px', fontSize:18, fontWeight:800, color:'var(--mk-text)', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:20 }}>{emoji}</span>{title}
      </h2>
      <div style={{ display:'flex', gap:16, overflowX:'auto', paddingBottom:8, scrollSnapType:'x mandatory' }} className="mk-scroll">
        {restaurants.map((r, i) => (
          <div key={r.id||r.slug} style={{ flexShrink:0, width:260, scrollSnapAlign:'start' }}>
            <RestaurantCard r={r} isFav={isFav} onFav={onFav} onClick={() => onCard(r)} delay={i*0.05} />
          </div>
        ))}
      </div>
    </section>
  );
}

function MkMap({ restaurants, theme, selectedSlug, onSelect, userPos }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const mksRef = useRef({});

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const center = userPos ? [userPos.lat, userPos.lng] : [33.5731, -7.5898];
    const map = L.map(ref.current, { center, zoom:12 });
    L.tileLayer(
      theme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { attribution:'© CARTO © OpenStreetMap', maxZoom:19 }
    ).addTo(map);
    if (userPos) {
      L.circleMarker([userPos.lat,userPos.lng], { radius:10, color:'#3B82F6', fillColor:'#3B82F6', fillOpacity:1, weight:3 }).addTo(map).bindPopup('📍 Vous');
    }
    mapRef.current = map;
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; mksRef.current = {}; } };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    Object.values(mksRef.current).forEach(m => m.remove());
    mksRef.current = {};
    restaurants.forEach(r => {
      if (!r.latitude || !r.longitude) return;
      const sel = r.slug === selectedSlug;
      const icon = L.divIcon({ className:'', html:`<div style="background:${sel?'#FF8A00':'#1E1E1E'};color:#fff;font-size:16px;width:38px;height:38px;border-radius:50% 50% 50% 4px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.3);transform:rotate(-45deg);border:2.5px solid #fff"><span style="transform:rotate(45deg)">${TYPE_ICONS[r.type]||'🍽️'}</span></div>`, iconSize:[38,38], iconAnchor:[19,38] });
      const popup = L.popup({ className:'mk-popup', closeButton:false, offset:[0,-6] }).setContent(`<div style="border-radius:14px;overflow:hidden;min-width:200px;font-family:Inter,sans-serif">${r.cover_url?`<img src="${ASSET(r.cover_url)}" style="width:100%;height:110px;object-fit:cover">`:`<div style="height:80px;background:linear-gradient(135deg,${TYPE_COLORS[r.type]||'#64748B'}22,${TYPE_COLORS[r.type]||'#64748B'}44);display:flex;align-items:center;justify-content:center;font-size:36px">${TYPE_ICONS[r.type]||'🍽️'}</div>`}<div style="padding:12px"><div style="font-weight:700;font-size:14px;color:#1E1E1E;margin-bottom:4px">${r.name}</div><div style="display:flex;align-items:center;gap:6px;margin-bottom:8px"><span style="color:#F59E0B;font-size:11px">${'★'.repeat(Math.round(r.avg_rating))}${'☆'.repeat(5-Math.round(r.avg_rating))}</span><span style="font-size:12px;font-weight:600;color:#374151">${r.avg_rating>0?r.avg_rating.toFixed(1):'—'}</span><span style="font-size:10px;margin-left:auto;padding:2px 8px;border-radius:20px;background:${r.is_open?'#F0FDF4':'#FEF2F2'};color:${r.is_open?'#16A34A':'#DC2626'};font-weight:700">● ${r.is_open?'Ouvert':'Fermé'}</span></div><button onclick="window.__mkGoTo('${r.slug}')" style="width:100%;padding:9px;background:linear-gradient(135deg,#FF8A00,#FF5D00);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer">Voir le menu →</button></div></div>`);
      const mk = L.marker([r.latitude,r.longitude], { icon }).addTo(map).bindPopup(popup);
      mk.on('click', () => onSelect(r.slug));
      mksRef.current[r.slug] = mk;
    });
  }, [restaurants, selectedSlug, theme]);

  return <div ref={ref} style={{ width:'100%', height:'100%', borderRadius:16 }} />;
}

function FiltersDrawer({ open, onClose, filters, onChange }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:500, backdropFilter:'blur(4px)', animation:'mk-fadeIn .2s' }} />
      <div style={{ position:'fixed', top:0, right:0, bottom:0, width:Math.min(420,window.innerWidth-24), background:'var(--mk-surface)', zIndex:501, boxShadow:'-8px 0 40px rgba(0,0,0,.2)', padding:24, overflowY:'auto', animation:'mk-slideIn .25s cubic-bezier(.4,0,.2,1)', display:'flex', flexDirection:'column', gap:24 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--mk-text)' }}>Filtres avancés</h3>
          <button onClick={onClose} style={{ background:'var(--mk-pill)', border:'none', borderRadius:10, width:36, height:36, cursor:'pointer', fontSize:16, color:'var(--mk-muted)' }}>✕</button>
        </div>

        <div>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--mk-muted)', marginBottom:10 }}>Type d'établissement</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {[{ v:'', l:'Tous' }, ...Object.entries(TYPE_LABELS).map(([v,l]) => ({ v, l:`${TYPE_ICONS[v]} ${l}` }))].map(({ v, l }) => (
              <button key={v} onClick={() => onChange('type', v)} className={`mk-pill${filters.type===v?' active':''}`}>{l}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--mk-muted)', marginBottom:10 }}>Tri</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {[{v:'featured',l:'🌟 Populaires'},{v:'rating',l:'⭐ Notes'},{v:'new',l:'🆕 Nouveaux'},{v:'delivery',l:'🛵 Livraison'}].map(({v,l}) => (
              <button key={v} onClick={() => onChange('sort', v)} className={`mk-pill${filters.sort===v?' active':''}`}>{l}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--mk-muted)', marginBottom:10 }}>Note minimale</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {[{v:'',l:'Toutes'},{v:'3',l:'3★+'},{v:'4',l:'4★+'},{v:'4.5',l:'4.5★+'}].map(({v,l}) => (
              <button key={v} onClick={() => onChange('min_rating', v)} className={`mk-pill${filters.min_rating===v?' active':''}`}>{l}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--mk-muted)', marginBottom:10 }}>Services</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              {k:'delivery',    l:'🛵 Livraison à domicile'},
              {k:'takeaway',    l:'🏃 À emporter'},
              {k:'reservation', l:'📅 Réservation en ligne'},
              {k:'qr_table',    l:'📱 Commande QR table'},
              {k:'open_now',    l:'● Ouvert maintenant'},
            ].map(({k,l}) => (
              <label key={k} style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer', padding:'12px 14px', borderRadius:12, border:`1.5px solid ${filters[k]==='true'?'var(--mk-orange)':'var(--mk-border)'}`, background:filters[k]==='true'?'var(--mk-orange-light)':'transparent', transition:'all .15s' }}>
                <input type="checkbox" checked={filters[k]==='true'} onChange={e => onChange(k, e.target.checked?'true':'')} style={{ accentColor:'var(--mk-orange)', width:16, height:16 }} />
                <span style={{ fontSize:14, fontWeight:600, color:'var(--mk-text)' }}>{l}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:'auto', paddingTop:16, borderTop:'1px solid var(--mk-border)' }}>
          <button onClick={() => { onChange('__reset'); onClose(); }} style={{ flex:1, padding:'13px', border:'1.5px solid var(--mk-border)', borderRadius:12, background:'transparent', cursor:'pointer', color:'var(--mk-muted)', fontWeight:600, fontSize:14 }}>Réinitialiser</button>
          <button onClick={onClose} style={{ flex:2, padding:'13px', background:'var(--mk-orange)', border:'none', borderRadius:12, cursor:'pointer', color:'#fff', fontWeight:700, fontSize:14 }}>Voir les résultats</button>
        </div>
      </div>
    </>
  );
}

function AIAssistant({ open, onClose, restaurants, onApply }) {
  const [msg, setMsg] = useState('');
  const [chat, setChat] = useState([{ role:'bot', text:'Bonjour ! 👋 Je suis votre assistant découverte.\n\nDites-moi ce que vous cherchez :\n• « Restaurant calme et romantique »\n• « Je veux manger végétarien »\n• « Livraison rapide »\n• « Nouveaux restaurants »' }]);

  function sendMsg() {
    if (!msg.trim()) return;
    const userMsg = msg.trim(); setMsg('');
    setChat(p => [...p, { role:'user', text: userMsg }]);
    const lower = userMsg.toLowerCase();
    const matched = AI_RESPONSES.find(intent => intent.k.some(kw => lower.includes(kw)));
    setTimeout(() => {
      if (matched) {
        const cnt = restaurants.length;
        setChat(p => [...p, { role:'bot', text:`${matched.r}\n\nJ'ai trouvé ${cnt} établissement${cnt!==1?'s':''} — je les affiche pour vous !`, action: matched.f }]);
      } else if (['merci','ok','super','parfait','top'].some(w => lower.includes(w))) {
        setChat(p => [...p, { role:'bot', text:'Avec plaisir ! Bonne dégustation 🍽️' }]);
      } else {
        setChat(p => [...p, { role:'bot', text:'Je vais afficher les établissements les mieux notés pour vous aider ! 🌟', action:{ sort:'rating', min_rating:'4' } }]);
      }
    }, 500);
  }

  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:500, backdropFilter:'blur(4px)', animation:'mk-fadeIn .2s' }} />
      <div style={{ position:'fixed', bottom:24, right:24, width:Math.min(380,window.innerWidth-32), background:'var(--mk-surface)', borderRadius:20, zIndex:501, boxShadow:'0 20px 60px rgba(0,0,0,.25)', display:'flex', flexDirection:'column', maxHeight:'76vh', animation:'mk-fadeUp .3s', border:'1px solid var(--mk-border)' }}>
        <div style={{ padding:'16px 18px', borderBottom:'1px solid var(--mk-border)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:12, background:'linear-gradient(135deg,#7C3AED,#4F46E5)', display:'grid', placeItems:'center', fontSize:18 }}>✨</div>
          <div>
            <div style={{ fontWeight:700, color:'var(--mk-text)', fontSize:14 }}>Assistant IA</div>
            <div style={{ fontSize:11, color:'var(--mk-green)', fontWeight:600 }}>● En ligne</div>
          </div>
          <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', color:'var(--mk-muted)', cursor:'pointer', fontSize:18 }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }} className="mk-scroll">
          {chat.map((m,i) => (
            <div key={i} style={{ display:'flex', flexDirection:m.role==='user'?'row-reverse':'row', gap:8 }}>
              {m.role==='bot' && <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#7C3AED,#4F46E5)', display:'grid', placeItems:'center', fontSize:12, flexShrink:0 }}>✨</div>}
              <div style={{ maxWidth:'78%', padding:'10px 14px', borderRadius:m.role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px', background:m.role==='user'?'var(--mk-orange)':'var(--mk-pill)', color:m.role==='user'?'#fff':'var(--mk-text)', fontSize:13, lineHeight:1.5, whiteSpace:'pre-line' }}>
                {m.text}
                {m.action && <button onClick={() => { onApply(m.action); onClose(); }} style={{ display:'block', marginTop:8, width:'100%', padding:'8px', background:'var(--mk-orange)', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:12 }}>Afficher ces restaurants →</button>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:'12px 14px', borderTop:'1px solid var(--mk-border)', display:'flex', gap:8 }}>
          <input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMsg()} placeholder="Que cherchez-vous ?" style={{ flex:1, padding:'10px 14px', border:'1.5px solid var(--mk-border)', borderRadius:12, background:'var(--mk-input-bg)', color:'var(--mk-text)', fontSize:13, outline:'none' }} />
          <button onClick={sendMsg} style={{ padding:'10px 14px', background:'var(--mk-orange)', border:'none', borderRadius:12, color:'#fff', cursor:'pointer', fontWeight:700, fontSize:13 }}>→</button>
        </div>
      </div>
    </>
  );
}

/* ══ MAIN PAGE ══════════════════════════════════════════════════════════ */

export default function MarketplacePage() {
  const navigate = useNavigate();
  const { user: customerUser, token: customerToken } = useCustomerAuth();
  const { itemCount } = useCart();
  const [theme, toggleTheme] = useTheme();
  const { isFav, toggle: toggleFav } = useFavorites();
  const { history: browseHistory, add: addToHistory } = useHistory();

  const [heroIdx, setHeroIdx] = useState(0);
  useEffect(() => { const id = setInterval(() => setHeroIdx(i => (i+1)%HERO_IMAGES.length), 5500); return () => clearInterval(id); }, []);

  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [filters, setFilters] = useState({ type:'', sort:'featured', min_rating:'', delivery:'', open_now:'', reservation:'', qr_table:'', takeaway:'', radius_km:'10' });
  const [showFilters, setShowFilters] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [view, setView] = useState('grid');
  const [mapSelectedSlug, setMapSelectedSlug] = useState(null);

  const [restaurants, setRestaurants] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [sectionPop, setSectionPop]   = useState([]);
  const [sectionNew, setSectionNew]   = useState([]);
  const [sectionTop, setSectionTop]   = useState([]);
  const [sectLoading, setSectLoading] = useState(true);

  const [userPos, setUserPos]       = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const debRef = useRef(null);

  const buildQS = useCallback((p=1) => {
    const ps = new URLSearchParams({ page:p, limit:12 });
    if (q.trim())                    ps.set('q', q.trim());
    if (city.trim())                 ps.set('city', city.trim());
    if (filters.type)                ps.set('type', filters.type);
    if (filters.min_rating)          ps.set('min_rating', filters.min_rating);
    if (filters.delivery==='true')   ps.set('delivery', 'true');
    if (filters.takeaway==='true')   ps.set('takeaway', 'true');
    if (filters.reservation==='true') ps.set('reservation', 'true');
    if (filters.qr_table==='true')   ps.set('qr_table', 'true');
    if (filters.open_now==='true')   ps.set('open_now', 'true');
    if (userPos) {
      ps.set('lat', userPos.lat);
      ps.set('lng', userPos.lng);
      ps.set('radius_km', filters.radius_km || '10');
      ps.set('sort', 'distance');
    } else if (filters.sort) {
      ps.set('sort', filters.sort);
    }
    return ps.toString();
  }, [q, city, filters, userPos]);

  async function load(p=1) {
    setLoading(true);
    try {
      const res  = await fetch(API(`/marketplace/restaurants?${buildQS(p)}`));
      const data = await res.json();
      setRestaurants(data.restaurants||[]);
      setTotal(data.total||0); setPages(data.pages||1); setPage(p);
    } catch { setRestaurants([]); }
    setLoading(false);
  }

  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => load(1), 300);
    return () => clearTimeout(debRef.current);
  }, [q, city, filters]);

  useEffect(() => {
    setSectLoading(true);
    Promise.all([
      fetch(API('/marketplace/restaurants?sort=featured&limit=8')).then(r=>r.json()),
      fetch(API('/marketplace/restaurants?sort=new&limit=8')).then(r=>r.json()),
      fetch(API('/marketplace/restaurants?sort=rating&min_rating=4&limit=8')).then(r=>r.json()),
    ]).then(([pop,nw,top]) => {
      setSectionPop(pop.restaurants||[]); setSectionNew(nw.restaurants||[]); setSectionTop(top.restaurants||[]);
    }).catch(()=>{}).finally(() => setSectLoading(false));
  }, []);

  function handleFilterChange(key, val) {
    if (key==='__reset') { setFilters({ type:'', sort:'featured', min_rating:'', delivery:'', open_now:'', reservation:'', qr_table:'', takeaway:'', radius_km:'10' }); setUserPos(null); return; }
    setFilters(prev => ({ ...prev, [key]: val }));
  }
  function handleCardClick(r) { addToHistory(r); navigate(`/r/${r.slug}`); }

  function detectLocation() {
    if (!navigator.geolocation) {
      // Fallback: proposer recherche par ville
      setShowFilters(true);
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude:lat, longitude:lng } = pos.coords;
        setUserPos({ lat, lng });
        setCity(''); // On utilise le GPS, pas la ville
        try {
          const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`);
          const data = await res.json();
          const c    = data.address?.city||data.address?.town||data.address?.village||'';
          if (c) setCity(c);
        } catch {}
        // Basculer vers tri distance
        setFilters(prev => ({ ...prev, sort:'distance' }));
        setView('grid');
        setGeoLoading(false);
      },
      () => {
        // GPS refusé → proposer filtres manuels
        setGeoLoading(false);
        setShowFilters(true);
      },
      { timeout:8000, maximumAge:300000 }
    );
  }

  function clearLocation() {
    setUserPos(null);
    setFilters(prev => ({ ...prev, sort:'featured' }));
  }

  window.__mkGoTo = slug => navigate(`/r/${slug}`);

  const hasActive = filters.type || filters.min_rating || filters.delivery==='true' || filters.open_now==='true' || filters.reservation==='true' || filters.qr_table==='true' || filters.takeaway==='true' || userPos;

  return (
    <div className={`mk-wrap mk-${theme}`} style={{ minHeight:'100vh', background:'var(--mk-bg)', transition:'background .3s' }}>

      {/* ── NAVBAR ── */}
      <nav style={{ position:'sticky', top:0, zIndex:300, background:theme==='dark'?'rgba(7,13,26,.92)':'rgba(255,255,255,.92)', backdropFilter:'blur(16px)', borderBottom:'1px solid var(--mk-border)', padding:'0 clamp(12px,4vw,40px)', display:'flex', alignItems:'center', gap:8, height:60 }}>
        {/* Logo : full sur tablette/desktop, icon sur mobile */}
        <div onClick={() => navigate('/marketplace')} style={{ display:'flex', alignItems:'center', cursor:'pointer', flexShrink:0 }}>
          <BrandLogo variant="full" theme={theme} size="xs" className="mk-logo-full" style={{ height:68 }} />
          <BrandLogo variant="icon" theme={theme} size="xs" className="mk-logo-icon" style={{ height:38, borderRadius:8 }} />
        </div>
        {/* Search */}
        <div className="mk-nav-search">
          <span style={{ fontSize:14, color:'var(--mk-muted)', flexShrink:0 }}>🔍</span>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Restaurant, cuisine, ville…" style={{ flex:1, border:'none', background:'transparent', outline:'none', fontSize:14, color:'var(--mk-text)', minWidth:0 }} />
          {q && <button onClick={()=>setQ('')} style={{ background:'none', border:'none', color:'var(--mk-muted)', cursor:'pointer', fontSize:14, lineHeight:1, flexShrink:0 }}>✕</button>}
        </div>
        {/* Actions desktop (cachées sur mobile → bottom bar) */}
        <div className="mk-nav-act" style={{ display:'flex', gap:6, marginLeft:'auto', flexShrink:0 }}>
          <button onClick={()=>setShowAI(v=>!v)} title="Assistant IA" style={{ width:36, height:36, borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,rgba(124,58,237,.15),rgba(79,70,229,.15))', color:'#7C3AED', fontSize:17, display:'grid', placeItems:'center', flexShrink:0 }}>✨</button>
          <button onClick={toggleTheme} style={{ width:36, height:36, borderRadius:10, border:'none', cursor:'pointer', background:'var(--mk-pill)', color:'var(--mk-text)', fontSize:15, display:'grid', placeItems:'center', flexShrink:0 }}>{theme==='dark'?'☀️':'🌙'}</button>
          {customerToken && <NotificationBell token={customerToken} theme={theme} onNavigate={url => navigate(url)} />}
          {itemCount>0 && (
            <button onClick={()=>navigate('/checkout')} style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 12px', borderRadius:10, border:'none', background:'var(--mk-orange)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700, boxShadow:'0 4px 14px rgba(234,88,12,.3)', flexShrink:0 }}>
              🛒 <span>{itemCount}</span>
            </button>
          )}
          {customerUser
            ? <button onClick={()=>navigate('/account/orders')} style={{ padding:'8px 12px', borderRadius:10, border:'1.5px solid var(--mk-border)', background:'transparent', color:'var(--mk-text)', cursor:'pointer', fontSize:13, fontWeight:600, flexShrink:0, whiteSpace:'nowrap', overflow:'hidden', maxWidth:120, textOverflow:'ellipsis' }}>👤 {(customerUser.nom||'').split(' ')[0]}</button>
            : <button onClick={()=>navigate('/account')} style={{ padding:'8px 12px', borderRadius:10, border:'1.5px solid var(--mk-border)', background:'transparent', color:'var(--mk-text)', cursor:'pointer', fontSize:13, fontWeight:600, flexShrink:0, whiteSpace:'nowrap' }}>Connexion</button>
          }
        </div>
        {/* Thème seul — visible sur mobile dans la navbar (reste des actions → bottom bar) */}
        <button onClick={toggleTheme} className="mk-nav-theme-mobile" style={{ width:36, height:36, borderRadius:10, border:'none', cursor:'pointer', background:'var(--mk-pill)', color:'var(--mk-text)', fontSize:15, display:'none', placeItems:'center', flexShrink:0, marginLeft:'auto' }}>{theme==='dark'?'☀️':'🌙'}</button>
      </nav>

      {/* ── HERO ── */}
      <div style={{ position:'relative', height:'clamp(320px,48vh,500px)', overflow:'hidden' }}>
        {HERO_IMAGES.map((url,i) => (
          <div key={i} style={{ position:'absolute', inset:0, backgroundImage:`url(${url})`, backgroundSize:'cover', backgroundPosition:'center', transition:'opacity .9s ease', opacity:heroIdx===i?1:0 }} />
        ))}
        <div style={{ position:'absolute', inset:0, background:'var(--mk-hero-overlay)' }} />
        <div style={{ position:'absolute', top:-80, right:-80, width:280, height:280, borderRadius:'50%', background:'rgba(234,88,12,.1)', filter:'blur(80px)', pointerEvents:'none' }} />

        <div style={{ position:'relative', zIndex:2, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', padding:'0 clamp(16px,5vw,60px)', textAlign:'center' }}>
          <h1 style={{ margin:'0 0 10px', fontSize:'clamp(26px,5.5vw,52px)', fontWeight:800, color:'#fff', lineHeight:1.15, letterSpacing:-1, textShadow:'0 2px 20px rgba(0,0,0,.3)' }}>
            Découvrez les meilleures<br/><span style={{ color:'var(--mk-orange)' }}>adresses</span> près de vous
          </h1>
          <p style={{ margin:'0 0 24px', color:'rgba(255,255,255,.8)', fontSize:'clamp(13px,2vw,17px)', maxWidth:540 }}>
            Restaurants · Snacks · Cafés · Cantines — Réservez, précommandez ou faites livrer
          </p>

          {/* Hero search */}
          <div style={{ display:'flex', gap:8, width:'100%', maxWidth:680, background:'rgba(255,255,255,.97)', borderRadius:16, padding:'6px 6px 6px 18px', boxShadow:'0 16px 48px rgba(0,0,0,.25)' }}>
            <span style={{ display:'flex', alignItems:'center', fontSize:20 }}>🔍</span>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Restaurant, plat, cuisine, ville…" style={{ flex:1, border:'none', outline:'none', fontSize:15, background:'transparent', color:'#0F172A', padding:'8px 0', minWidth:0 }} />
            {userPos && (
              <button onClick={clearLocation} title="Désactiver la géolocalisation" style={{ padding:'8px 12px', borderRadius:10, border:'none', background:'#FEF3C7', color:'#D97706', cursor:'pointer', fontSize:12, fontWeight:700, whiteSpace:'nowrap', flexShrink:0 }}>
                📍 {city || 'Près de moi'} ✕
              </button>
            )}
            <button onClick={detectLocation} disabled={geoLoading} style={{ padding:'10px 18px', borderRadius:12, border:'none', background:geoLoading?'#F1F5F9':userPos?'#16A34A':'var(--mk-orange)', color:geoLoading?'#94A3B8':'#fff', cursor:geoLoading?'default':'pointer', fontSize:13, fontWeight:700, transition:'all .15s', whiteSpace:'nowrap', flexShrink:0 }}>
              {geoLoading
                ? <span className="mk-spin" style={{ display:'inline-block', width:14, height:14, border:'2px solid #ccc', borderTopColor:'#666', borderRadius:'50%' }} />
                : userPos ? '✓ Géolocalisé' : '📍 Près de moi'}
            </button>
          </div>

          {userPos && (
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.18)', backdropFilter:'blur(8px)', borderRadius:12, padding:'8px 16px', border:'1px solid rgba(255,255,255,.3)' }}>
              <span style={{ color:'#FFF', fontSize:13 }}>📍 Résultats dans un rayon de</span>
              {['2','5','10','20','50'].map(r => (
                <button key={r} onClick={() => setFilters(prev => ({ ...prev, radius_km:r }))} style={{ padding:'4px 12px', borderRadius:20, border:`1.5px solid ${filters.radius_km===r?'#fff':'rgba(255,255,255,.5)'}`, background:filters.radius_km===r?'#fff':'transparent', color:filters.radius_km===r?'var(--mk-orange)':'#fff', fontSize:12, fontWeight:700, cursor:'pointer', transition:'all .15s' }}>
                  {r} km
                </button>
              ))}
            </div>
          )}

          {/* Type pills */}
          <div className="mk-hero-pills" style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap', justifyContent:'center' }}>
            {[{v:'',l:'Tous'}, ...Object.entries(TYPE_LABELS).map(([v,l])=>({v,l:`${TYPE_ICONS[v]} ${l}`}))].map(({v,l}) => (
              <button key={v} onClick={()=>handleFilterChange('type',v)} style={{ padding:'6px 14px', borderRadius:20, border:`1.5px solid ${filters.type===v?'var(--mk-orange)':'rgba(255,255,255,.4)'}`, background:filters.type===v?'var(--mk-orange)':'rgba(255,255,255,.15)', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', backdropFilter:'blur(8px)', transition:'all .15s' }}>{l}</button>
            ))}
          </div>
        </div>

        {/* Hero dots */}
        <div style={{ position:'absolute', bottom:12, left:'50%', transform:'translateX(-50%)', display:'flex', gap:6 }}>
          {HERO_IMAGES.map((_,i) => (
            <button key={i} onClick={()=>setHeroIdx(i)} style={{ width:heroIdx===i?20:6, height:6, borderRadius:3, border:'none', cursor:'pointer', background:heroIdx===i?'#fff':'rgba(255,255,255,.4)', transition:'all .3s', padding:0 }} />
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth:1300, margin:'0 auto', padding:'40px clamp(14px,4vw,40px) 80px' }}>

        {browseHistory.length > 0 && (
          <SectionCarousel title="Où vous étiez" emoji="🕐" restaurants={browseHistory} isFav={isFav} onFav={toggleFav} onCard={handleCardClick} />
        )}

        {sectLoading
          ? <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:16, marginBottom:36 }}>{Array(4).fill(0).map((_,i)=><CardSkeleton key={i}/>)}</div>
          : <>
              <SectionCarousel title="Populaires" emoji="🔥" restaurants={sectionPop} isFav={isFav} onFav={toggleFav} onCard={handleCardClick} />
              <SectionCarousel title="Mieux notés" emoji="⭐" restaurants={sectionTop} isFav={isFav} onFav={toggleFav} onCard={handleCardClick} />
              <SectionCarousel title="Nouvelles adresses" emoji="🆕" restaurants={sectionNew} isFav={isFav} onFav={toggleFav} onCard={handleCardClick} />
            </>
        }

        <div style={{ borderTop:'1px solid var(--mk-border)', margin:'8px 0 28px' }} />

        {/* Filter + view bar */}
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:22, position:'sticky', top:60, zIndex:200, background:'var(--mk-bg)', padding:'12px 0', borderBottom:'1px solid var(--mk-border2)' }}>
          <button onClick={()=>setShowFilters(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:12, border:`1.5px solid ${hasActive?'var(--mk-orange)':'var(--mk-border)'}`, background:hasActive?'var(--mk-orange-light)':'var(--mk-surface)', color:hasActive?'var(--mk-orange)':'var(--mk-text)', cursor:'pointer', fontWeight:600, fontSize:13 }}>
            ⚙️ Filtres {hasActive ? '•' : ''}
          </button>
          {userPos
            ? <button onClick={clearLocation} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:12, border:'1.5px solid #16A34A', background:'#DCFCE7', color:'#15803D', cursor:'pointer', fontWeight:700, fontSize:13, flexShrink:0 }}>
                📍 {city||'Près de moi'} ✕
              </button>
            : <button onClick={detectLocation} disabled={geoLoading} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:12, border:'1.5px solid var(--mk-border)', background:'var(--mk-surface)', color:'var(--mk-text)', cursor:geoLoading?'default':'pointer', fontWeight:600, fontSize:13, flexShrink:0 }}>
                {geoLoading ? '⏳' : '📍'} Près de moi
              </button>
          }
          <div style={{ display:'flex', gap:6, overflowX:'auto' }} className="mk-scroll">
            {!userPos && [{v:'featured',l:'🌟 Populaires'},{v:'rating',l:'⭐ Notes'},{v:'new',l:'🆕 Nouveaux'},{v:'delivery',l:'🛵 Livraison'}].map(({v,l})=>(
              <button key={v} onClick={()=>setFilters(p=>({...p,sort:v}))} className={`mk-pill${filters.sort===v?' active':''}`}>{l}</button>
            ))}
          </div>
          <button onClick={()=>setFilters(p=>({...p,open_now:p.open_now==='true'?'':'true'}))} className={`mk-pill${filters.open_now==='true'?' active':''}`}>● Ouvert</button>
          <span className="mk-filter-count" style={{ marginLeft:'auto', fontSize:12, color:'var(--mk-muted)', fontWeight:500, flexShrink:0 }}>{loading?'…':`${total} établissement${total!==1?'s':''}`}</span>
          <div className="mk-view-toggle" style={{ display:'flex', background:'var(--mk-pill)', borderRadius:10, padding:3, gap:2 }}>
            {[['grid','▦ Grille'],['map','🗺️ Carte']].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)} style={{ padding:'6px 12px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background:view===v?'var(--mk-surface)':'transparent', color:view===v?'var(--mk-text)':'var(--mk-muted)', boxShadow:view===v?'var(--mk-shadow)':'none', transition:'all .15s', whiteSpace:'nowrap' }}>{l}</button>
            ))}
          </div>
        </div>

        {/* Grid view */}
        {view==='grid' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:20 }}>
              {loading ? Array(8).fill(0).map((_,i)=><CardSkeleton key={i}/>) :
               restaurants.length===0
                ? <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'80px 0' }}>
                    <div style={{ fontSize:52, marginBottom:12 }}>🍽️</div>
                    <div style={{ fontWeight:700, fontSize:18, color:'var(--mk-text)', marginBottom:6 }}>Aucun établissement trouvé</div>
                    <div style={{ color:'var(--mk-muted)', fontSize:13, marginBottom:20 }}>Essayez d'autres filtres ou une autre ville</div>
                    <button onClick={()=>setFilters({type:'',sort:'featured',min_rating:'',delivery:'',open_now:''})} style={{ padding:'10px 24px', border:'none', borderRadius:10, background:'var(--mk-orange)', color:'#fff', cursor:'pointer', fontWeight:700 }}>Réinitialiser</button>
                  </div>
                : restaurants.map((r,i)=><RestaurantCard key={r.id||r.slug} r={r} isFav={isFav} onFav={toggleFav} onClick={()=>handleCardClick(r)} delay={i*0.04}/>)
              }
            </div>
            {pages>1 && !loading && (
              <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:36 }}>
                <button onClick={()=>load(page-1)} disabled={page<=1} style={{ padding:'9px 20px', borderRadius:10, border:'1.5px solid var(--mk-border)', background:'var(--mk-surface)', color:page<=1?'var(--mk-muted)':'var(--mk-text)', cursor:page<=1?'default':'pointer', fontWeight:600, fontSize:13, opacity:page<=1?.5:1 }}>← Précédent</button>
                <span style={{ padding:'9px 16px', borderRadius:10, background:'var(--mk-pill)', fontSize:13, color:'var(--mk-muted)', fontWeight:500 }}>{page} / {pages}</span>
                <button onClick={()=>load(page+1)} disabled={page>=pages} style={{ padding:'9px 20px', borderRadius:10, border:'1.5px solid var(--mk-border)', background:'var(--mk-surface)', color:page>=pages?'var(--mk-muted)':'var(--mk-text)', cursor:page>=pages?'default':'pointer', fontWeight:600, fontSize:13, opacity:page>=pages?.5:1 }}>Suivant →</button>
              </div>
            )}
          </>
        )}

        {/* Map view */}
        {view==='map' && (
          <div className="mk-map-layout">
            <div className="mk-map-list mk-scroll">
              {loading ? Array(4).fill(0).map((_,i)=><CardSkeleton key={i}/>) :
               restaurants.filter(r=>r.latitude&&r.longitude).map(r=>(
                 <div key={r.slug} onClick={()=>{ setMapSelectedSlug(r.slug); handleCardClick(r); }} style={{ background:'var(--mk-card)', borderRadius:14, overflow:'hidden', cursor:'pointer', border:`2px solid ${mapSelectedSlug===r.slug?'var(--mk-orange)':'var(--mk-border)'}`, transition:'all .15s', boxShadow:mapSelectedSlug===r.slug?'var(--mk-shadow-md)':'var(--mk-shadow)' }}>
                   {r.cover_url && <img src={ASSET(r.cover_url)} alt="" style={{ width:'100%', height:80, objectFit:'cover' }} />}
                   <div style={{ padding:'10px 12px' }}>
                     <div style={{ fontWeight:700, fontSize:13, color:'var(--mk-text)', marginBottom:4 }}>{r.name}</div>
                     <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                       <span style={{ color:'#F59E0B', fontSize:11 }}>{'★'.repeat(Math.round(r.avg_rating))}</span>
                       <span style={{ fontSize:11, color:'var(--mk-muted)' }}>{r.avg_rating>0?r.avg_rating.toFixed(1):'—'}</span>
                       <span style={{ marginLeft:'auto', fontSize:10, fontWeight:700, color:r.is_open?'var(--mk-green)':'var(--mk-red)' }}>● {r.is_open?'Ouvert':'Fermé'}</span>
                     </div>
                   </div>
                 </div>
               ))
              }
              {!loading && restaurants.filter(r=>r.latitude&&r.longitude).length===0 && (
                <div style={{ textAlign:'center', padding:'40px 16px', color:'var(--mk-muted)', fontSize:13 }}>Aucun établissement géolocalisé pour cette sélection.</div>
              )}
            </div>
            <div className="mk-map-container">
              <MkMap restaurants={restaurants.filter(r=>r.latitude&&r.longitude)} theme={theme} selectedSlug={mapSelectedSlug} onSelect={setMapSelectedSlug} userPos={userPos} />
            </div>
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div style={{ borderTop:'1px solid var(--mk-border)', padding:'18px clamp(14px,4vw,40px)', background:'var(--mk-surface)', display:'flex', flexWrap:'wrap', gap:10, alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:13, color:'var(--mk-muted)' }}>Vous êtes restaurateur ? <button onClick={()=>navigate('/login')} style={{ background:'none', border:'none', color:'var(--mk-orange)', fontWeight:700, cursor:'pointer', fontSize:13, padding:0 }}>Espace pro →</button></span>
        <span style={{ fontSize:12, color:'var(--mk-muted)' }}>© {new Date().getFullYear()} RestoBook</span>
      </div>

      {/* ── FLOATING AI ── */}
      {!showAI && (
        <button onClick={()=>setShowAI(true)} className="mk-floating-ai" style={{ position:'fixed', bottom:24, right:24, zIndex:400, width:52, height:52, borderRadius:'50%', border:'none', background:'linear-gradient(135deg,#7C3AED,#4F46E5)', color:'#fff', fontSize:22, cursor:'pointer', boxShadow:'0 8px 24px rgba(124,58,237,.4)', display:'grid', placeItems:'center', transition:'transform .2s' }}
          onMouseEnter={e=>e.currentTarget.style.transform='scale(1.12)'}
          onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
          title="Assistant IA">✨</button>
      )}

      {/* ── BOTTOM BAR MOBILE (navigation app-native) ── */}
      <div className="mk-bottom-bar" style={{ background:theme==='dark'?'rgba(7,13,26,.94)':'rgba(255,255,255,.94)' }}>
        <button className={`mk-bottom-tab${view==='grid'?' active':''}`} onClick={()=>setView('grid')}>
          <span className="mk-bottom-tab-icon">🏠</span>
          Explorer
        </button>
        <button className={`mk-bottom-tab${userPos?' active':''}`} onClick={userPos?clearLocation:detectLocation} disabled={geoLoading}>
          <span className="mk-bottom-tab-icon">{geoLoading?'⏳':userPos?'✓':''}{!geoLoading&&!userPos?'📍':''}</span>
          Près de moi
        </button>
        <button className={`mk-bottom-tab${view==='map'?' active':''}`} onClick={()=>setView('map')}>
          <span className="mk-bottom-tab-icon">🗺️</span>
          Carte
        </button>
        <button className={`mk-bottom-tab${itemCount>0?' active':''}`} onClick={()=>itemCount>0&&navigate('/checkout')} style={{ position:'relative' }}>
          <span className="mk-bottom-tab-icon">🛒</span>
          {itemCount>0 && <span className="mk-bottom-badge">{itemCount}</span>}
          Panier
        </button>
        <button className="mk-bottom-tab" onClick={()=>navigate(customerUser?'/account/orders':'/account')}>
          <span className="mk-bottom-tab-icon">👤</span>
          {customerUser?(customerUser.nom||'').split(' ')[0]||'Compte':'Compte'}
        </button>
      </div>

      <FiltersDrawer open={showFilters} onClose={()=>setShowFilters(false)} filters={filters} onChange={handleFilterChange} />
      <AIAssistant open={showAI} onClose={()=>setShowAI(false)} restaurants={restaurants} onApply={f=>setFilters(prev=>({...prev,...f}))} />
    </div>
  );
}
