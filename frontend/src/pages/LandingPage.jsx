import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { BrandLogo } from '../components/brand/BrandLogo';
import { BRAND } from '../config/branding';
import { API, ASSET } from '../api';
import './LandingPage.css';

/* ══════════════════════════════════════════════════════
   DATA
══════════════════════════════════════════════════════ */

const NAV_LINKS = [
  { label: 'Accueil',         href: '#top' },
  { label: 'Marketplace',     href: '#categories' },
  { label: 'Discover', href: '/discover' },
  { label: 'Professionnels',  href: '#commercants' },
  { label: 'Fonctionnalités', href: '#pourquoi' },
  { label: 'Tarifs',          href: '#tarifs' },
  { label: 'À propos',        href: '#footer' },
];

// Photos vérifiées (déjà utilisées ailleurs dans l'app) réutilisées en duotone
// pour illustrer les catégories sans risquer une image cassée.
const CATEGORY_PHOTOS = [
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=500&q=70',
  'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=500&q=70',
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=70',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=500&q=70',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=500&q=70',
  'https://images.unsplash.com/photo-1534430480872-3498386e7856?auto=format&fit=crop&w=500&q=70',
  'https://images.unsplash.com/photo-1567521464027-f127ff144326?auto=format&fit=crop&w=500&q=70',
  'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=500&q=70',
];

const CATEGORIES = [
  { icon:'🍽️', label:'Restaurants', color:'#FF8A00', type:'restaurant', count:'+500' },
  { icon:'☕',  label:'Cafés',        color:'#0369A1', type:'cafe',       count:'+200' },
  { icon:'🏪',  label:'Hanouts',      color:'#10B981', type:'hanout',     count:'+1k'  },
  { icon:'🛒',  label:'Épiceries',    color:'#059669', type:'epicerie',   count:'+300' },
  { icon:'🥩',  label:'Boucheries',   color:'#DC2626', type:'boucherie',  count:'+150' },
  { icon:'🍰',  label:'Pâtisseries',  color:'#EC4899', type:'patisserie', count:'+100' },
  { icon:'💊',  label:'Pharmacies',   color:'#6366F1', type:'pharmacie',  count:'+250' },
  { icon:'🏬',  label:'Supermarchés', color:'#7E22CE', type:'supermarche',count:'+80'  },
  { icon:'🥐',  label:'Boulangeries', color:'#D97706', type:'boulangerie',count:'+180' },
  { icon:'🐟',  label:'Poissonneries',color:'#0891B2', type:'poissonnerie',count:'+60' },
  { icon:'💐',  label:'Fleuristes',   color:'#DB2777', type:'fleuriste', count:'+40'  },
].map((c, i) => ({ ...c, img: CATEGORY_PHOTOS[i % CATEGORY_PHOTOS.length] }));

const SEARCH_SUGGESTIONS = ['Pizza','Café','Hanout','Pharmacie','Boucherie','Pâtisserie','Boulangerie','Épicerie'];
const HERO_QUICK_CATS = [
  { icon:'🍽️', label:'Restaurants', type:'restaurant' },
  { icon:'☕',  label:'Cafés',       type:'cafe' },
  { icon:'🏪',  label:'Hanouts',     type:'hanout' },
  { icon:'💊',  label:'Pharmacies',  type:'pharmacie' },
  { icon:'🥩',  label:'Boucheries',  type:'boucherie' },
];
const HERO_BG_IMAGES = [
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1534430480872-3498386e7856?auto=format&fit=crop&w=1920&q=80',
];

const WHY_ITEMS = [
  { icon:'🚀', color:'#FF8A00', bg:'rgba(255,138,0,.12)', title:'Livraison rapide',        desc:'Vos commandes livrées en moins de 30 minutes dans les zones couvertes.' },
  { icon:'📍', color:'#3B82F6', bg:'rgba(59,130,246,.12)', title:'Commerces proches',        desc:'Découvrez les commerces autour de vous, du quartier à toute la ville.' },
  { icon:'🔒', color:'#10B981', bg:'rgba(16,185,129,.12)', title:'Paiement sécurisé',        desc:'Paiement à la livraison ou par carte, toujours protégé.' },
  { icon:'🥬', color:'#22C55E', bg:'rgba(34,197,94,.12)',  title:'Produits frais',           desc:'Des produits vérifiés et actualisés directement par les commerçants.' },
  { icon:'📡', color:'#06B6D4', bg:'rgba(6,182,212,.12)',  title:'Suivi en temps réel',      desc:'Suivez votre commande du commerce jusqu’à votre porte.' },
  { icon:'💎', color:'#8B5CF6', bg:'rgba(139,92,246,.12)', title:'Programme fidélité',       desc:'Cumulez des points et débloquez des récompenses à chaque commande.' },
  { icon:'🏷️', color:'#EC4899', bg:'rgba(236,72,153,.12)', title:'Promotions exclusives',    desc:'Profitez d’offres et réductions chez vos commerces préférés.' },
];

const STATS = [
  { value:1500, suffix:'+',  label:'Commerces partenaires', icon:'🏪' },
  { value:15,   suffix:'+',  label:'Villes couvertes',       icon:'📍' },
  { value:80000,suffix:'+',  label:'Commandes livrées',      icon:'📦', format:'k' },
  { value:25,   suffix:' min', label:'Livraison moyenne',    icon:'⚡' },
  { value:98,   suffix:'%',  label:'Satisfaction client',    icon:'⭐' },
  { value:24,   suffix:'/7', label:'Marketplace ouverte',    icon:'🕐' },
];

const HOW_IT_WORKS = [
  { icon:'🔍', title:'Choisissez un produit', desc:'Un plat, un médicament, des fruits, un dessert… dites-nous ce qu’il vous faut.' },
  { icon:'🏪', title:'Choisissez un commerce', desc:'Comparez les commerces qui le proposent : prix, distance, note, temps de livraison.' },
  { icon:'🛒', title:'Passez commande',        desc:'Validez votre panier et payez en toute sécurité en quelques secondes.' },
  { icon:'📍', title:'Suivez votre livraison', desc:'Suivez votre commande en temps réel jusqu’à votre porte.' },
];

const MERCHANT_TOOLS = [
  { icon:'📊', label:'Dashboard' },
  { icon:'🧾', label:'Gestion commandes' },
  { icon:'🖥️', label:'POS' },
  { icon:'🛵', label:'Livraison' },
  { icon:'📈', label:'Analytics' },
  { icon:'📣', label:'Marketing' },
  { icon:'💎', label:'Programme fidélité' },
  { icon:'📲', label:'QR Code' },
  { icon:'🗂️', label:'Gestion catalogue' },
  { icon:'💳', label:'Paiements' },
  { icon:'📦', label:'Stock' },
  { icon:'📉', label:'Statistiques' },
];

