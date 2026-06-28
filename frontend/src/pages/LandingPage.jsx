import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import { BrandLogo } from '../components/brand/BrandLogo';
import './LandingPage.css';

/* ══════════════════════════════════════════════════════
   DATA
══════════════════════════════════════════════════════ */

// Fonctionnalités spécifiques Restaurant
const FEATURES_RESTAURANT = [
  { icon:'🍽️', color:'#FF8A00', bg:'rgba(255,138,0,.12)', title:'Marketplace Intelligente', desc:'Découvrez les meilleurs restaurants, snacks et cafés triés par note, proximité et disponibilité.' },
  { icon:'📅', color:'#3B82F6', bg:'rgba(59,130,246,.12)', title:'Réservation de Table', desc:'Réservez votre table en quelques secondes ou précommandez votre repas.' },
  { icon:'🛵', color:'#F59E0B', bg:'rgba(245,158,11,.12)', title:'Livraison & Click & Collect', desc:'Commandez en ligne avec suivi en temps réel jusqu\'à votre porte.' },
  { icon:'🌟', color:'#8B5CF6', bg:'rgba(139,92,246,.12)', title:'Recommandations IA', desc:'L\'IA apprend vos préférences et propose les meilleures adresses personnalisées.' },
  { icon:'💎', color:'#EC4899', bg:'rgba(236,72,153,.12)', title:'Programme Fidélité', desc:'Gagnez des points, débloquez des récompenses et des badges exclusifs.' },
  { icon:'⭐', color:'#10B981', bg:'rgba(16,185,129,.12)', title:'Avis & Notations', desc:'Avis vérifiés, photos des plats, notes détaillées par catégorie.' },
];

// Fonctionnalités spécifiques Cantine
const FEATURES_CANTEEN = [
  { icon:'📅', color:'#22C55E', bg:'rgba(34,197,94,.12)', title:'Planification des Menus', desc:'Créez et publiez les menus de la semaine avec quotas et disponibilités.' },
  { icon:'📷', color:'#3B82F6', bg:'rgba(59,130,246,.12)', title:'Validation QR Code', desc:'Contrôlez l\'accès aux repas avec scan QR instantané au self ou guichet.' },
  { icon:'📊', color:'#06B6D4', bg:'rgba(6,182,212,.12)', title:'Statistiques & Gaspillage', desc:'Taux de participation, no-shows, gaspillage alimentaire en temps réel.' },
  { icon:'🤖', color:'#8B5CF6', bg:'rgba(139,92,246,.12)', title:'IA Nutritionnelle', desc:'Analyse nutritionnelle automatique de chaque plat avec recommandations santé.' },
  { icon:'🏢', color:'#FF8A00', bg:'rgba(255,138,0,.12)', title:'Multi-Organisations', desc:'Gérez plusieurs cantines, départements ou sites depuis un seul tableau de bord.' },
  { icon:'👥', color:'#EC4899', bg:'rgba(236,72,153,.12)', title:'Gestion des Employés', desc:'Importez vos équipes, gérez les quotas et subventions individuellement.' },
];

// Kept for backward compatibility in FeaturesSection
const FEATURES = [...FEATURES_RESTAURANT];

const STATS = [
  { value:500, suffix:'+', label:'Restaurants', icon:'🍽️' },
  { value:50000, suffix:'+', label:'Utilisateurs', icon:'👥', format:'k' },
  { value:2, suffix:'M+', label:'Repas servis', icon:'🍱' },
  { value:300, suffix:'+', label:'Entreprises', icon:'🏢' },
  { value:120, suffix:'+', label:'Écoles', icon:'🎓' },
  { value:98, suffix:'%', label:'Satisfaction', icon:'⭐' },
];

const TESTIMONIALS = [
  { name:'Mohammed Al-Rashid', role:'Directeur RH · TechCorp', rating:5, text:'RestoBook a révolutionné la gestion de notre cantine. Les employés adorent la simplicité et la qualité des recommandations IA.', avatar:'MA' },
  { name:'Leila Benali', role:'Chef · Restaurant Le Maroc', rating:5, text:'L\'interface est magnifique et intuitive. Mes commandes ont augmenté de 40% depuis que j\'ai rejoint RestoBook.', avatar:'LB' },
  { name:'Ahmed Cherif', role:'Étudiant · Casablanca', rating:5, text:'Je trouve toujours le bon restaurant rapidement. Les filtres intelligents et les recommandations IA sont vraiment pertinents.', avatar:'AC' },
  { name:'Fatima Zahra', role:'Manager · École Supérieure', rating:5, text:'La gestion des menus scolaires n\'a jamais été aussi simple. Le suivi nutritionnel est exceptionnel.', avatar:'FZ' },
];

const RESTAURANT_PREVIEWS = [
  { name:'Le Jardin des Saveurs', type:'Restaurant', city:'Casablanca', rating:4.8, reviews:342, prep:25, delivery:true, cover:'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=600&q=80', tags:['Marocain','Gastronomique'] },
  { name:'Pizza Express Casa', type:'Pizzeria', city:'Casablanca', rating:4.6, reviews:218, prep:20, delivery:true, cover:'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80', tags:['Italien','Pizza'] },
  { name:'Snack Le Rapide', type:'Snack', city:'Rabat', rating:4.3, reviews:156, prep:12, delivery:true, cover:'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80', tags:['Fast-food','Burgers'] },
];

const PRICING_MARKETPLACE = [
  { name:'Découverte', price:'Gratuit', period:'', icon:'🆓', cta:'Commencer gratuitement', popular:false, features:['Accès marketplace complète','5 commandes par mois','Historique 30 jours','Support email'] },
  { name:'Premium',    price:'99',      period:'/mois', icon:'💎', cta:'Essai 30 jours offerts', popular:true,  features:['Commandes illimitées','Fidélité Gold ×2 points','Livraison offerte ×5/mois','Recommandations IA','Support prioritaire 24h'] },
  { name:'Famille',    price:'199',     period:'/mois', icon:'👨‍👩‍👧', cta:'Choisir Famille',     popular:false, features:['4 profils inclus','Tous avantages Premium','Wallet famille partagé','Historique illimité','Gestion allergies enfants'] },
];
const PRICING_PRO = [
  { name:'Starter',   price:'299',      period:'/mois', icon:'🏪', cta:'Démarrer',            popular:false, features:['1 établissement','100 commandes/jour','Menu digital','QR Code table','Statistiques basiques'] },
  { name:'Pro',       price:'799',      period:'/mois', icon:'🚀', cta:'Essai 14 jours',       popular:true,  features:['5 établissements','Commandes illimitées','IA Analytics avancée','Fidélisation clients','Accès API','Support dédié'] },
  { name:'Enterprise',price:'Sur devis',period:'',      icon:'🏢', cta:'Nous contacter',       popular:false, features:['Sites illimités','Intégration RH/Paie','Menus hebdomadaires','Gestion subventions repas','Déploiement accompagné','SLA 99,9% garanti'] },
];

const FAQ_ITEMS = [
  { q:'Qu\'est-ce que RestoBook ?', a:'RestoBook est une plateforme SaaS de restauration premium qui connecte les clients, les restaurants et les cantines d\'entreprise. Elle propose une marketplace de restaurants, la réservation en ligne, la gestion des menus de cantine, et des outils analytiques avancés alimentés par l\'IA.' },
  { q:'RestoBook est-il disponible dans ma ville ?', a:'RestoBook est disponible dans les principales villes du Maroc (Casablanca, Rabat, Marrakech, Agadir, Fès, Tanger). L\'expansion est continue — utilisez la géolocalisation pour voir les établissements disponibles près de vous.' },
  { q:'Comment rejoindre la marketplace en tant que restaurant ?', a:'Cliquez sur « Espace pro » dans la marketplace, créez votre compte restaurateur, renseignez les informations de votre établissement (photos, menu, horaires) et passez en live en moins de 24h. Notre équipe vous accompagne pour l\'onboarding.' },
  { q:'Comment fonctionne la gestion des cantines ?', a:'RestoBook Canteen est une solution B2B dédiée aux cantines d\'entreprise, scolaires et hospitalières. Elle couvre la planification des menus, la gestion des quotas employés, la validation QR Code, les statistiques de fréquentation et le suivi nutritionnel IA.' },
  { q:'Peut-on essayer RestoBook gratuitement ?', a:'Oui — le plan Découverte est 100% gratuit avec 5 commandes/mois. Pour les professionnels (restaurants, cantines), nous offrons 14 jours d\'essai sur le plan Pro sans carte bancaire requise.' },
  { q:'Quels modes de paiement sont acceptés ?', a:'Paiement à la livraison/au retrait, carte bancaire (Visa, Mastercard) et portefeuille numérique. Pour les abonnements Pro, virement bancaire et prélèvement automatique disponibles.' },
  { q:'Les données de ma cantine sont-elles sécurisées ?', a:'Absolument. RestoBook utilise le chiffrement SSL/TLS, des sauvegardes automatiques quotidiennes et des serveurs hébergés en zone sécurisée. Vos données ne sont jamais partagées avec des tiers.' },
];