const TESTIMONIALS_BY_ROLE = {
  client: [
    { name:'Ahmed Cherif', role:'Étudiant · Casablanca', rating:5, text:'Je trouve toujours le bon commerce rapidement. Les filtres et les recommandations sont vraiment pertinents.', avatar:'AC' },
    { name:'Fatima Zahra', role:'Maman active · Rabat', rating:5, text:'Entre le travail et les enfants, iFilino me fait gagner un temps fou pour les courses du quotidien.', avatar:'FZ' },
    { name:'Youssef El Amrani', role:'Marrakech', rating:5, text:'Livraison pharmacie en urgence un dimanche soir : commandé en 2 minutes, reçu en moins de 30. Bluffant.', avatar:'YE' },
  ],
  commercant: [
    { name:'Leila Benali', role:'Chef · Restaurant Le Maroc', rating:5, text:`L'interface est magnifique et intuitive. Mes commandes ont augmenté de 40% depuis que j'ai rejoint ${BRAND.APP_NAME}.`, avatar:'LB' },
    { name:'Karim Ziani', role:'Gérant · Hanout Al Baraka, Tanger', rating:5, text:'Le catalogue et le suivi de stock m’ont fait gagner des heures chaque semaine. Mes clients me trouvent facilement.', avatar:'KZ' },
    { name:'Sanae Idrissi', role:'Pharmacienne · Agadir', rating:5, text:'Les demandes de disponibilité en ligne évitent les allers-retours inutiles. Un vrai plus pour mon officine.', avatar:'SI' },
  ],
  livreur: [
    { name:'Rachid Amrani', role:'Livreur partenaire · Casablanca', rating:5, text:'Des zones bien optimisées et des revenus réguliers. L’app me donne des courses en continu toute la journée.', avatar:'RA' },
    { name:'Hamza Fassi', role:'Livreur partenaire · Rabat', rating:5, text:'Simple à utiliser, paiements rapides, support réactif en cas de souci. Je recommande.', avatar:'HF' },
    { name:'Younes Bouziane', role:'Livreur partenaire · Marrakech', rating:5, text:'Je choisis mes horaires librement et le suivi GPS facilite chaque livraison.', avatar:'YB' },
  ],
};

const FAQ_ITEMS = [
  { q:`Qu'est-ce que ${BRAND.APP_NAME} ?`, a:`${BRAND.APP_NAME} est une marketplace marocaine de proximité qui connecte les clients aux commerces locaux : restaurants, cafés, hanouts, pharmacies, boucheries, boulangeries, pâtisseries et bien d'autres. Trouvez un produit, comparez les commerces qui le proposent, et commandez en quelques secondes.` },
  { q:`${BRAND.APP_NAME} est-il disponible dans ma ville ?`, a:`${BRAND.APP_NAME} est disponible dans les principales villes du Maroc (Casablanca, Rabat, Marrakech, Agadir, Fès, Tanger). L'expansion est continue — utilisez la géolocalisation pour voir les commerces disponibles près de vous.` },
  { q:'Comment rejoindre la marketplace en tant que commerçant ?', a:'Cliquez sur « Créer mon commerce », renseignez les informations de votre établissement (photos, catalogue, horaires) et passez en ligne en moins de 24h. Notre équipe vous accompagne pour l\'onboarding.' },
  { q:'Comment fonctionne la livraison ?', a:'Chaque commerce définit ses zones et frais de livraison. Le temps estimé (préparation + trajet) est affiché avant validation de la commande, et vous suivez la course en temps réel jusqu’à votre porte.' },
  { q:`${BRAND.APP_NAME} est-il gratuit pour les clients ?`, a:'Oui, la marketplace est 100% gratuite pour les clients — vous ne payez que vos commandes et, le cas échéant, les frais de livraison fixés par le commerce.' },
  { q:'Quels modes de paiement sont acceptés ?', a:'Paiement à la livraison/au retrait, carte bancaire (Visa, Mastercard) et portefeuille numérique, selon les options activées par chaque commerce.' },
  { q:'Mes données sont-elles sécurisées ?', a:`Absolument. ${BRAND.APP_NAME} utilise le chiffrement SSL/TLS, des sauvegardes automatiques quotidiennes et des serveurs hébergés en zone sécurisée. Vos données ne sont jamais partagées avec des tiers.` },
  { q:'Comment devenir livreur partenaire ?', a:'Cliquez sur « Devenir livreur », créez votre compte en quelques minutes, puis complétez votre profil et téléversez vos documents (permis, véhicule) depuis votre espace livreur. Vos premières livraisons débutent dès validation par notre équipe.' },
];

const PRICING_PRO = [
  { name:'Starter',   price:'299', period:'/mois', features:['1 établissement','100 commandes/jour','Catalogue digital','QR Code'] },
  { name:'Pro',       price:'799', period:'/mois', features:['5 établissements','Commandes illimitées','Analytics avancée','Fidélisation clients'] },
];

/* ══════════════════════════════════════════════════════
   HOOKS
══════════════════════════════════════════════════════ */

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('lp-theme') || 'dark');
  const toggle = () => setTheme(t => { const n = t==='dark'?'light':'dark'; localStorage.setItem('lp-theme',n); return n; });
  return [theme, toggle];
}

function useCounter(target, decimals=0) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);
  const inView = useInView(ref, { once:true, margin:'-50px' });

  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;
    let start = 0;
    const duration = 2000;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      setCount(parseFloat(start.toFixed(decimals)));
      if (start >= target) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target, decimals]);

  return [count, ref];
}

function useScrollNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler, { passive:true });
    return () => window.removeEventListener('scroll', handler);
  }, []);
  return scrolled;
}

// Fetch public léger — masque la section si vide, sans jamais planter la landing.
function usePublicList(path, key) {
  const [list, setList] = useState(null); // null = chargement
  useEffect(() => {
    let alive = true;
    fetch(API(path)).then(r => r.json()).then(d => { if (alive) setList(d?.[key] || []); }).catch(() => { if (alive) setList([]); });
    return () => { alive = false; };
  }, [path, key]);
  return list;
}

/* ══════════════════════════════════════════════════════
   ANIMATION VARIANTS
══════════════════════════════════════════════════════ */

const fadeUp     = { hidden:{ opacity:0, y:40 },   visible:{ opacity:1, y:0, transition:{ duration:.55, ease:[.4,0,.2,1] } } };
const slideRight = { hidden:{ opacity:0, x:-40 },   visible:{ opacity:1, x:0, transition:{ duration:.55, ease:[.4,0,.2,1] } } };
const slideLeft  = { hidden:{ opacity:0, x:40 },    visible:{ opacity:1, x:0, transition:{ duration:.55, ease:[.4,0,.2,1] } } };

/* ══════════════════════════════════════════════════════
   BUSINESS HELPERS (routage module -> page commerce)
══════════════════════════════════════════════════════ */

function businessHref(biz) {
  if (biz.module === 'hanout') return `/h/${biz.slug}`;
  if (biz.module === 'pharmacie') return `/ph/${biz.slug}`;
  return `/r/${biz.slug}`;
}

function fmtPrice(n) {
  return `${Number(n || 0).toFixed(2)} MAD`;
}

/* ══════════════════════════════════════════════════════
   TOAST — "bientôt disponible" (CTA app mobile)
══════════════════════════════════════════════════════ */

function ComingSoonToast({ show }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:20 }} transition={{ duration:.25 }}
          style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:2000, background:'var(--lp-text)', color:'var(--lp-bg)', padding:'14px 24px', borderRadius:14, fontSize:14, fontWeight:700, boxShadow:'var(--lp-shadow-lg)', display:'flex', alignItems:'center', gap:10, whiteSpace:'nowrap' }}>
          📱 Bientôt disponible sur iOS et Android
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════════════════
   COMPONENTS