const NAV_LINKS = [
  { label:'Restaurants', href:'#restaurants' },
  { label:'Marketplace', href:'#marketplace' },
  { label:'Solutions Cantine', href:'#cantines' },
  { label:'IA RestoBook', href:'#ai' },
  { label:'Tarifs', href:'#pricing' },
];

/* ══════════════════════════════════════════════════════
   HOOKS
══════════════════════════════════════════════════════ */

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('lp-theme') || 'dark');
  const toggle = () => setTheme(t => { const n = t==='dark'?'light':'dark'; localStorage.setItem('lp-theme',n); return n; });
  return [theme, toggle];
}

function useCounter(target, decimals=0, suffix='') {
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

/* ══════════════════════════════════════════════════════
   ANIMATION VARIANTS
══════════════════════════════════════════════════════ */

const fadeUp     = { hidden:{ opacity:0, y:40 },   visible:{ opacity:1, y:0, transition:{ duration:.55, ease:[.4,0,.2,1] } } };
const fadeIn     = { hidden:{ opacity:0 },           visible:{ opacity:1, transition:{ duration:.4 } } };
const slideRight = { hidden:{ opacity:0, x:-40 },   visible:{ opacity:1, x:0, transition:{ duration:.55, ease:[.4,0,.2,1] } } };
const slideLeft  = { hidden:{ opacity:0, x:40 },    visible:{ opacity:1, x:0, transition:{ duration:.55, ease:[.4,0,.2,1] } } };
const stagger    = { visible:{ transition:{ staggerChildren:.09 } } };
const float      = { animate:{ y:[0,-12,0], transition:{ duration:3.5, repeat:Infinity, ease:'easeInOut' } } };
const float2     = { animate:{ y:[0,10,0], transition:{ duration:4.2, repeat:Infinity, ease:'easeInOut', delay:.7 } } };

/* ══════════════════════════════════════════════════════
   COMPONENTS
══════════════════════════════════════════════════════ */

/* ─── Navbar ─── */
function LandingNav({ theme, toggleTheme, navigate }) {
  const scrolled = useScrollNav();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className={`lp-nav ${scrolled?'scrolled':''}`}>
      {/* Logo */}
      <motion.div onClick={()=>navigate('/landing')} style={{ display:'flex', alignItems:'center', cursor:'pointer', textDecoration:'none', flexShrink:0 }}
        whileHover={{ scale:1.02 }}>
        <BrandLogo variant="full" theme={theme} size="xs"
          className="d-none d-sm-block"
          style={{ height:88, filter:'drop-shadow(0 4px 8px rgba(255,138,0,.35))' }} />
        <BrandLogo variant="icon" theme={theme} size="xs"
          className="d-sm-none"
          style={{ height:40, borderRadius:10, filter:'drop-shadow(0 4px 8px rgba(255,138,0,.35))' }} />
      </motion.div>

      {/* Nav links (desktop) */}
      <div className="lp-nav-links" style={{ display:'flex', gap:4, flex:1, justifyContent:'center', marginLeft:32 }}>
        {NAV_LINKS.map(({ label, href }) => (
          <a key={label} href={href} className="lp-nav-link">{label}</a>
        ))}
      </div>

      {/* Right actions — desktop */}
      <div className="lp-nav-right-full">
        <motion.button onClick={toggleTheme} whileHover={{ scale:1.1 }} whileTap={{ scale:.95 }} style={{ width:36, height:36, borderRadius:10, border:'1px solid var(--lp-border)', background:'var(--lp-surface)', color:'var(--lp-text)', fontSize:16, cursor:'pointer', display:'grid', placeItems:'center' }}>
          {theme==='dark'?'☀️':'🌙'}
        </motion.button>
        <motion.button onClick={()=>navigate('/login')} whileHover={{ scale:1.02 }} style={{ padding:'8px 18px', borderRadius:10, border:'1.5px solid var(--lp-orange,#FF8A00)', background:'transparent', color:'var(--lp-orange,#FF8A00)', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
          🏢 Espace pro
        </motion.button>
        <motion.button onClick={()=>navigate('/marketplace')} whileHover={{ scale:1.02, boxShadow:'0 8px 28px var(--lp-orange-glow)' }} whileTap={{ scale:.98 }} className="lp-btn-primary" style={{ padding:'9px 18px', fontSize:13 }}>
          Explorer →
        </motion.button>
      </div>

      {/* Right actions — mobile (theme + hamburger) */}
      <div className="lp-nav-right-mobile">
        <motion.button onClick={toggleTheme} whileHover={{ scale:1.1 }} whileTap={{ scale:.95 }} style={{ width:36, height:36, borderRadius:10, border:'1px solid var(--lp-border)', background:'var(--lp-surface)', color:'var(--lp-text)', fontSize:16, cursor:'pointer', display:'grid', placeItems:'center' }}>
          {theme==='dark'?'☀️':'🌙'}
        </motion.button>
        <button className="lp-hamburger" onClick={() => setMobileOpen(true)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <div className="lp-mobile-overlay" onClick={() => setMobileOpen(false)} />
            <div className="lp-mobile-menu">
              <button className="lp-mobile-menu-close" onClick={() => setMobileOpen(false)}>✕</button>

              {/* Nav links */}
              {NAV_LINKS.map(({ label, href }) => (
                <a key={label} href={href} className="lp-mobile-link" onClick={() => setMobileOpen(false)}>{label}</a>
              ))}

              <div className="lp-mobile-divider" />

              {/* CTA buttons */}
              <button onClick={() => { navigate('/login'); setMobileOpen(false); }}
                style={{ padding:'13px 16px', borderRadius:12, border:'1.5px solid var(--lp-orange,#FF8A00)', background:'transparent', color:'var(--lp-orange,#FF8A00)', fontSize:14, fontWeight:700, cursor:'pointer', textAlign:'center', width:'100%' }}>
                🏢 Espace pro
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
function HeroSection({ navigate }) {
  return (
    <section className="lp-hero-bg lp-grid-bg" style={{ minHeight:'100vh', display:'flex', alignItems:'center', position:'relative', overflow:'hidden', paddingTop:68 }}>
      {/* Animated orbs — clampées pour éviter l'overflow horizontal sur mobile */}
      <motion.div animate={{ x:[0,40,-20,0], y:[0,-30,20,0] }} transition={{ duration:16, repeat:Infinity, ease:'easeInOut' }}
        style={{ position:'absolute', top:'8%', left:'5%', width:'clamp(200px,40vw,500px)', height:'clamp(200px,40vw,500px)', borderRadius:'50%', background:'radial-gradient(circle,rgba(255,138,0,.14),transparent 70%)', pointerEvents:'none', filter:'blur(40px)', maxWidth:'50vw' }} />
      <motion.div animate={{ x:[0,-40,30,0], y:[0,40,-20,0] }} transition={{ duration:20, repeat:Infinity, ease:'easeInOut', delay:2 }}
        style={{ position:'absolute', bottom:'10%', right:'5%', width:'clamp(160px,32vw,400px)', height:'clamp(160px,32vw,400px)', borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,.12),transparent 70%)', pointerEvents:'none', filter:'blur(40px)', maxWidth:'45vw' }} />
      <motion.div animate={{ x:[0,30,-15,0], y:[0,-15,30,0] }} transition={{ duration:14, repeat:Infinity, ease:'easeInOut', delay:4 }}
        style={{ position:'absolute', top:'40%', right:'30%', width:'clamp(120px,25vw,300px)', height:'clamp(120px,25vw,300px)', borderRadius:'50%', background:'radial-gradient(circle,rgba(6,182,212,.08),transparent 70%)', pointerEvents:'none', filter:'blur(40px)', maxWidth:'35vw' }} />

      <div className="lp-hero-grid">

        {/* Left: Content */}
        <motion.div variants={stagger} initial="hidden" animate="visible">
          <motion.div variants={fadeUp} style={{ marginBottom:20 }}>
            <span className="lp-section-badge" style={{ animation:'lp-badge-pulse 2.5s infinite' }}>
              🆕 Nouvelle expérience culinaire
            </span>
          </motion.div>

          <motion.h1 variants={fadeUp} style={{ fontSize:'clamp(36px,5vw,68px)', fontWeight:800, lineHeight:1.1, letterSpacing:-2, color:'var(--lp-text)', margin:'0 0 22px' }}>
            Vivez une nouvelle façon{' '}
            <span className="lp-gradient-text">de découvrir</span>{' '}
            la restauration
          </motion.h1>

          <motion.p variants={fadeUp} style={{ fontSize:'clamp(15px,2vw,19px)', color:'var(--lp-text2)', lineHeight:1.65, margin:'0 0 36px', maxWidth:520 }}>
            Marketplace intelligente · Réservation express · Cantines connectées · Nutrition IA — tout en une seule plateforme premium.
          </motion.p>

          <motion.div variants={fadeUp} style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:40 }}>
            <motion.button onClick={()=>navigate('/marketplace')} whileHover={{ scale:1.03, boxShadow:'0 12px 40px var(--lp-orange-glow)' }} whileTap={{ scale:.97 }} className="lp-btn-primary" style={{ fontSize:16, padding:'16px 32px' }}>
              Découvrir →
            </motion.button>
            <motion.button onClick={()=>navigate('/login')} whileHover={{ scale:1.02 }} whileTap={{ scale:.98 }} className="lp-btn-outline" style={{ fontSize:16, padding:'15px 30px' }}>
              Commencer gratuitement
            </motion.button>
          </motion.div>

          {/* Trust badges */}
          <motion.div variants={fadeUp} style={{ display:'flex', gap:20, alignItems:'center', flexWrap:'wrap' }}>
            {[['🔒','Sécurisé SSL'],['🌟','4.9/5 étoiles'],['⚡','Setup rapide']].map(([icon,label]) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--lp-muted)', fontWeight:500 }}>
                <span>{icon}</span>{label}
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Right: Mockup collage */}
        <div className="lp-hero-right" style={{ position:'relative', height:560 }}>
          {/* Main card */}
          <motion.div initial={{ opacity:0, scale:.9, y:30 }} animate={{ opacity:1, scale:1, y:0 }} transition={{ duration:.7, ease:[.4,0,.2,1], delay:.2 }}
            style={{ position:'absolute', top:'10%', left:'5%', right:'5%', background:'var(--lp-card)', borderRadius:24, overflow:'hidden', border:'1px solid var(--lp-border)', boxShadow:'var(--lp-shadow-lg)' }}>
            <img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=700&q=75" alt="" style={{ width:'100%', height:180, objectFit:'cover', display:'block' }} />
            <div style={{ padding:'16px 18px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:16, color:'var(--lp-text)', marginBottom:2 }}>Le Jardin des Saveurs</div>
                  <div style={{ fontSize:12, color:'var(--lp-muted)' }}>🍽️ Restaurant gastronomique · Casablanca</div>
                </div>
                <span style={{ background:'rgba(34,197,94,.15)', color:'var(--lp-green)', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:20 }}>● Ouvert</span>
              </div>
              <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                <span style={{ color:'#F59E0B', fontSize:13 }}>★★★★★</span>
                <span style={{ fontSize:12, fontWeight:700, color:'var(--lp-text)' }}>4.9</span>
                <span style={{ fontSize:12, color:'var(--lp-muted)' }}>(342 avis)</span>
                <span style={{ fontSize:12, color:'var(--lp-muted)', marginLeft:'auto' }}>🛵 Livraison gratuite</span>
              </div>
            </div>
          </motion.div>

          {/* Floating: Notification */}
          <motion.div {...float} initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0, ...float.animate }} transition={{ duration:.5, delay:.6 }}
            className="lp-glass" style={{ position:'absolute', top:'4%', right:'-4%', padding:'14px 16px', minWidth:200, display:'flex', gap:10, alignItems:'center' }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,var(--lp-orange),var(--lp-orange2))', display:'grid', placeItems:'center', fontSize:18, flexShrink:0 }}>🔔</div>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--lp-text)' }}>Commande confirmée !</div>
              <div style={{ fontSize:11, color:'var(--lp-muted)' }}>Livraison dans ~25 min</div>
            </div>
          </motion.div>

          {/* Floating: AI Recommendation */}
          <motion.div {...float2} initial={{ opacity:0, x:-30 }} animate={{ opacity:1, x:0, ...float2.animate }} transition={{ duration:.5, delay:.8 }}
            className="lp-glass" style={{ position:'absolute', bottom:'28%', left:'-6%', padding:'14px 16px', minWidth:220 }}>
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
              <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#8B5CF6,#4F46E5)', display:'grid', placeItems:'center', fontSize:14 }}>✨</div>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--lp-purple)' }}>IA RestoBook</span>
            </div>
            <div style={{ fontSize:12, color:'var(--lp-text2)', lineHeight:1.4 }}>Je recommande le <strong style={{ color:'var(--lp-orange)' }}>Tagine Royal</strong> selon vos goûts !</div>
          </motion.div>

          {/* Floating: Stats */}
          <motion.div animate={{ y:[0,-8,0] }} transition={{ duration:3.8, repeat:Infinity, ease:'easeInOut', delay:1 }}
            initial={{ opacity:0, y:30 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}
            className="lp-glass" style={{ position:'absolute', bottom:'12%', right:'-2%', padding:'16px 20px', textAlign:'center' }}>
            <div style={{ fontSize:24, fontWeight:800, color:'var(--lp-orange)' }}>50k+</div>
            <div style={{ fontSize:11, color:'var(--lp-muted)', fontWeight:600 }}>Utilisateurs actifs</div>
            <div style={{ fontSize:10, color:'var(--lp-green)', marginTop:2, fontWeight:700 }}>↑ +12% ce mois</div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div animate={{ y:[0,8,0] }} transition={{ duration:1.5, repeat:Infinity, ease:'easeInOut' }}
        style={{ position:'absolute', bottom:28, left:'50%', transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', gap:6, opacity:.4 }}>
        <div style={{ width:20, height:34, borderRadius:12, border:'2px solid var(--lp-muted)', display:'flex', justifyContent:'center', paddingTop:6 }}>
          <div style={{ width:3, height:8, borderRadius:4, background:'var(--lp-muted)' }} />
        </div>
        <span style={{ fontSize:10, color:'var(--lp-muted)', fontWeight:600, letterSpacing:'.08em' }}>SCROLL</span>
      </motion.div>
    </section>
  );
}

/* ─── Search ─── */
function SearchSection({ navigate }) {
  const [q, setQ]         = useState('');
  const [focused, setFocused] = useState(false);
  const suggestions = ['Tagine marocain 🍲', 'Pizza napolitaine 🍕', 'Sushi premium 🍣', 'Burger artisanal 🍔', 'Café au lait ☕', 'Pâtisseries françaises 🥐'];

  return (
    <motion.section id="restaurants" className="lp-section" style={{ paddingTop:40, paddingBottom:60, background:'var(--lp-bg2)' }}
      initial="hidden" whileInView="visible" viewport={{ once:true, margin:'-80px' }} variants={fadeUp}>
      <div style={{ maxWidth:800, margin:'0 auto', textAlign:'center' }}>
        <div className="lp-section-badge">🔍 Recherche intelligente</div>
        <h2 style={{ fontSize:'clamp(26px,4vw,40px)', fontWeight:800, color:'var(--lp-text)', margin:'0 0 10px', letterSpacing:-.5 }}>
          Trouvez exactement ce que vous cherchez
        </h2>
        <p style={{ color:'var(--lp-muted)', fontSize:15, marginBottom:32 }}>Restaurants, plats, cuisines, villes — la recherche instantanée IA fait le reste</p>

        {/* Search bar */}
        <div style={{ position:'relative' }}>
          <div style={{
            display:'flex', gap:10, background:'var(--lp-surface)',
            borderRadius:18, padding:'8px 8px 8px 22px',
            border:`2px solid ${focused?'var(--lp-orange)':'var(--lp-border)'}`,
            boxShadow: focused?`0 0 0 4px var(--lp-orange-light),var(--lp-shadow-lg)`:0,
            transition:'all .2s',
          }}>
            <span style={{ display:'flex', alignItems:'center', fontSize:20 }}>🔍</span>
            <input value={q} onChange={e=>setQ(e.target.value)}
              onFocus={()=>setFocused(true)} onBlur={()=>setTimeout(()=>setFocused(false),200)}
              placeholder="Restaurant, plat, cuisine, ville, spécialité…"
              style={{ flex:1, border:'none', outline:'none', fontSize:16, background:'transparent', color:'var(--lp-text)', padding:'8px 0' }} />
            <motion.button onClick={()=>navigate('/marketplace'+(q?`?q=${encodeURIComponent(q)}`:'' ))}
              whileHover={{ scale:1.02 }} whileTap={{ scale:.97 }}
              className="lp-btn-primary" style={{ padding:'13px 26px', fontSize:15, borderRadius:12 }}>
              Rechercher
            </motion.button>
          </div>

          {/* Autocomplete dropdown */}
          <AnimatePresence>
            {focused && (
              <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }} transition={{ duration:.18 }}
                style={{ position:'absolute', top:'calc(100% + 8px)', left:0, right:0, background:'var(--lp-surface)', borderRadius:16, border:'1px solid var(--lp-border)', boxShadow:'var(--lp-shadow-lg)', padding:8, zIndex:10 }}>
                {suggestions.map((s,i) => (
                  <div key={i} onClick={()=>{ setQ(s.split(' ')[0]); navigate('/marketplace'); }}
                    style={{ padding:'10px 14px', borderRadius:10, cursor:'pointer', fontSize:14, color:'var(--lp-text2)', display:'flex', alignItems:'center', gap:8, transition:'background .15s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--lp-orange-light)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <span style={{ color:'var(--lp-muted)', fontSize:13 }}>🔍</span>{s}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Quick tags */}
        <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:20, flexWrap:'wrap' }}>
          {['🍕 Pizza','🍣 Sushi','🥩 Viande','🥗 Végétarien','☕ Café','🥐 Boulangerie','🍔 Burgers','🍱 Japonais'].map(tag => (
            <motion.button key={tag} whileHover={{ scale:1.05 }} whileTap={{ scale:.97 }}
              onClick={()=>navigate('/marketplace')} style={{ padding:'7px 15px', borderRadius:20, border:'1px solid var(--lp-border)', background:'var(--lp-card)', color:'var(--lp-text2)', fontSize:13, fontWeight:500, cursor:'pointer', transition:'all .15s' }}>
              {tag}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

/* ─── Stats ─── */
function StatCounter({ stat }) {
  const isK = stat.format === 'k';
  const target = isK ? stat.value/1000 : stat.value;
  const decimals = isK ? 0 : 0;
  const [count, ref] = useCounter(target, decimals);
  const display = isK ? `${count}k` : count.toLocaleString('fr-FR');

  return (
    <motion.div ref={ref} className="lp-stat-card"
      initial={{ opacity:0, y:30 }}
      whileInView={{ opacity:1, y:0 }}
      viewport={{ once:true, amount:0.3 }}
      transition={{ duration:.5, ease:[.4,0,.2,1] }}
    >
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
            RestoBook en chiffres
          </h2>
          <p style={{ color:'var(--lp-muted)', fontSize:15 }}>Une plateforme qui grandit chaque jour grâce à sa communauté</p>
        </motion.div>
        <div className="lp-stats-grid">
          {STATS.map(stat => <StatCounter key={stat.label} stat={stat} />)}
        </div>
      </div>
    </section>
  );
}

/* ─── Features ─── */
/* ─── Deux Univers Section (après la Hero) ─── */
function TwoUniversesSection({ navigate }) {
  return (
    <section id="univers" className="lp-section" style={{ background:'var(--lp-bg)', paddingTop:80, paddingBottom:80 }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <motion.div initial={{ opacity:0, y:30 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:.6 }}
          style={{ textAlign:'center', marginBottom:56 }}>
          <div className="lp-section-badge">🌍 Deux solutions, un seul choix</div>
          <h2 style={{ fontSize:'clamp(26px,4vw,44px)', fontWeight:800, color:'var(--lp-text)', margin:'0 0 14px', letterSpacing:-.5, lineHeight:1.2 }}>
            Choisissez votre <span className="lp-gradient-text">univers RestoBook</span>
          </h2>
          <p style={{ color:'var(--lp-muted)', fontSize:16, maxWidth:580, margin:'0 auto' }}>
            Deux modules distincts, conçus pour deux réalités différentes. Choisissez celui qui correspond à votre métier.
          </p>
        </motion.div>

        <div className="lp-two-universes-grid">

          {/* ── Carte Restaurant / Marketplace ─────────────────────────────── */}
          <motion.div
            initial={{ opacity:0, x:-40 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }} transition={{ duration:.65, ease:[.4,0,.2,1] }}
            style={{
              borderRadius:24, overflow:'hidden', position:'relative',
              border:'2px solid rgba(255,138,0,.25)',
              background:'linear-gradient(145deg, rgba(255,138,0,.07), transparent)',
              boxShadow:'0 0 0 0 rgba(255,138,0,0)',
              transition:'box-shadow .3s, transform .3s',
            }}
            whileHover={{ boxShadow:'0 20px 60px rgba(255,138,0,.15)', scale:1.01 }}
          >
            {/* Header */}
            <div style={{ padding:'36px 36px 24px', background:'linear-gradient(135deg,rgba(255,138,0,.15),rgba(255,138,0,.08))' }}>
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18 }}>
                <div style={{ width:56, height:56, borderRadius:16, background:'linear-gradient(135deg,#FF8A00,#FF8A00)', display:'grid', placeItems:'center', fontSize:28, boxShadow:'0 8px 24px rgba(255,138,0,.35)' }}>🍽️</div>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'#FF8A00', marginBottom:4 }}>Domaine Restaurant</div>
                  <div style={{ fontSize:22, fontWeight:800, color:'var(--lp-text)', letterSpacing:-.3 }}>RestoBook Restaurant</div>
                </div>
              </div>
              <p style={{ color:'var(--lp-muted)', fontSize:14, lineHeight:1.6, margin:0 }}>
                Pour les <strong style={{ color:'var(--lp-text)' }}>restaurants, snacks, cafés et boulangeries</strong>. Développez votre activité avec une marketplace publique, des réservations en ligne et la fidélisation client.
              </p>
            </div>

            {/* Pour qui */}
            <div style={{ padding:'20px 36px', borderTop:'1px solid rgba(255,138,0,.12)' }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--lp-muted)', marginBottom:12 }}>Pour qui ?</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {['🍽️ Restaurants', '☕ Cafés', '🥙 Snacks', '🥐 Boulangeries', '📦 Dark Kitchens', '👥 Clients finaux'].map(tag => (
                  <span key={tag} style={{ padding:'4px 12px', borderRadius:20, background:'rgba(255,138,0,.1)', border:'1px solid rgba(255,138,0,.2)', fontSize:12, fontWeight:600, color:'#FF8A00' }}>{tag}</span>
                ))}
              </div>
            </div>

            {/* Features */}
            <div style={{ padding:'20px 36px', borderTop:'1px solid rgba(255,138,0,.12)' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {['🌍 Marketplace publique & découverte', '📅 Réservation de table en ligne', '🛵 Livraison & Click & Collect', '⭐ Avis clients vérifiés', '💎 Programme fidélité & badges', '🤖 Recommandations IA personnalisées'].map(f => (
                  <div key={f} style={{ display:'flex', gap:8, alignItems:'flex-start', fontSize:13, color:'var(--lp-muted)' }}>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div style={{ padding:'24px 36px', borderTop:'1px solid rgba(255,138,0,.12)' }}>
              <motion.button onClick={() => navigate('/marketplace')} whileHover={{ scale:1.02 }} whileTap={{ scale:.98 }}
                style={{ width:'100%', padding:'14px', borderRadius:14, border:'none', background:'linear-gradient(135deg,#FF8A00,#FF8A00)', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', boxShadow:'0 8px 24px rgba(255,138,0,.35)', letterSpacing:-.2 }}>
                Explorer la Marketplace →
              </motion.button>
            </div>
          </motion.div>

          {/* ── Carte Cantine ─────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity:0, x:40 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }} transition={{ duration:.65, delay:.1, ease:[.4,0,.2,1] }}
            style={{
              borderRadius:24, overflow:'hidden', position:'relative',
              border:'2px solid rgba(34,197,94,.25)',
              background:'linear-gradient(145deg, rgba(34,197,94,.07), transparent)',
              transition:'box-shadow .3s, transform .3s',
            }}
            whileHover={{ boxShadow:'0 20px 60px rgba(34,197,94,.15)', scale:1.01 }}
          >
            {/* Header */}
            <div style={{ padding:'36px 36px 24px', background:'linear-gradient(135deg,rgba(34,197,94,.15),rgba(22,163,74,.08))' }}>
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18 }}>
                <div style={{ width:56, height:56, borderRadius:16, background:'linear-gradient(135deg,#22C55E,#16A34A)', display:'grid', placeItems:'center', fontSize:28, boxShadow:'0 8px 24px rgba(34,197,94,.35)' }}>🏢</div>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'#22C55E', marginBottom:4 }}>Domaine Cantine</div>
                  <div style={{ fontSize:22, fontWeight:800, color:'var(--lp-text)', letterSpacing:-.3 }}>RestoBook Canteen</div>
                </div>
              </div>
              <p style={{ color:'var(--lp-muted)', fontSize:14, lineHeight:1.6, margin:0 }}>
                Pour les <strong style={{ color:'var(--lp-text)' }}>entreprises, écoles, universités et hôpitaux</strong>. Gérez vos cantines internes avec des outils dédiés, sans aucune visibilité publique.
              </p>
            </div>

            {/* Pour qui */}
            <div style={{ padding:'20px 36px', borderTop:'1px solid rgba(34,197,94,.12)' }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--lp-muted)', marginBottom:12 }}>Pour qui ?</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {['🏢 Entreprises', '🎓 Universités', '🏫 Écoles', '🏥 Hôpitaux', '🏛️ Administrations', '👨‍💼 Employés & élèves'].map(tag => (
                  <span key={tag} style={{ padding:'4px 12px', borderRadius:20, background:'rgba(34,197,94,.1)', border:'1px solid rgba(34,197,94,.2)', fontSize:12, fontWeight:600, color:'#22C55E' }}>{tag}</span>
                ))}
              </div>
            </div>

            {/* Features */}
            <div style={{ padding:'20px 36px', borderTop:'1px solid rgba(34,197,94,.12)' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {['📅 Planification des menus de la semaine', '📷 Validation QR Code au self', '📊 Suivi gaspillage & statistiques', '🤖 IA Nutritionnelle par plat', '👥 Gestion employés & quotas', '🔒 Accès 100% privé, pas de marketplace'].map(f => (
                  <div key={f} style={{ display:'flex', gap:8, alignItems:'flex-start', fontSize:13, color:'var(--lp-muted)' }}>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mention: pas de marketplace publique */}
            <div style={{ margin:'0 36px', padding:'12px 16px', borderRadius:12, background:'rgba(34,197,94,.08)', border:'1px solid rgba(34,197,94,.15)', display:'flex', gap:8, alignItems:'center' }}>
              <span style={{ fontSize:16 }}>🔒</span>
              <span style={{ fontSize:12, color:'#22C55E', fontWeight:600 }}>Accès strictement interne — vos cantines n'apparaissent jamais sur la marketplace publique</span>
            </div>

            {/* CTA */}
            <div style={{ padding:'24px 36px', borderTop:'1px solid rgba(34,197,94,.12)', marginTop:16 }}>
              <motion.button onClick={() => navigate('/login')} whileHover={{ scale:1.02 }} whileTap={{ scale:.98 }}
                style={{ width:'100%', padding:'14px', borderRadius:14, border:'none', background:'linear-gradient(135deg,#22C55E,#16A34A)', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', boxShadow:'0 8px 24px rgba(34,197,94,.35)', letterSpacing:-.2 }}>
                Découvrir RestoBook Canteen →
              </motion.button>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const [tab, setTab] = useState('restaurant');
  const features = tab === 'restaurant' ? FEATURES_RESTAURANT : FEATURES_CANTEEN;

  return (
    <section id="about" className="lp-section" style={{ background:'var(--lp-bg2)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:'-80px' }} variants={fadeUp} style={{ textAlign:'center', marginBottom:48 }}>
          <div className="lp-section-badge">✨ Fonctionnalités</div>
          <h2 style={{ fontSize:'clamp(26px,4vw,42px)', fontWeight:800, color:'var(--lp-text)', margin:'0 0 12px', letterSpacing:-.5 }}>
            Tout pour <span className="lp-gradient-text">votre activité</span>
          </h2>
          <p style={{ color:'var(--lp-muted)', fontSize:15, maxWidth:520, margin:'0 auto 24px' }}>
            Des outils puissants adaptés à chaque contexte — restaurant ou cantine.
          </p>
          <div className="lp-tab-switcher">
            <button className={`lp-tab-btn${tab==='restaurant'?' active':''}`} onClick={() => setTab('restaurant')}>🍽️ Restaurants</button>
            <button className={`lp-tab-btn${tab==='canteen'?' active':''}`} onClick={() => setTab('canteen')}>🏢 Cantines</button>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-12 }} transition={{ duration:.26 }}>
            <div className="lp-feats-grid">
              {features.map((f,i) => (
                <motion.div key={i} className="lp-feat-card"
                  initial={{ opacity:0, y:28 }}
                  animate={{ opacity:1, y:0 }}
                  transition={{ duration:.45, delay:i*0.06, ease:[.4,0,.2,1] }}
                  whileHover={{ scale:1.02 }}
                >
                  <div className="lp-feat-icon" style={{ background:f.bg, color:f.color }}>
                    <span style={{ filter:'drop-shadow(0 2px 4px rgba(0,0,0,.2))' }}>{f.icon}</span>
                  </div>
                  <h3 style={{ fontSize:15, fontWeight:700, color:'var(--lp-text)', margin:'0 0 8px' }}>{f.title}</h3>
                  <p style={{ fontSize:13, color:'var(--lp-muted)', lineHeight:1.55, margin:0 }}>{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

/* ─── Marketplace Preview ─── */
function MarketplaceSection({ navigate }) {
  return (
    <section id="marketplace" className="lp-section" style={{ background:'var(--lp-bg)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp} style={{ textAlign:'center', marginBottom:52 }}>
          <div className="lp-section-badge">🍽️ Marketplace</div>
          <h2 style={{ fontSize:'clamp(26px,4vw,42px)', fontWeight:800, color:'var(--lp-text)', margin:'0 0 12px', letterSpacing:-.5 }}>
            Les meilleures adresses à portée de main
          </h2>
          <p style={{ color:'var(--lp-muted)', fontSize:15 }}>Découvrez des centaines de restaurants triés par note, distance et disponibilité</p>
        </motion.div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:20 }}>
          {RESTAURANT_PREVIEWS.map((r,i) => (
            <motion.div key={i} className="lp-resto-card"
              initial={{ opacity:0, y:40 }}
              whileInView={{ opacity:1, y:0 }}
              viewport={{ once:true, amount:0.15 }}
              transition={{ duration:.5, delay:i*0.12, ease:[.4,0,.2,1] }}
              whileHover={{ y:-6, boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}
              onClick={()=>navigate('/marketplace')}>
              <div style={{ position:'relative', overflow:'hidden' }}>
                <img src={r.cover} alt={r.name} style={{ width:'100%', height:190, objectFit:'cover', display:'block', transition:'transform .5s' }}
                  onMouseEnter={e=>e.currentTarget.style.transform='scale(1.05)'}
                  onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
                />
                <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 40%,rgba(0,0,0,.55))' }} />
                <span style={{ position:'absolute', top:10, right:10, background:'rgba(220,252,231,.95)', color:'#16A34A', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:20 }}>● Ouvert</span>
                <div style={{ position:'absolute', bottom:10, left:12, display:'flex', gap:6 }}>
                  {r.tags.map(t => <span key={t} style={{ background:'rgba(0,0,0,.55)', color:'rgba(255,255,255,.9)', fontSize:10, padding:'2px 8px', borderRadius:20, backdropFilter:'blur(4px)' }}>{t}</span>)}
                </div>
              </div>
              <div style={{ padding:'14px 16px' }}>
                <div style={{ fontWeight:700, fontSize:15, color:'var(--lp-text)', marginBottom:4 }}>{r.name}</div>
                <div style={{ fontSize:12, color:'var(--lp-muted)', marginBottom:8 }}>📍 {r.type} · {r.city}</div>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:12 }}>
                    <span style={{ color:'#F59E0B' }}>★</span>
                    <span style={{ fontWeight:700, color:'var(--lp-text)' }}>{r.rating}</span>
                    <span style={{ color:'var(--lp-muted)' }}>({r.reviews})</span>
                  </span>
                  <span style={{ fontSize:11, color:'var(--lp-muted)', background:'var(--lp-bg2)', padding:'2px 8px', borderRadius:20 }}>⏱ ~{r.prep} min</span>
                  {r.delivery && <span style={{ fontSize:11, color:'var(--lp-green)', background:'var(--lp-green-light)', padding:'2px 8px', borderRadius:20, fontWeight:700 }}>🛵 Livraison</span>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp} style={{ textAlign:'center', marginTop:40 }}>
          <motion.button onClick={()=>navigate('/marketplace')} whileHover={{ scale:1.03, boxShadow:'0 12px 40px var(--lp-orange-glow)' }} whileTap={{ scale:.97 }}
            className="lp-btn-primary" style={{ fontSize:16, padding:'15px 36px' }}>
            Voir tous les restaurants →
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── AI Section ─── */
function AISection() {
  const [activePrompt, setActivePrompt] = useState(0);
  const prompts = [
    { q:'Je veux manger végétarien ce soir', a:'🥗 Voici 12 restaurants végétariens près de vous avec une note > 4.5', icon:'🥗' },
    { q:'Suggère un repas riche en protéines', a:'💪 Poulet grillé, steak haché… 8 options à moins de 80 MAD', icon:'💪' },
    { q:'Restaurant romantique pour ce soir', a:'🕯️ 5 restaurants avec ambiance tamisée, disponibles ce soir', icon:'🕯️' },
    { q:'Quelle cuisine pour ma glycémie ?', a:'🩺 Recommandation : Légumes grillés, protéines maigres, index glycémique bas', icon:'🩺' },
  ];

  useEffect(() => {
    const id = setInterval(() => setActivePrompt(i => (i+1)%prompts.length), 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="ai" className="lp-section" style={{ background:'var(--lp-bg2)' }}>
      <div className="lp-2col-grid" style={{ maxWidth:1200, margin:'0 auto' }}>
        {/* Left */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:'-80px' }} variants={slideRight}>
          <div className="lp-section-badge">🤖 Intelligence Artificielle</div>
          <h2 style={{ fontSize:'clamp(28px,4vw,44px)', fontWeight:800, color:'var(--lp-text)', margin:'0 0 18px', lineHeight:1.15, letterSpacing:-.5 }}>
            L'IA qui comprend <span className="lp-gradient-text">vos goûts</span>
          </h2>
          <p style={{ color:'var(--lp-muted)', fontSize:15, lineHeight:1.65, marginBottom:28 }}>
            Notre IA analyse vos habitudes alimentaires, vos préférences gustatives et vos besoins nutritionnels pour vous offrir des recommandations ultra-personnalisées.
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {[
              ['✨','Recommandations personnalisées','Basées sur votre historique et vos préférences'],
              ['🍎','Analyse nutritionnelle','Calories, macronutriments, vitamines en temps réel'],
              ['📈','Prévision de fréquentation','Anticipez les temps d\'attente et planifiez mieux'],
              ['💬','Analyse des avis','Résumé IA des points forts et axes d\'amélioration'],
            ].map(([icon,title,desc]) => (
              <div key={title} style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
                <div style={{ width:40, height:40, borderRadius:12, background:'var(--lp-orange-light)', display:'grid', placeItems:'center', fontSize:18, flexShrink:0 }}>{icon}</div>
                <div>
                  <div style={{ fontWeight:600, fontSize:14, color:'var(--lp-text)', marginBottom:2 }}>{title}</div>
                  <div style={{ fontSize:12, color:'var(--lp-muted)' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right: Terminal animation */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:'-80px' }} variants={slideLeft}>
          <div style={{ background:'#0A0F1E', borderRadius:20, overflow:'hidden', border:'1px solid rgba(34,197,94,.2)', boxShadow:'0 20px 60px rgba(0,0,0,.5)' }}>
            {/* Terminal header */}
            <div style={{ background:'#111827', padding:'12px 16px', display:'flex', alignItems:'center', gap:6, borderBottom:'1px solid rgba(255,255,255,.06)' }}>
              <div style={{ width:12, height:12, borderRadius:'50%', background:'#EF4444' }} />
              <div style={{ width:12, height:12, borderRadius:'50%', background:'#F59E0B' }} />
              <div style={{ width:12, height:12, borderRadius:'50%', background:'#22C55E' }} />
              <span style={{ marginLeft:10, fontSize:12, color:'#64748B', fontFamily:'monospace' }}>restobook-ai</span>
            </div>

            <div className="lp-ai-terminal-body" style={{ padding:24, fontFamily:"'JetBrains Mono',monospace", fontSize:13, lineHeight:1.7 }}>
              <div style={{ color:'#64748B', marginBottom:16 }}># Assistant IA RestoBook v2.0</div>

              <AnimatePresence mode="wait">
                <motion.div key={activePrompt} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }} transition={{ duration:.3 }}>
                  <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                    <span style={{ color:'#22C55E' }}>vous@restobook</span>
                    <span style={{ color:'#64748B' }}>$</span>
                    <span style={{ color:'#E2E8F0' }}>ask "{prompts[activePrompt].q}"</span>
                  </div>
                  <div style={{ marginLeft:0, color:'#94A3B8', marginBottom:8 }}>
                    <span style={{ color:'#FF8A00' }}>→</span> Analyse en cours…
                  </div>
                  <div style={{ background:'rgba(34,197,94,.08)', borderRadius:12, padding:'14px', border:'1px solid rgba(34,197,94,.15)', marginBottom:16 }}>
                    <div style={{ color:'#22C55E', fontSize:11, fontWeight:700, marginBottom:6, fontFamily:'Poppins,sans-serif' }}>✓ RÉPONSE IA</div>
                    <div style={{ color:'#E2E8F0', fontFamily:'Poppins,sans-serif', fontSize:13, lineHeight:1.5 }}>
                      {prompts[activePrompt].a}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Prompt selector */}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {prompts.map((p,i) => (
                  <button key={i} onClick={()=>setActivePrompt(i)} style={{ padding:'4px 10px', borderRadius:8, border:`1px solid ${activePrompt===i?'rgba(255,138,0,.4)':'rgba(255,255,255,.08)'}`, background:activePrompt===i?'rgba(255,138,0,.1)':'transparent', color:activePrompt===i?'#FF8A00':'#64748B', cursor:'pointer', fontSize:18 }}>
                    {p.icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Cantines ─── */
function CantinesSection({ navigate }) {
  const features = [
    { icon:'🏢', label:'Entreprises' }, { icon:'🎓', label:'Universités' },
    { icon:'🏥', label:'Hôpitaux' },   { icon:'🏫', label:'Écoles' },
  ];

  return (
    <section id="cantines" className="lp-section" style={{ background:'var(--lp-bg)' }}>
      <div className="lp-2col-grid" style={{ maxWidth:1200, margin:'0 auto' }}>
        {/* Left visual */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:'-80px' }} variants={slideRight}>
          <div style={{ position:'relative' }}>
            <div style={{ background:'var(--lp-card)', borderRadius:24, overflow:'hidden', border:'1px solid var(--lp-border)', boxShadow:'var(--lp-shadow-lg)' }}>
              <img src="https://images.unsplash.com/photo-1567521464027-f127ff144326?auto=format&fit=crop&w=700&q=75" alt="Cantine moderne" style={{ width:'100%', height:280, objectFit:'cover', display:'block' }} />
              <div style={{ padding:20 }}>
                <div style={{ fontWeight:700, fontSize:15, color:'var(--lp-text)', marginBottom:10 }}>Cantine Entreprise · TechCorp</div>
                <div style={{ display:'flex', gap:8 }}>
                  {['Plat du jour','Végétarien','Sans gluten'].map(t => (
                    <span key={t} style={{ fontSize:11, background:'var(--lp-green-light)', color:'var(--lp-green)', padding:'3px 8px', borderRadius:20, fontWeight:600 }}>{t}</span>
                  ))}
                </div>
                <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                  {[['142','Repas / jour'],['98%','Satisfaction'],['0 min','Attente']].map(([v,l]) => (
                    <div key={l} style={{ textAlign:'center', background:'var(--lp-bg2)', borderRadius:12, padding:'10px 6px' }}>
                      <div style={{ fontWeight:800, fontSize:17, color:'var(--lp-orange)' }}>{v}</div>
                      <div style={{ fontSize:11, color:'var(--lp-muted)' }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating QR */}
            <motion.div animate={{ y:[0,-10,0] }} transition={{ duration:3.5, repeat:Infinity, ease:'easeInOut' }}
              className="lp-glass lp-canteen-qr-float" style={{ padding:'14px 18px', display:'flex', gap:12, alignItems:'center' }}>
              <div style={{ width:40, height:40, background:'var(--lp-text)', borderRadius:10, display:'grid', placeItems:'center', fontSize:22 }}>⬛</div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--lp-text)' }}>Scan & Commande</div>
                <div style={{ fontSize:11, color:'var(--lp-muted)' }}>QR Code table</div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Right: Content */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:'-80px' }} variants={slideLeft}>
          <div className="lp-section-badge">🏢 Cantines Connectées</div>
          <h2 style={{ fontSize:'clamp(28px,4vw,42px)', fontWeight:800, color:'var(--lp-text)', margin:'0 0 18px', lineHeight:1.15, letterSpacing:-.5 }}>
            La restauration collective réinventée
          </h2>
          <p style={{ color:'var(--lp-muted)', fontSize:15, lineHeight:1.65, marginBottom:28 }}>
            RestoBook transforme la gestion des cantines d'entreprise, scolaires et hospitalières avec des outils digitaux puissants et intuitifs.
          </p>
          <div className="lp-canteen-icons-grid">
            {features.map(({ icon, label }) => (
              <motion.div key={label} whileHover={{ scale:1.05 }} style={{ background:'var(--lp-card)', borderRadius:14, padding:'16px 12px', textAlign:'center', border:'1px solid var(--lp-border)', cursor:'pointer' }}>
                <div style={{ fontSize:26, marginBottom:8 }}>{icon}</div>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--lp-text2)' }}>{label}</div>
              </motion.div>
            ))}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:32 }}>
            {[
              ['✅','Menus digitaux','Gérez et publiez les menus quotidiens en temps réel'],
              ['📱','QR Code ordering','Scannez et commandez directement depuis la table'],
              ['📊','Statistiques RH','Suivez la fréquentation, les coûts et la satisfaction'],
              ['🥗','Nutrition intégrée','Informations caloriques et allergènes affichées'],
            ].map(([icon,title,desc]) => (
              <div key={title} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <span style={{ fontSize:18 }}>{icon}</span>
                <div>
                  <span style={{ fontWeight:600, fontSize:14, color:'var(--lp-text)', marginRight:6 }}>{title} —</span>
                  <span style={{ fontSize:13, color:'var(--lp-muted)' }}>{desc}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
            <motion.button onClick={()=>navigate('/login')} whileHover={{ scale:1.03, boxShadow:'0 12px 40px rgba(34,197,94,.35)' }} style={{ padding:'13px 24px', borderRadius:14, border:'none', background:'linear-gradient(135deg,#22C55E,#16A34A)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
              Découvrir RestoBook Canteen →
            </motion.button>
            <motion.button onClick={()=>navigate('/landing#univers')} whileHover={{ scale:1.03 }} style={{ padding:'13px 24px', borderRadius:14, border:'1px solid rgba(34,197,94,.3)', background:'transparent', color:'var(--lp-text)', fontSize:14, fontWeight:600, cursor:'pointer' }}>
              Comparer les solutions
            </motion.button>
          </div>
          <div style={{ marginTop:16, padding:'12px 16px', borderRadius:12, background:'rgba(34,197,94,.08)', border:'1px solid rgba(34,197,94,.15)', fontSize:13, color:'#22C55E', fontWeight:600 }}>
            🔒 Vos cantines ne sont jamais visibles sur la marketplace publique
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Testimonials ─── */
function TestimonialsSection() {
  const [idx, setIdx] = useState(0);

  return (
    <section className="lp-section" style={{ background:'var(--lp-bg2)', overflow:'hidden' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp} style={{ textAlign:'center', marginBottom:48 }}>
          <div className="lp-section-badge">💬 Témoignages</div>
          <h2 style={{ fontSize:'clamp(26px,4vw,40px)', fontWeight:800, color:'var(--lp-text)', margin:'0 0 10px', letterSpacing:-.5 }}>
            Ils nous font confiance
          </h2>
          <p style={{ color:'var(--lp-muted)', fontSize:15 }}>Des milliers d'utilisateurs satisfaits partout au Maroc</p>
        </motion.div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
          {TESTIMONIALS.map((t,i) => (
            <motion.div key={i} className="lp-testi-card"
              initial={{ opacity:0, y:30 }}
              whileInView={{ opacity:1, y:0 }}
              viewport={{ once:true, amount:0.2 }}
              transition={{ duration:.5, delay:i*0.1, ease:[.4,0,.2,1] }}
              whileHover={{ y:-4, boxShadow:'var(--lp-shadow-lg)' }}
            >
              <div style={{ color:'#F59E0B', marginBottom:10, fontSize:16 }}>{'★'.repeat(t.rating)}</div>
              <p style={{ fontSize:14, color:'var(--lp-text2)', lineHeight:1.65, margin:'0 0 18px', fontStyle:'italic' }}>"{t.text}"</p>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:`linear-gradient(135deg,var(--lp-orange),var(--lp-orange2))`, display:'grid', placeItems:'center', fontWeight:800, color:'#fff', fontSize:14 }}>
                  {t.avatar}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--lp-text)' }}>{t.name}</div>
                  <div style={{ fontSize:12, color:'var(--lp-muted)' }}>{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Gallery ─── */
function GallerySection() {
  const images = [
    'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=600&q=75',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=75',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=75',
    'https://images.unsplash.com/photo-1567521464027-f127ff144326?auto=format&fit=crop&w=600&q=75',
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=75',
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=75',
  ];

  return (
    <section className="lp-section" style={{ background:'var(--lp-bg)', paddingTop:60, paddingBottom:60 }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp} style={{ textAlign:'center', marginBottom:36 }}>
          <div className="lp-section-badge">📸 Galerie</div>
          <h2 style={{ fontSize:'clamp(24px,3.5vw,38px)', fontWeight:800, color:'var(--lp-text)', margin:0, letterSpacing:-.5 }}>
            L'art de bien manger
          </h2>
        </motion.div>
        <div className="lp-gallery-grid">
          {images.map((url,i) => (
            <motion.div key={i}
              initial={{ opacity:0, scale:.96 }}
              whileInView={{ opacity:1, scale:1 }}
              viewport={{ once:true, amount:0.2 }}
              transition={{ duration:.45, delay:i*0.07 }}
              whileHover={{ scale:1.03, zIndex:2 }}
              style={{ borderRadius:16, overflow:'hidden', cursor:'pointer', boxShadow:'var(--lp-shadow)', transition:'box-shadow .2s' }}
            >
              <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', transition:'transform .4s' }}
                onMouseEnter={e=>e.currentTarget.style.transform='scale(1.08)'}
                onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing ─── */
function PricingSection({ navigate }) {
  const [tab, setTab] = useState('marketplace');
  const plans = tab === 'marketplace' ? PRICING_MARKETPLACE : PRICING_PRO;

  return (
    <section id="pricing" className="lp-section" style={{ background:'var(--lp-bg)' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:'-80px' }} variants={fadeUp} style={{ textAlign:'center', marginBottom:48 }}>
          <div className="lp-section-badge">💰 Tarifs</div>
          <h2 style={{ fontSize:'clamp(26px,4vw,42px)', fontWeight:800, color:'var(--lp-text)', margin:'0 0 12px', letterSpacing:-.5 }}>
            Des tarifs <span className="lp-gradient-text">transparents</span>
          </h2>
          <p style={{ color:'var(--lp-muted)', fontSize:15, maxWidth:480, margin:'0 auto 24px' }}>
            Pas de frais cachés. Changez ou annulez votre plan à tout moment.
          </p>
          <div className="lp-tab-switcher">
            <button className={`lp-tab-btn${tab==='marketplace'?' active':''}`} onClick={() => setTab('marketplace')}>🍽️ Marketplace</button>
            <button className={`lp-tab-btn${tab==='pro'?' active':''}`} onClick={() => setTab('pro')}>🏢 Pro / Cantine</button>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-12 }} transition={{ duration:.26 }}>
            <div className="lp-pricing-grid">
              {plans.map((p,i) => (
                <motion.div key={p.name}
                  className={`lp-pricing-card${p.popular?' popular':''}`}
                  initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} transition={{ duration:.45, delay:i*0.1 }}
                  whileHover={{ scale:1.015 }}
                >
                  {p.popular && <div className="lp-pricing-popular-badge">⭐ Plus populaire</div>}

                  <div style={{ marginBottom:22 }}>
                    <div style={{ fontSize:30, marginBottom:10 }}>{p.icon}</div>
                    <div style={{ fontWeight:700, fontSize:17, color:'var(--lp-text)', marginBottom:6 }}>{p.name}</div>
                    <div style={{ display:'flex', alignItems:'baseline', gap:3 }}>
                      {p.price === 'Sur devis' || p.price === 'Gratuit' ? (
                        <span style={{ fontSize:26, fontWeight:800, color:p.popular?'var(--lp-orange)':'var(--lp-text)' }}>{p.price}</span>
                      ) : (
                        <>
                          <span className="lp-pricing-price" style={{ color:p.popular?'var(--lp-orange)':'var(--lp-text)' }}>{p.price}</span>
                          <span style={{ fontSize:13, color:'var(--lp-muted)', marginLeft:4 }}>MAD/mois</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ borderTop:'1px solid var(--lp-border)', paddingTop:18, marginBottom:22 }}>
                    {p.features.map(f => (
                      <div key={f} className="lp-pricing-feature">
                        <span className="lp-pricing-check">✓</span>
                        {f}
                      </div>
                    ))}
                  </div>

                  <motion.button onClick={() => navigate('/login')} whileHover={{ scale:1.03 }} whileTap={{ scale:.97 }}
                    className={p.popular ? 'lp-btn-primary' : 'lp-btn-outline'}
                    style={{ width:'100%', justifyContent:'center', fontSize:14, padding:'13px 20px' }}>
                    {p.cta}
                  </motion.button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        <motion.p initial={{ opacity:0 }} whileInView={{ opacity:1 }} viewport={{ once:true }} transition={{ delay:.3 }}
          style={{ textAlign:'center', marginTop:28, fontSize:13, color:'var(--lp-muted)' }}>
          ✅ Pas de carte bancaire requise · 🔒 Annulation à tout moment · ⚡ Activation immédiate
        </motion.p>
      </div>
    </section>
  );
}

/* ─── FAQ ─── */
function FAQSection() {
  const [open, setOpen] = useState(null);

  return (
    <section id="faq" className="lp-section" style={{ background:'var(--lp-bg2)' }}>
      <div style={{ maxWidth:780, margin:'0 auto' }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:'-80px' }} variants={fadeUp} style={{ textAlign:'center', marginBottom:48 }}>
          <div className="lp-section-badge">❓ FAQ</div>
          <h2 style={{ fontSize:'clamp(26px,4vw,42px)', fontWeight:800, color:'var(--lp-text)', margin:'0 0 12px', letterSpacing:-.5 }}>
            Questions <span className="lp-gradient-text">fréquentes</span>
          </h2>
          <p style={{ color:'var(--lp-muted)', fontSize:15, margin:0 }}>Tout ce que vous devez savoir sur RestoBook</p>
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
                    initial={{ height:0, opacity:0 }}
                    animate={{ height:'auto', opacity:1 }}
                    exit={{ height:0, opacity:0 }}
                    transition={{ duration:.24, ease:[.4,0,.2,1] }}
                    style={{ overflow:'hidden' }}>
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

/* ─── CTA Final ─── */
function CTASection({ navigate }) {
  return (
    <section className="lp-cta-bg lp-section" style={{ textAlign:'center', position:'relative' }}>
      {/* Background orbs */}
      <div style={{ position:'absolute', top:'10%', left:'20%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,138,0,.12),transparent)', filter:'blur(60px)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'10%', right:'20%', width:250, height:250, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,.1),transparent)', filter:'blur(60px)', pointerEvents:'none' }} />

      <div style={{ maxWidth:720, margin:'0 auto', position:'relative', zIndex:1 }}>
        <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:.4 }}>
          <div className="lp-section-badge" style={{ margin:'0 auto 20px' }}>🚀 Commencez maintenant</div>
        </motion.div>
        <motion.h2 initial={{ opacity:0, y:25 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:.5, delay:.1 }}
          style={{ fontSize:'clamp(32px,5vw,56px)', fontWeight:800, color:'var(--lp-text)', margin:'0 0 18px', lineHeight:1.15, letterSpacing:-1 }}>
          Prêt à vivre une nouvelle<br/><span className="lp-gradient-text">expérience culinaire ?</span>
        </motion.h2>
        <motion.p initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:.5, delay:.18 }}
          style={{ fontSize:17, color:'var(--lp-muted)', margin:'0 0 40px', lineHeight:1.6 }}>
          Rejoignez des milliers d'utilisateurs et de restaurants qui font confiance à RestoBook chaque jour.
        </motion.p>
        <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:.5, delay:.26 }}
          style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
          <motion.button onClick={()=>navigate('/marketplace')} whileHover={{ scale:1.04, boxShadow:'0 16px 48px var(--lp-orange-glow)' }} whileTap={{ scale:.97 }}
            className="lp-btn-primary" style={{ fontSize:17, padding:'17px 40px' }}>
            Découvrir RestoBook →
          </motion.button>
          <motion.button onClick={()=>navigate('/login')} whileHover={{ scale:1.03 }} className="lp-btn-outline" style={{ fontSize:17, padding:'16px 38px' }}>
            Commencer gratuitement
          </motion.button>
        </motion.div>
        <motion.p initial={{ opacity:0 }} whileInView={{ opacity:1 }} viewport={{ once:true }} transition={{ duration:.4, delay:.36 }}
          style={{ marginTop:22, fontSize:13, color:'var(--lp-muted)' }}>
          ✅ Gratuit · 🔒 Sécurisé · ⚡ Setup en 2 minutes
        </motion.p>
      </div>
    </section>
  );
}

/* ─── Footer ─── */
function LandingFooter({ navigate, theme }) {
  const links = {
    'Produit':   ['Marketplace','Cantines','IA RestoBook','Nutrition','Statistiques'],
    'Entreprise':['À propos','Blog','Presse','Carrières','Contact'],
    'Support':   ['Documentation','FAQ','Statut','Sécurité','Confidentialité'],
    'Légal':     ['CGU','CGV','Mentions légales','Cookies'],
  };

  return (
    <footer style={{ background:'var(--lp-bg)', borderTop:'1px solid var(--lp-border)', padding:'60px clamp(16px,4vw,60px) 30px' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div className="lp-footer-grid" style={{ marginBottom:48 }}>
          {/* Brand */}
          <div>
            <div style={{ marginBottom:16 }}>
              <BrandLogo variant="full" theme={theme ?? 'dark'} size="xs" style={{ height:100 }} />
            </div>
            <p style={{ fontSize:13, color:'var(--lp-muted)', lineHeight:1.65, margin:'0 0 20px', maxWidth:240 }}>
              La plateforme de restauration premium qui révolutionne l'expérience culinaire au Maroc.
            </p>
            <div style={{ display:'flex', gap:10 }}>
              {['𝕏','in','📧'].map(icon => (
                <div key={icon} style={{ width:36, height:36, borderRadius:10, background:'var(--lp-card)', border:'1px solid var(--lp-border)', display:'grid', placeItems:'center', cursor:'pointer', fontSize:15, color:'var(--lp-muted)' }}>{icon}</div>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(links).map(([cat, items]) => (
            <div key={cat}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--lp-text)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:14 }}>{cat}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {items.map(item => (
                  <button key={item} onClick={()=>navigate('/marketplace')} style={{ background:'none', border:'none', padding:0, fontSize:13, color:'var(--lp-muted)', cursor:'pointer', textAlign:'left', transition:'color .15s' }}
                    onMouseEnter={e=>e.currentTarget.style.color='var(--lp-orange)'}
                    onMouseLeave={e=>e.currentTarget.style.color='var(--lp-muted)'}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop:'1px solid var(--lp-border)', paddingTop:24, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <span style={{ fontSize:12, color:'var(--lp-muted)' }}>© {new Date().getFullYear()} RestoBook. Tous droits réservés.</span>
          <div style={{ display:'flex', gap:8 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--lp-green)', display:'inline-block', boxShadow:`0 0 8px var(--lp-green)` }} />
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

  return (
    <div className={`lp lp-${theme}`}>
      <LandingNav theme={theme} toggleTheme={toggleTheme} navigate={navigate} />
      <HeroSection navigate={navigate} />
      <TwoUniversesSection navigate={navigate} />
      <SearchSection navigate={navigate} />
      <StatsSection />
      <FeaturesSection />
      <MarketplaceSection navigate={navigate} />
      <AISection />
      <CantinesSection navigate={navigate} />
      <TestimonialsSection />
      <GallerySection />
      <PricingSection navigate={navigate} />
      <FAQSection />
      <CTASection navigate={navigate} />
      <LandingFooter navigate={navigate} theme={theme} />
    </div>
  );
}