══════════════════════════════════════════════════════ */

/* ─── Navbar ─── */
function LandingNav({ theme, toggleTheme, navigate }) {
  const scrolled = useScrollNav();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className={`lp-nav ${scrolled?'scrolled':''}`}>
      <motion.div onClick={()=>navigate('/landing')} style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', flexShrink:0 }}
        whileHover={{ scale:1.02 }}>
        <BrandLogo variant="full" theme={theme} size="xs" style={{ height:76 }} />
      </motion.div>

      <div className="lp-nav-links" style={{ display:'flex', gap:4, flex:1, justifyContent:'center', marginLeft:32 }}>
        {NAV_LINKS.map(({ label, href }) => (
          <a key={label} href={href} className="lp-nav-link">{label}</a>
        ))}
      </div>

      <div className="lp-nav-right-full">
        <motion.button onClick={toggleTheme} whileHover={{ scale:1.1 }} whileTap={{ scale:.95 }} style={{ width:36, height:36, borderRadius:10, border:'1px solid var(--lp-border)', background:'var(--lp-surface)', color:'var(--lp-text)', fontSize:16, cursor:'pointer', display:'grid', placeItems:'center' }}>
          {theme==='dark'?'☀️':'🌙'}
        </motion.button>
        <motion.button onClick={()=>navigate('/account')} whileHover={{ scale:1.02 }} style={{ padding:'8px 18px', borderRadius:10, border:'1.5px solid var(--lp-border)', background:'transparent', color:'var(--lp-text)', fontSize:13, fontWeight:700, cursor:'pointer' }}>
          Connexion
        </motion.button>
        <motion.button onClick={()=>navigate('/marketplace')} whileHover={{ scale:1.02, boxShadow:'0 8px 28px var(--lp-orange-glow)' }} whileTap={{ scale:.98 }} className="lp-btn-primary" style={{ padding:'9px 18px', fontSize:13 }}>
          Explorer →
        </motion.button>
      </div>

      <div className="lp-nav-right-mobile">
        <motion.button onClick={toggleTheme} whileHover={{ scale:1.1 }} whileTap={{ scale:.95 }} style={{ width:36, height:36, borderRadius:10, border:'1px solid var(--lp-border)', background:'var(--lp-surface)', color:'var(--lp-text)', fontSize:16, cursor:'pointer', display:'grid', placeItems:'center' }}>
          {theme==='dark'?'☀️':'🌙'}
        </motion.button>
        <button className="lp-hamburger" onClick={() => setMobileOpen(true)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <div className="lp-mobile-overlay" onClick={() => setMobileOpen(false)} />
            <div className="lp-mobile-menu">
              <button className="lp-mobile-menu-close" onClick={() => setMobileOpen(false)}>✕</button>

              {NAV_LINKS.map(({ label, href }) => (
                <a key={label} href={href} className="lp-mobile-link" onClick={() => setMobileOpen(false)}>{label}</a>
              ))}

              <div className="lp-mobile-divider" />

              <button onClick={() => { navigate('/account'); setMobileOpen(false); }}
                style={{ padding:'13px 16px', borderRadius:12, border:'1.5px solid var(--lp-border)', background:'transparent', color:'var(--lp-text)', fontSize:14, fontWeight:700, cursor:'pointer', textAlign:'center', width:'100%' }}>
                Connexion
              </button>
              <button onClick={() => { navigate('/discover'); setMobileOpen(false); }}
                style={{ padding:'13px 16px', borderRadius:12, border:'1.5px solid var(--lp-border)', background:'transparent', color:'var(--lp-text)', fontSize:14, fontWeight:700, cursor:'pointer', textAlign:'center', width:'100%', marginTop:4 }}>
                Lire Discover
              </button>
              <motion.button onClick={() => { navigate('/marketplace'); setMobileOpen(false); }}
                whileTap={{ scale:.97 }}
                className="lp-btn-primary"
                style={{ width:'100%', justifyContent:'center', fontSize:14, padding:'13px 16px', marginTop:4 }}>
                Explorer la marketplace →
              </motion.button>
            </div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}

/* ─── Hero ─── */
function HeroSection({ navigate, onDownloadClick }) {
  const [q, setQ]           = useState('');
  const [focused, setFocused] = useState(false);
  const [bgIdx, setBgIdx]   = useState(0);

  useEffect(() => {
    const t = setInterval(() => setBgIdx(i => (i+1) % HERO_BG_IMAGES.length), 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <section id="top" style={{ position:'relative', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', overflow:'hidden', paddingTop:68 }}>
      {HERO_BG_IMAGES.map((url, i) => (
        <div key={i} style={{ position:'absolute', inset:0, backgroundImage:`url(${url})`, backgroundSize:'cover', backgroundPosition:'center', transition:'opacity 1.8s ease', opacity:bgIdx===i?1:0 }} />
      ))}
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,rgba(8,17,31,.72) 0%,rgba(8,17,31,.42) 45%,rgba(8,17,31,.88) 100%)' }} />

      <div style={{ position:'relative', zIndex:2, width:'100%', maxWidth:820, textAlign:'center', padding:'0 clamp(16px,4vw,40px)', display:'flex', flexDirection:'column', alignItems:'center' }}>

        <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} transition={{ duration:.5 }}>
          <span className="lp-section-badge" style={{ background:'rgba(255,138,0,.18)', borderColor:'rgba(255,138,0,.35)', color:'#FFAA33', marginBottom:24, display:'inline-block' }}>
            🇲🇦 La marketplace marocaine de proximité
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} transition={{ duration:.65, delay:.1 }}
          style={{ fontSize:'clamp(38px,7vw,84px)', fontWeight:800, color:'#fff', lineHeight:1.05, letterSpacing:-2, margin:'0 0 18px' }}>
          Tout ce qu'il vous faut,<br/>
          <span className="lp-gradient-text">près de vous.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:.6, delay:.2 }}
          style={{ fontSize:'clamp(14px,2vw,18px)', color:'rgba(255,255,255,.78)', lineHeight:1.65, margin:'0 0 32px', maxWidth:600 }}>
          Trouvez le produit qu'il vous faut, comparez les commerces qui le proposent, et faites-vous livrer — restaurants, hanouts, pharmacies et bien plus.
        </motion.p>

        {/* CTA principaux */}
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:.55, delay:.28 }}
          style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center', marginBottom:28 }}>
          <motion.button onClick={()=>navigate('/marketplace')} whileHover={{ scale:1.03, boxShadow:'0 12px 40px var(--lp-orange-glow)' }} whileTap={{ scale:.97 }}
            className="lp-btn-primary" style={{ fontSize:15, padding:'14px 28px' }}>
            Explorer le marketplace →
          </motion.button>
          <motion.button onClick={()=>navigate('/pro-register')} whileHover={{ scale:1.03 }} whileTap={{ scale:.97 }}
            style={{ padding:'14px 26px', borderRadius:14, border:'1.5px solid rgba(255,255,255,.35)', background:'rgba(255,255,255,.1)', backdropFilter:'blur(8px)', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
            Créer mon commerce
          </motion.button>
          <motion.button onClick={onDownloadClick} whileHover={{ scale:1.03 }} whileTap={{ scale:.97 }}
            style={{ padding:'14px 26px', borderRadius:14, border:'1.5px solid rgba(255,255,255,.2)', background:'transparent', color:'rgba(255,255,255,.85)', fontSize:15, fontWeight:600, cursor:'pointer' }}>
            📱 Télécharger l'application
          </motion.button>
        </motion.div>

        {/* Search bar (démo — redirige vers le marketplace) */}
        <motion.div
          initial={{ opacity:0, y:20, scale:.97 }} animate={{ opacity:1, y:0, scale:1 }} transition={{ duration:.6, delay:.36 }}
          style={{ position:'relative', width:'100%', maxWidth:680, marginBottom:18 }}>
          <div style={{ display:'flex', background:'#fff', borderRadius:20, padding:'7px 7px 7px 22px', boxShadow:`0 24px 80px rgba(0,0,0,.35)${focused?', 0 0 0 3px rgba(255,138,0,.45)':''}`, border:`2px solid ${focused?'#FF8A00':'transparent'}`, transition:'all .2s' }}>
            <span style={{ display:'flex', alignItems:'center', fontSize:20, flexShrink:0 }}>🔍</span>
            <input
              value={q} onChange={e => setQ(e.target.value)}
              onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 200)}
              onKeyDown={e => e.key==='Enter' && navigate('/marketplace'+(q?`?q=${encodeURIComponent(q)}`:'' ))}
              placeholder="Que recherchez-vous aujourd'hui ?"
              style={{ flex:1, border:'none', outline:'none', fontSize:'clamp(13px,2vw,16px)', color:'#0F172A', padding:'10px 12px', minWidth:0, background:'transparent' }}
            />
            <motion.button
              onClick={() => navigate('/marketplace'+(q?`?q=${encodeURIComponent(q)}`:'' ))}
              whileHover={{ scale:1.02 }} whileTap={{ scale:.97 }}
              style={{ padding:'13px clamp(14px,2vw,24px)', borderRadius:14, border:'none', background:'linear-gradient(135deg,#FF8A00,#FF3B30)', color:'#fff', fontSize:'clamp(13px,1.5vw,15px)', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
              Rechercher
            </motion.button>
          </div>

          <AnimatePresence>
            {focused && (
              <motion.div
                initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }} transition={{ duration:.15 }}
                style={{ position:'absolute', top:'calc(100% + 8px)', left:0, right:0, background:'#fff', borderRadius:16, border:'1px solid rgba(0,0,0,.08)', boxShadow:'0 20px 60px rgba(0,0,0,.2)', padding:8, zIndex:10, textAlign:'left' }}>
                <div style={{ padding:'7px 14px 5px', fontSize:10, color:'#94A3B8', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em' }}>Recherches populaires</div>
                {SEARCH_SUGGESTIONS.map(s => (
                  <div key={s}
                    onClick={() => { setQ(s); navigate(`/marketplace?q=${encodeURIComponent(s)}`); }}
                    style={{ padding:'10px 14px', borderRadius:10, cursor:'pointer', fontSize:14, color:'#0F172A', display:'flex', alignItems:'center', gap:10, transition:'background .12s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(255,138,0,.07)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <span style={{ fontSize:13, color:'#94A3B8' }}>🔍</span>
                    <span style={{ fontWeight:500 }}>{s}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:.5, delay:.44 }}>
          <motion.button
            onClick={() => navigate('/marketplace?geo=1')}
            whileHover={{ scale:1.04, background:'rgba(255,255,255,.22)' }} whileTap={{ scale:.97 }}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 24px', borderRadius:14, border:'1.5px solid rgba(255,255,255,.35)', background:'rgba(255,255,255,.12)', backdropFilter:'blur(12px)', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', transition:'all .2s', marginBottom:28 }}>
            📍 Utiliser ma position
          </motion.button>
        </motion.div>

        <motion.div
          initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ duration:.5, delay:.5 }}
          style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          {HERO_QUICK_CATS.map(c => (
            <motion.button key={c.label}
              onClick={() => navigate(`/marketplace?type=${c.type}`)}
              whileHover={{ scale:1.06, background:'rgba(255,255,255,.22)' }} whileTap={{ scale:.95 }}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:24, border:'1.5px solid rgba(255,255,255,.3)', background:'rgba(255,255,255,.12)', backdropFilter:'blur(8px)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', transition:'all .15s' }}>
              {c.icon} {c.label}
            </motion.button>
          ))}
        </motion.div>
      </div>

      <div style={{ position:'absolute', bottom:80, left:'50%', transform:'translateX(-50%)', display:'flex', gap:6, zIndex:2 }}>
        {HERO_BG_IMAGES.map((_,i) => (
          <button key={i} onClick={() => setBgIdx(i)} style={{ width:bgIdx===i?22:6, height:6, borderRadius:3, border:'none', background:bgIdx===i?'#fff':'rgba(255,255,255,.38)', transition:'all .35s', cursor:'pointer', padding:0 }} />
        ))}
      </div>

      <motion.div
        animate={{ y:[0,8,0] }} transition={{ duration:1.8, repeat:Infinity, ease:'easeInOut' }}
        onClick={() => document.getElementById('categories')?.scrollIntoView({ behavior:'smooth' })}
        style={{ position:'absolute', bottom:22, left:'50%', transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', gap:4, opacity:.55, zIndex:2, cursor:'pointer' }}>
        <div style={{ width:18, height:30, borderRadius:10, border:'2px solid rgba(255,255,255,.55)', display:'flex', justifyContent:'center', paddingTop:5 }}>
          <motion.div animate={{ y:[0,8,0] }} transition={{ duration:1.5, repeat:Infinity }} style={{ width:2, height:6, borderRadius:3, background:'rgba(255,255,255,.8)' }} />
        </div>
        <span style={{ fontSize:9, color:'rgba(255,255,255,.55)', fontWeight:600, letterSpacing:'.1em' }}>EXPLORER</span>
      </motion.div>
    </section>
  );
}

/* ─── Categories ─── */
function CategoriesSection({ navigate }) {
  return (
    <section id="categories" style={{ padding:'72px clamp(16px,4vw,60px)', background:'var(--lp-bg)', overflow:'hidden' }}>
      <div style={{ maxWidth:1280, margin:'0 auto' }}>
        <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:.4 }}
          style={{ textAlign:'center', marginBottom:44 }}>
          <div className="lp-section-badge" style={{ margin:'0 auto 14px' }}>🏪 Toutes les catégories</div>
          <h2 style={{ fontSize:'clamp(26px,4vw,42px)', fontWeight:800, color:'var(--lp-text)', margin:'0 0 10px', letterSpacing:-.5 }}>
            Explorez par <span className="lp-gradient-text">catégorie</span>
          </h2>
          <p style={{ color:'var(--lp-muted)', fontSize:15, maxWidth:480, margin:'0 auto' }}>
            Des restaurants aux pharmacies — tout ce dont vous avez besoin, à portée de main.
          </p>
        </motion.div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:14 }}>
          {CATEGORIES.map((cat, i) => (
            <motion.div key={cat.label}
              onClick={() => navigate(`/marketplace${cat.type ? `?type=${cat.type}` : ''}`)}
              initial={{ opacity:0, y:24 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}
              transition={{ duration:.38, delay:i*0.04 }}
              whileHover={{ scale:1.05, y:-6, boxShadow:`0 14px 36px ${cat.color}30` }}
              whileTap={{ scale:.96 }}
              className="lp-category-card"
              style={{ '--cat-color': cat.color, backgroundImage:`url(${cat.img})` }}
            >
              <div className="lp-category-overlay" style={{ background:`linear-gradient(160deg, ${cat.color}CC, ${cat.color}66)` }} />
              <div className="lp-category-content">
                <div style={{ width:52, height:52, borderRadius:16, background:'rgba(255,255,255,.16)', backdropFilter:'blur(4px)', display:'grid', placeItems:'center', fontSize:24, border:'1.5px solid rgba(255,255,255,.35)' }}>{cat.icon}</div>
                <div style={{ fontWeight:700, fontSize:13, color:'#fff', textAlign:'center', lineHeight:1.3 }}>{cat.label}</div>
                <div style={{ fontSize:10, color:'#fff', fontWeight:700, background:'rgba(255,255,255,.22)', padding:'2px 9px', borderRadius:20 }}>{cat.count}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity:0 }} whileInView={{ opacity:1 }} viewport={{ once:true }} transition={{ delay:.4 }}
          style={{ textAlign:'center', marginTop:36 }}>
          <motion.button onClick={() => navigate('/marketplace')} whileHover={{ scale:1.02 }} whileTap={{ scale:.97 }}
            className="lp-btn-primary" style={{ padding:'14px 36px', fontSize:15 }}>
            Explorer tous les commerces →
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Pourquoi iFilino ─── */
function WhySection() {
  return (
    <section id="pourquoi" className="lp-section" style={{ background:'var(--lp-bg2)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:'-80px' }} variants={fadeUp} style={{ textAlign:'center', marginBottom:48 }}>
          <div className="lp-section-badge">✨ Pourquoi {BRAND.APP_NAME}</div>
          <h2 style={{ fontSize:'clamp(26px,4vw,42px)', fontWeight:800, color:'var(--lp-text)', margin:'0 0 12px', letterSpacing:-.5 }}>
            Une expérience <span className="lp-gradient-text">pensée pour vous</span>
          </h2>
          <p style={{ color:'var(--lp-muted)', fontSize:15, maxWidth:520, margin:'0 auto' }}>
            Tout ce qu'il faut pour commander en confiance, près de chez vous.
          </p>
        </motion.div>

        <div className="lp-why-grid">
          {WHY_ITEMS.map((f,i) => (
            <motion.div key={f.title} className="lp-feat-card"
              initial={{ opacity:0, y:28 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true, amount:.3 }}
              transition={{ duration:.45, delay:i*0.06, ease:[.4,0,.2,1] }}
              whileHover={{ scale:1.02 }}>
              <div className="lp-feat-icon" style={{ background:f.bg, color:f.color }}>
                <span style={{ filter:'drop-shadow(0 2px 4px rgba(0,0,0,.2))' }}>{f.icon}</span>
              </div>
              <h3 style={{ fontSize:15, fontWeight:700, color:'var(--lp-text)', margin:'0 0 8px' }}>{f.title}</h3>
              <p style={{ fontSize:13, color:'var(--lp-muted)', lineHeight:1.55, margin:0 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Stats ─── */
function StatCounter({ stat }) {
  const isK = stat.format === 'k';
  const target = isK ? stat.value/1000 : stat.value;
  const [count, ref] = useCounter(target, 0);
  const display = isK ? `${count}k` : count.toLocaleString('fr-FR');

  return (
    <motion.div ref={ref} className="lp-stat-card"
      initial={{ opacity:0, y:30 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true, amount:0.3 }}
      transition={{ duration:.5, ease:[.4,0,.2,1] }}>
      <div style={{ fontSize:32, marginBottom:8 }}>{stat.icon}</div>
      <div style={{ fontSize:'clamp(28px,4vw,40px)', fontWeight:800, color:'var(--lp-orange)', lineHeight:1 }}>
        {display}{stat.suffix}
      </div>
      <div style={{ fontSize:14, color:'var(--lp-muted)', marginTop:6, fontWeight:500 }}>{stat.label}</div>
    </motion.div>
  );
}

function StatsSection() {
  return (
    <section className="lp-section" style={{ background:'var(--lp-bg)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:'-80px' }} variants={fadeUp} style={{ textAlign:'center', marginBottom:48 }}>
          <div className="lp-section-badge">📊 En chiffres</div>
          <h2 style={{ fontSize:'clamp(26px,4vw,40px)', fontWeight:800, color:'var(--lp-text)', margin:'0 0 10px', letterSpacing:-.5 }}>
            {BRAND.APP_NAME} en chiffres
          </h2>
          <p style={{ color:'var(--lp-muted)', fontSize:15 }}>Une marketplace qui grandit chaque jour grâce à sa communauté</p>
        </motion.div>
        <div className="lp-stats-grid">
          {STATS.map(stat => <StatCounter key={stat.label} stat={stat} />)}
        </div>
      </div>
    </section>
  );
}

/* ─── Comment ça marche ─── */
function HowItWorksSection() {
  return (
    <section id="comment-ca-marche" className="lp-section" style={{ background:'var(--lp-bg2)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:'-80px' }} variants={fadeUp} style={{ textAlign:'center', marginBottom:52 }}>
          <div className="lp-section-badge">⚡ Simple et rapide</div>
          <h2 style={{ fontSize:'clamp(26px,4vw,42px)', fontWeight:800, color:'var(--lp-text)', margin:'0 0 12px', letterSpacing:-.5 }}>
            Comment ça <span className="lp-gradient-text">fonctionne</span>
          </h2>
          <p style={{ color:'var(--lp-muted)', fontSize:15 }}>Quatre étapes, quelques minutes.</p>
        </motion.div>

        <div className="lp-steps-grid">
          {HOW_IT_WORKS.map((step, i) => (
            <React.Fragment key={step.title}>
              <motion.div className="lp-step-card"
                initial={{ opacity:0, y:28 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true, amount:.3 }}
                transition={{ duration:.45, delay:i*0.1 }}>
                <div className="lp-step-num">{i+1}</div>
                <div style={{ fontSize:30, marginBottom:10 }}>{step.icon}</div>
                <h3 style={{ fontSize:15, fontWeight:700, color:'var(--lp-text)', margin:'0 0 8px' }}>{step.title}</h3>
                <p style={{ fontSize:13, color:'var(--lp-muted)', lineHeight:1.55, margin:0 }}>{step.desc}</p>
              </motion.div>
              {i < HOW_IT_WORKS.length-1 && <div className="lp-step-arrow">→</div>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Skeleton (chargement produits / commerces) ─── */
function LandingCardSkeleton({ height=200 }) {
  return (
    <div style={{ borderRadius:16, overflow:'hidden', border:'1px solid var(--lp-border)' }}>
      <div className="lp-skel" style={{ height }} />
      <div style={{ padding:14, display:'flex', flexDirection:'column', gap:8 }}>
        <div className="lp-skel" style={{ height:12, width:'70%', borderRadius:6 }} />
        <div className="lp-skel" style={{ height:12, width:'40%', borderRadius:6 }} />
      </div>
    </div>
  );
}

/* ─── Produits populaires (données réelles) ─── */
function LandingProductCard({ product, navigate }) {
  const image = product.images?.[0] ? ASSET(product.images[0]) : null;
  return (
    <div className="lp-product-card" onClick={() => navigate(`/marketplace/search?q=${encodeURIComponent(product.name)}`)}>
      <div style={{ position:'relative', height:130, background:'var(--lp-bg2)' }}>
        {image
          ? <img src={image} alt={product.name} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
          : <div style={{ width:'100%', height:'100%', display:'grid', placeItems:'center', fontSize:32 }}>🛍️</div>}
        {product.is_promo && <span style={{ position:'absolute', top:8, left:8, background:'#EF4444', color:'#fff', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:20 }}>Promo</span>}
      </div>
      <div style={{ padding:'12px 14px' }}>
        <div style={{ fontWeight:700, fontSize:13, color:'var(--lp-text)', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{product.name}</div>
        <div style={{ fontSize:15, fontWeight:800, color:'var(--lp-orange)', marginBottom:6 }}>{fmtPrice(product.price)}</div>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--lp-muted)', marginBottom:8 }}>
          {product.business?.logo_url && <img src={ASSET(product.business.logo_url)} alt="" loading="lazy" style={{ width:16, height:16, borderRadius:'50%', objectFit:'cover' }} />}
          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{product.business?.name || 'Plusieurs commerces'}</span>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
          {product.distance_km != null && <span style={{ fontSize:10, color:'var(--lp-muted)', background:'var(--lp-bg2)', padding:'2px 8px', borderRadius:20 }}>📍 {product.distance_km} km</span>}
          {product.eta_range && <span style={{ fontSize:10, color:'var(--lp-muted)', background:'var(--lp-bg2)', padding:'2px 8px', borderRadius:20 }}>⏱ {product.eta_range}</span>}
        </div>
        <button style={{ width:'100%', padding:'8px', borderRadius:10, border:'none', background:'var(--lp-orange-light)', color:'var(--lp-orange)', fontSize:12, fontWeight:700, cursor:'pointer' }}>
          Voir dans le marketplace →
        </button>
      </div>
    </div>
  );
}

function PopularProductsSection({ navigate }) {
  const products = usePublicList('/marketplace/search?sort=popular&limit=8', 'products');
  const trackRef = useRef(null);

  if (products && products.length === 0) return null; // pas de section vide

  return (
    <section id="produits" className="lp-section" style={{ background:'var(--lp-bg)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp} style={{ textAlign:'center', marginBottom:40 }}>
          <div className="lp-section-badge">🔥 Produits populaires</div>
          <h2 style={{ fontSize:'clamp(26px,4vw,42px)', fontWeight:800, color:'var(--lp-text)', margin:'0 0 12px', letterSpacing:-.5 }}>
            Ce que vos voisins commandent
          </h2>
          <p style={{ color:'var(--lp-muted)', fontSize:15 }}>Des produits réels, chez de vrais commerces, près de chez vous</p>
        </motion.div>

        <div ref={trackRef} className="lp-scroll-track">
          {products === null
            ? Array.from({ length:4 }).map((_,i) => <div key={i} style={{ flexShrink:0, width:200 }}><LandingCardSkeleton /></div>)
            : products.map(p => <div key={p.id} style={{ flexShrink:0, width:200, scrollSnapAlign:'start' }}><LandingProductCard product={p} navigate={navigate} /></div>)
          }
        </div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp} style={{ textAlign:'center', marginTop:32 }}>
          <motion.button onClick={()=>navigate('/marketplace')} whileHover={{ scale:1.03 }} whileTap={{ scale:.97 }}
            className="lp-btn-outline" style={{ fontSize:14, padding:'13px 28px' }}>
            Voir tous les produits →
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Commerces populaires (données réelles) ─── */
function LandingBusinessCard({ biz, navigate }) {
  const cover = biz.cover_url ? ASSET(biz.cover_url) : null;
  return (
    <div className="lp-resto-card" onClick={() => navigate(businessHref(biz))}>
      <div style={{ position:'relative', overflow:'hidden' }}>
        {cover
          ? <img src={cover} alt={biz.name} loading="lazy" style={{ width:'100%', height:170, objectFit:'cover', display:'block' }} />
          : <div style={{ width:'100%', height:170, background:'var(--lp-bg2)', display:'grid', placeItems:'center', fontSize:32 }}>🏪</div>}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 40%,rgba(0,0,0,.55))' }} />
      </div>
      <div style={{ padding:'14px 16px' }}>
        <div style={{ fontWeight:700, fontSize:15, color:'var(--lp-text)', marginBottom:4 }}>{biz.name}</div>
        <div style={{ fontSize:12, color:'var(--lp-muted)', marginBottom:8 }}>📍 {biz.city || biz.district || 'Maroc'}</div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:12 }}>
            <span style={{ color:'#F59E0B' }}>★</span>
            <span style={{ fontWeight:700, color:'var(--lp-text)' }}>{Number(biz.avg_rating||0).toFixed(1)}</span>
            <span style={{ color:'var(--lp-muted)' }}>({biz.total_reviews||0})</span>
          </span>
          <span style={{ fontSize:11, color:'var(--lp-muted)', background:'var(--lp-bg2)', padding:'2px 8px', borderRadius:20 }}>⏱ ~{biz.avg_prep_time} min</span>
          {biz.distance_km != null && <span style={{ fontSize:11, color:'var(--lp-green)', background:'var(--lp-green-light)', padding:'2px 8px', borderRadius:20, fontWeight:700 }}>📍 {biz.distance_km} km</span>}
        </div>
      </div>
    </div>
  );
}

function PopularBusinessesSection({ navigate }) {
  const businesses = usePublicList('/marketplace/businesses?sort=featured&limit=6', 'businesses');

  if (businesses && businesses.length === 0) return null;

  return (
    <section id="commerces" className="lp-section" style={{ background:'var(--lp-bg2)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp} style={{ textAlign:'center', marginBottom:52 }}>
          <div className="lp-section-badge">🏪 Commerces populaires</div>
          <h2 style={{ fontSize:'clamp(26px,4vw,42px)', fontWeight:800, color:'var(--lp-text)', margin:'0 0 12px', letterSpacing:-.5 }}>
            Les commerces les mieux notés
          </h2>
          <p style={{ color:'var(--lp-muted)', fontSize:15 }}>Triés par note, distance et disponibilité</p>
        </motion.div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:20 }}>
          {businesses === null
            ? Array.from({ length:3 }).map((_,i) => <LandingCardSkeleton key={i} height={170} />)
            : businesses.map(b => (
              <motion.div key={b.id} initial={{ opacity:0, y:40 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true, amount:.15 }} transition={{ duration:.5 }}>
                <LandingBusinessCard biz={b} navigate={navigate} />
              </motion.div>
            ))
          }
        </div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp} style={{ textAlign:'center', marginTop:40 }}>
          <motion.button onClick={()=>navigate('/marketplace')} whileHover={{ scale:1.03, boxShadow:'0 12px 40px var(--lp-orange-glow)' }} whileTap={{ scale:.97 }}
            className="lp-btn-primary" style={{ fontSize:16, padding:'15px 36px' }}>
            Voir tous les commerces →
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Pour les commerçants ─── */
function ForMerchantsSection({ navigate }) {
  const startingPrice = PRICING_PRO[0];
  return (
    <section id="commercants" className="lp-section" style={{ background:'var(--lp-bg)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:'-80px' }} variants={fadeUp} style={{ textAlign:'center', marginBottom:48 }}>
          <div className="lp-section-badge">🚀 Espace professionnel</div>
          <h2 style={{ fontSize:'clamp(26px,4vw,44px)', fontWeight:800, color:'var(--lp-text)', margin:'0 0 14px', letterSpacing:-.5 }}>
            Pourquoi rejoindre <span className="lp-gradient-text">{BRAND.APP_NAME}</span> ?
          </h2>
          <p style={{ color:'var(--lp-muted)', fontSize:16, maxWidth:580, margin:'0 auto' }}>
            Développez votre commerce avec des outils professionnels complets — sans compétences techniques requises.
          </p>
        </motion.div>

        <div className="lp-merchant-tools-grid">
          {MERCHANT_TOOLS.map((tool, i) => (
            <motion.div key={tool.label} className="lp-merchant-tool"
              initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true, amount:.3 }}
              transition={{ duration:.35, delay:i*0.03 }}
              whileHover={{ scale:1.05, y:-3 }}>
              <div style={{ fontSize:26, marginBottom:8 }}>{tool.icon}</div>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--lp-text2)' }}>{tool.label}</div>
            </motion.div>
          ))}
        </div>

        <motion.div id="tarifs" initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp}
          style={{ marginTop:40, display:'flex', alignItems:'center', justifyContent:'center', gap:16, flexWrap:'wrap', padding:'20px 28px', borderRadius:18, background:'var(--lp-card)', border:'1px solid var(--lp-border)', maxWidth:640, marginLeft:'auto', marginRight:'auto' }}>
          <div style={{ fontSize:14, color:'var(--lp-muted)' }}>
            À partir de <strong style={{ color:'var(--lp-text)', fontSize:20 }}>{startingPrice.price} MAD{startingPrice.period}</strong> · essai 14 jours offert
          </div>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp} style={{ textAlign:'center', marginTop:28 }}>
          <motion.button onClick={()=>navigate('/pro-register')} whileHover={{ scale:1.03, boxShadow:'0 12px 40px var(--lp-orange-glow)' }} whileTap={{ scale:.97 }}
            className="lp-btn-primary" style={{ fontSize:16, padding:'15px 36px' }}>
            Créer mon commerce →
          </motion.button>
          <div style={{ marginTop:16, fontSize:13, color:'var(--lp-muted)' }}>
            Déjà un commerce ?{' '}
            <button onClick={()=>navigate('/login')} style={{ background:'none', border:'none', color:'var(--lp-orange)', fontWeight:700, cursor:'pointer', padding:0, fontSize:13 }}>
              Se connecter à mon espace pro →
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Témoignages ─── */
function TestimonialsSection({ navigate }) {
  const [tab, setTab] = useState('client');
  const items = TESTIMONIALS_BY_ROLE[tab];
  const TABS = [ ['client','Clients'], ['commercant','Commerçants'], ['livreur','Livreurs'] ];

  return (
    <section className="lp-section" style={{ background:'var(--lp-bg2)', overflow:'hidden' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp} style={{ textAlign:'center', marginBottom:36 }}>
          <div className="lp-section-badge">💬 Témoignages</div>
          <h2 style={{ fontSize:'clamp(26px,4vw,40px)', fontWeight:800, color:'var(--lp-text)', margin:'0 0 10px', letterSpacing:-.5 }}>
            Ils nous font confiance
          </h2>
          <p style={{ color:'var(--lp-muted)', fontSize:15, marginBottom:24 }}>Clients, commerçants et livreurs partout au Maroc</p>
          <div className="lp-tab-switcher">
            {TABS.map(([key,label]) => (
              <button key={key} className={`lp-tab-btn${tab===key?' active':''}`} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-12 }} transition={{ duration:.26 }}
            style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
            {items.map((t,i) => (
              <motion.div key={t.name} className="lp-testi-card"
                initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} transition={{ duration:.4, delay:i*0.08 }}
                whileHover={{ y:-4, boxShadow:'var(--lp-shadow-lg)' }}>
                <div style={{ color:'#F59E0B', marginBottom:10, fontSize:16 }}>{'★'.repeat(t.rating)}</div>
                <p style={{ fontSize:14, color:'var(--lp-text2)', lineHeight:1.65, margin:'0 0 18px', fontStyle:'italic' }}>"{t.text}"</p>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,var(--lp-orange),var(--lp-orange2))', display:'grid', placeItems:'center', fontWeight:800, color:'#fff', fontSize:14 }}>
                    {t.avatar}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--lp-text)' }}>{t.name}</div>
                    <div style={{ fontSize:12, color:'var(--lp-muted)' }}>{t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {tab === 'livreur' && (
          <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ duration:.35 }} style={{ textAlign:'center', marginTop:32 }}>
            <motion.button onClick={()=>navigate('/devenir-livreur')} whileHover={{ scale:1.03, boxShadow:'0 12px 40px var(--lp-orange-glow)' }} whileTap={{ scale:.97 }}
              className="lp-btn-primary" style={{ fontSize:15, padding:'14px 32px' }}>
              🛵 Devenir livreur →
            </motion.button>
          </motion.div>
        )}
      </div>
    </section>
  );
}

/* ─── FAQ ─── */
function FAQSection() {
  const [open, setOpen] = useState(null);

  return (
    <section id="faq" className="lp-section" style={{ background:'var(--lp-bg)' }}>
      <div style={{ maxWidth:780, margin:'0 auto' }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:'-80px' }} variants={fadeUp} style={{ textAlign:'center', marginBottom:48 }}>
          <div className="lp-section-badge">❓ FAQ</div>
          <h2 style={{ fontSize:'clamp(26px,4vw,42px)', fontWeight:800, color:'var(--lp-text)', margin:'0 0 12px', letterSpacing:-.5 }}>
            Questions <span className="lp-gradient-text">fréquentes</span>
          </h2>
          <p style={{ color:'var(--lp-muted)', fontSize:15, margin:0 }}>Tout ce que vous devez savoir sur {BRAND.APP_NAME}</p>
        </motion.div>

        <div>
          {FAQ_ITEMS.map((item, i) => (
            <motion.div key={i} className="lp-faq-item"
              initial={{ opacity:0, y:16 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:.32, delay:i*0.05 }}>
              <button className="lp-faq-q" onClick={() => setOpen(open === i ? null : i)}>
                <span>{item.q}</span>
                <span className={`lp-faq-chevron${open===i?' open':''}`}>▼</span>
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div
                    initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
                    transition={{ duration:.24, ease:[.4,0,.2,1] }} style={{ overflow:'hidden' }}>
                    <div className="lp-faq-answer">{item.a}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA final ─── */
function CTASection({ navigate, onDownloadClick }) {
  return (
    <section className="lp-cta-bg lp-section" style={{ textAlign:'center', position:'relative' }}>
      <div style={{ position:'absolute', top:'10%', left:'20%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,138,0,.12),transparent)', filter:'blur(60px)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'10%', right:'20%', width:250, height:250, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,.1),transparent)', filter:'blur(60px)', pointerEvents:'none' }} />

      <div style={{ maxWidth:720, margin:'0 auto', position:'relative', zIndex:1 }}>
        <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:.4 }}>
          <div className="lp-section-badge" style={{ margin:'0 auto 20px' }}>🚀 Commencez maintenant</div>
        </motion.div>
        <motion.h2 initial={{ opacity:0, y:25 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:.5, delay:.1 }}
          style={{ fontSize:'clamp(32px,5vw,56px)', fontWeight:800, color:'var(--lp-text)', margin:'0 0 18px', lineHeight:1.15, letterSpacing:-1 }}>
          Prêt à découvrir<br/><span className="lp-gradient-text">votre quartier autrement ?</span>
        </motion.h2>
        <motion.p initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:.5, delay:.18 }}
          style={{ fontSize:17, color:'var(--lp-muted)', margin:'0 0 40px', lineHeight:1.6 }}>
          Rejoignez des milliers d'utilisateurs et de commerçants qui font confiance à {BRAND.APP_NAME} chaque jour.
        </motion.p>
        <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:.5, delay:.26 }}
          style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
          <motion.button onClick={()=>navigate('/marketplace')} whileHover={{ scale:1.04, boxShadow:'0 16px 48px var(--lp-orange-glow)' }} whileTap={{ scale:.97 }}
            className="lp-btn-primary" style={{ fontSize:17, padding:'17px 40px' }}>
            Explorer le marketplace →
          </motion.button>
          <motion.button onClick={()=>navigate('/pro-register')} whileHover={{ scale:1.03 }} className="lp-btn-outline" style={{ fontSize:17, padding:'16px 38px' }}>
            Créer mon commerce
          </motion.button>
          <motion.button onClick={onDownloadClick} whileHover={{ scale:1.03 }} className="lp-btn-outline" style={{ fontSize:17, padding:'16px 38px' }}>
            📱 Télécharger l'app
          </motion.button>
        </motion.div>
        <motion.p initial={{ opacity:0 }} whileInView={{ opacity:1 }} viewport={{ once:true }} transition={{ duration:.4, delay:.36 }}
          style={{ marginTop:22, fontSize:13, color:'var(--lp-muted)' }}>
          ✅ Gratuit pour les clients · 🔒 Sécurisé · ⚡ Setup commerçant en 2 minutes
        </motion.p>
      </div>
    </section>
  );
}

/* ─── Footer ─── */
const FOOTER_LINKS = {
  'Entreprise': [
    { label:'À propos', href:'#footer' },
    { label:'Solutions entreprise (Cantines)', to:'/login' },
    { label:'Contact' },
  ],
  'Marketplace': [
    { label:'Explorer', to:'/marketplace' },
    { label:'iFilino Discover', to:'/discover' },
    { label:'Catégories', href:'#categories' },
    { label:'Comment ça marche', href:'#comment-ca-marche' },
  ],
  'Professionnels': [
    { label:'Créer mon commerce', to:'/pro-register' },
    { label:'Devenir livreur', to:'/devenir-livreur' },
    { label:'Espace pro', to:'/login' },
    { label:'Tarifs', href:'#tarifs' },
  ],
  'Support': [
    { label:'FAQ', href:'#faq' },
    { label:'CGU' },
    { label:'Confidentialité' },
  ],
};

function LandingFooter({ navigate, theme }) {
  return (
    <footer id="footer" style={{ background:'var(--lp-bg)', borderTop:'1px solid var(--lp-border)', padding:'60px clamp(16px,4vw,60px) 30px' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div className="lp-footer-grid" style={{ marginBottom:48 }}>
          <div>
            <div style={{ marginBottom:16 }}>
              <BrandLogo variant="footer" theme={theme ?? 'dark'} size="xs" style={{ height:110 }} />
            </div>
            <p style={{ fontSize:13, color:'var(--lp-muted)', lineHeight:1.65, margin:'0 0 20px', maxWidth:240 }}>
              La marketplace marocaine de proximité — trouvez, comparez et commandez près de chez vous.
            </p>
            <div style={{ display:'flex', gap:10 }}>
              {['𝕏','in','📧'].map(icon => (
                <div key={icon} style={{ width:36, height:36, borderRadius:10, background:'var(--lp-card)', border:'1px solid var(--lp-border)', display:'grid', placeItems:'center', cursor:'pointer', fontSize:15, color:'var(--lp-muted)' }}>{icon}</div>
              ))}
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([cat, items]) => (
            <div key={cat}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--lp-text)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:14 }}>{cat}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {items.map(item => {
                  const common = { key:item.label, style:{ background:'none', border:'none', padding:0, fontSize:13, color:'var(--lp-muted)', textAlign:'left' } };
                  if (item.to) return <button {...common} onClick={()=>navigate(item.to)} style={{ ...common.style, cursor:'pointer', transition:'color .15s' }} onMouseEnter={e=>e.currentTarget.style.color='var(--lp-orange)'} onMouseLeave={e=>e.currentTarget.style.color='var(--lp-muted)'}>{item.label}</button>;
                  if (item.href) return <a key={item.label} href={item.href} style={{ ...common.style, cursor:'pointer', textDecoration:'none', transition:'color .15s' }} onMouseEnter={e=>e.currentTarget.style.color='var(--lp-orange)'} onMouseLeave={e=>e.currentTarget.style.color='var(--lp-muted)'}>{item.label}</a>;
                  return <span {...common}>{item.label}</span>; // pas encore de page dédiée — texte statique plutôt qu'un lien trompeur
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop:'1px solid var(--lp-border)', paddingTop:24, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <span style={{ fontSize:12, color:'var(--lp-muted)' }}>© {new Date().getFullYear()} {BRAND.APP_NAME}. Tous droits réservés.</span>
          <div style={{ display:'flex', gap:8 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--lp-green)', display:'inline-block', boxShadow:'0 0 8px var(--lp-green)' }} />
            <span style={{ fontSize:12, color:'var(--lp-muted)' }}>Tous les systèmes opérationnels</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN LANDING PAGE
══════════════════════════════════════════════════════ */

export default function LandingPage() {
  const navigate = useNavigate();
  const [theme, toggleTheme] = useTheme();
  const [showComingSoon, setShowComingSoon] = useState(false);

  function notifyComingSoon() {
    setShowComingSoon(true);
    setTimeout(() => setShowComingSoon(false), 2600);
  }

  return (
    <div className={`lp lp-${theme}`}>
      <LandingNav theme={theme} toggleTheme={toggleTheme} navigate={navigate} />
      <HeroSection navigate={navigate} onDownloadClick={notifyComingSoon} />
      <CategoriesSection navigate={navigate} />
      <WhySection />
      <StatsSection />
      <HowItWorksSection />
      <PopularProductsSection navigate={navigate} />
      <PopularBusinessesSection navigate={navigate} />
      <ForMerchantsSection navigate={navigate} />
      <TestimonialsSection navigate={navigate} />
      <FAQSection />
      <CTASection navigate={navigate} onDownloadClick={notifyComingSoon} />
      <LandingFooter navigate={navigate} theme={theme} />
      <ComingSoonToast show={showComingSoon} />
    </div>
  );
}
