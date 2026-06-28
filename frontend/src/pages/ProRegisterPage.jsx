import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API } from '../api';
import { BrandLogo } from '../components/brand/BrandLogo';

// ── Persistance brouillon ────────────────────────────────────────────────────
const DRAFT_KEY = 'rb_pro_register_draft';
const loadDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; } };
const saveDraft = (d) => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch {} };
const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch {} };

// ── Plan features (affichage) ─────────────────────────────────────────────────
const FEATURE_LABELS = {
  has_ai_features: '🤖 Intelligence artificielle',
  has_exports: '📊 Export des données',
  has_delivery_module: '🛵 Module livraison',
  has_loyalty_module: '🎁 Programme fidélité',
  has_canteen_module: '🏢 Module cantine',
};

// ── Types établissement ───────────────────────────────────────────────────────
const ESTAB_TYPES = [
  { value: 'restaurant', label: 'Restaurant', icon: '🍽️' },
  { value: 'snack',      label: 'Snack',      icon: '🥙' },
  { value: 'cafe',       label: 'Café',       icon: '☕' },
  { value: 'patisserie', label: 'Pâtisserie', icon: '🥐' },
  { value: 'fast_food',  label: 'Fast-food',  icon: '🍔' },
  { value: 'traiteur',   label: 'Traiteur',   icon: '🍱' },
  { value: 'bakery',     label: 'Boulangerie',icon: '🥖' },
  { value: 'autre',      label: 'Autre',      icon: '🏪' },
];

const ORG_TYPES = [
  { value: 'entreprise',      label: 'Entreprise',      icon: '🏢' },
  { value: 'ecole',           label: 'École',           icon: '🏫' },
  { value: 'universite',      label: 'Université',      icon: '🎓' },
  { value: 'administration',  label: 'Administration',  icon: '🏛️' },
  { value: 'hopital',         label: 'Hôpital',         icon: '🏥' },
  { value: 'usine',           label: 'Usine / Site',    icon: '🏭' },
  { value: 'autre',           label: 'Autre',           icon: '🔷' },
];

const RESTO_SERVICES = [
  { key: 'accepts_qr_table',   label: 'Commandes QR table', desc: 'Clients commandent depuis leur table' },
  { key: 'accepts_online',     label: 'Commandes en ligne',  desc: 'Via la marketplace RestoBook' },
  { key: 'accepts_delivery',   label: 'Livraison',           desc: 'Livraison à domicile' },
  { key: 'accepts_takeaway',   label: 'À emporter',          desc: 'Click & collect' },
  { key: 'accepts_reservation',label: 'Réservation de table',desc: 'Gestion des réservations' },
];

const CANTEEN_SERVICES = [
  { key: 'cs_menus',       label: 'Menus journaliers',         desc: 'Planification hebdomadaire' },
  { key: 'cs_orders',      label: 'Commandes internes',        desc: 'Précommandes par les employés' },
  { key: 'cs_employees',   label: 'Gestion employés / élèves', desc: 'Import et gestion des comptes' },
  { key: 'cs_badges',      label: 'Badges ou QR codes',        desc: 'Identification rapide' },
  { key: 'cs_stats',       label: 'Statistiques',              desc: 'Suivi de consommation' },
  { key: 'cs_payments',    label: 'Paiements internes',        desc: 'Solde compte repas' },
];

const CHECKLIST_RESTAURANT = [
  { icon: '🏪', title: 'Compléter le profil', desc: 'Ajoutez photos, description et horaires' },
  { icon: '🍽️', title: 'Ajouter votre menu', desc: 'Créez catégories et plats' },
  { icon: '🪑', title: 'Configurer les tables QR', desc: 'Générez les QR codes par table' },
  { icon: '🛵', title: 'Configurer la livraison', desc: 'Zones, frais et délais' },
  { icon: '🌐', title: 'Publier sur la marketplace', desc: 'Rendez votre établissement visible' },
];

const CHECKLIST_CANTEEN = [
  { icon: '🏢', title: 'Compléter l\'organisation', desc: 'Infos, adresse, contact' },
  { icon: '👥', title: 'Importer les utilisateurs', desc: 'Employés / élèves / étudiants' },
  { icon: '📅', title: 'Créer les menus', desc: 'Planifiez les repas de la semaine' },
  { icon: '📋', title: 'Configurer les règles', desc: 'Cutoff de commande, quotas' },
  { icon: '🔔', title: 'Activer les notifications', desc: 'Alertes pour les utilisateurs' },
];

// ── État initial du formulaire ────────────────────────────────────────────────
const INIT_FORM = {
  nom: '', email: '', phone: '', password: '', confirm_password: '',
  module_type: '',
  org_name: '', establishment_type: '', organization_type: '',
  address: '', city: '', phone_org: '', description: '', approx_users: '',
  accepts_qr_table: true, accepts_online: true, accepts_delivery: false,
  accepts_takeaway: true, accepts_reservation: false,
  cs_menus: true, cs_orders: true, cs_employees: false,
  cs_badges: false, cs_stats: true, cs_payments: false,
  plan_slug: '',
};

// ── Shared input style ────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '11px 14px', border: '1.5px solid #E5E7EB',
  borderRadius: 10, fontSize: 14, outline: 'none', fontFamily: 'inherit',
  color: '#111827', background: '#fff', transition: 'border-color .15s',
};

function FLabel({ children, req }) {
  return (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
      {children}{req && <span style={{ color: '#EF4444', marginLeft: 3 }}>*</span>}
    </label>
  );
}

function StepHeader({ step, total }) {
  const labels = ['Compte', 'Module', 'Établissement', 'Plan', 'Récapitulatif'];
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        {labels.map((l, i) => {
          const n = i + 1;
          const done = n < step; const active = n === step;
          return (
            <React.Fragment key={n}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  fontWeight: 800, fontSize: 13,
                  background: done ? 'var(--rb-orange,#FF8A00)' : active ? 'linear-gradient(135deg,#FF8A00,#FF5D00)' : '#F3F4F6',
                  color: (done || active) ? '#fff' : '#9CA3AF',
                  boxShadow: active ? '0 4px 16px rgba(255,138,0,.4)' : 'none',
                  transition: 'all .2s',
                }}>
                  {done ? '✓' : n}
                </div>
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? '#FF8A00' : '#9CA3AF', whiteSpace: 'nowrap' }}>{l}</span>
              </div>
              {i < labels.length - 1 && (
                <div style={{ flex: 1, height: 2, background: done ? 'var(--rb-orange,#FF8A00)' : '#E5E7EB', transition: 'background .3s', margin: '0 6px', marginBottom: 20 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function EyeIcon({ open }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {open
        ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
      }
    </svg>
  );
}

function BtnPrimary({ children, onClick, type = 'button', disabled, loading }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} style={{
      padding: '14px 28px', background: (disabled || loading) ? '#D1D5DB' : 'linear-gradient(135deg,#FF8A00,#FF5D00)',
      color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15,
      cursor: (disabled || loading) ? 'default' : 'pointer', fontFamily: 'inherit',
      boxShadow: (disabled || loading) ? 'none' : '0 4px 20px rgba(255,138,0,.35)', transition: 'all .2s',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {loading && <span style={{ width: 16, height: 16, border: '2.5px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'prr-spin .7s linear infinite', flexShrink: 0 }} />}
      {children}
    </button>
  );
}

function BtnSecondary({ children, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '14px 28px', background: 'transparent', color: '#6B7280',
      border: '1.5px solid #E5E7EB', borderRadius: 12, fontWeight: 600, fontSize: 14,
      cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
    }}>
      {children}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function ProRegisterPage() {
  const { login } = useAuth();
  const navigate   = useNavigate();

  const [step, setStep]       = useState(1);
  const [form, setForm]       = useState(() => loadDraft() || INIT_FORM);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [plans, setPlans]     = useState([]);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [success, setSuccess] = useState(null); // { module_type, org_name }

  // Persister le brouillon à chaque changement
  useEffect(() => { saveDraft(form); }, [form]);

  // Charger les plans
  useEffect(() => {
    fetch(API('/auth/plans'))
      .then(r => r.json())
      .then(d => setPlans(d.plans || []))
      .catch(() => {});
  }, []);

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  }

  // ── Filtrer les plans par module ────────────────────────────────────────────
  const visiblePlans = plans.filter(p =>
    form.module_type === 'CANTEEN'
      ? ['canteen', 'enterprise'].includes(p.slug)
      : !['canteen'].includes(p.slug)
  );

  // ── Validation par étape ────────────────────────────────────────────────────
  function validate() {
    if (step === 1) {
      if (!form.nom.trim()) return 'Le nom complet est requis.';
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Email invalide.';
      if (form.password.length < 6) return 'Mot de passe minimum 6 caractères.';
      if (form.password !== form.confirm_password) return 'Les mots de passe ne correspondent pas.';
    }
    if (step === 2) {
      if (!form.module_type) return 'Choisissez un module.';
    }
    if (step === 3) {
      if (!form.org_name.trim()) return 'Le nom de l\'établissement est requis.';
      if (form.module_type === 'RESTAURANT' && !form.establishment_type) return 'Choisissez le type d\'établissement.';
      if (form.module_type === 'CANTEEN' && !form.organization_type) return 'Choisissez le type d\'organisation.';
    }
    if (step === 4) {
      if (!form.plan_slug) return 'Choisissez un plan.';
    }
    return '';
  }

  function goNext() {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function goPrev() { setError(''); setStep(s => s - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  // ── Soumission finale ────────────────────────────────────────────────────────
  async function handleSubmit() {
    setError(''); setLoading(true);
    try {
      const canteenServices = CANTEEN_SERVICES.map(s => s.key).filter(k => form[k]);
      const body = {
        nom: form.nom, email: form.email, phone: form.phone, password: form.password, confirm_password: form.confirm_password,
        module_type: form.module_type,
        org_name: form.org_name,
        establishment_type: form.establishment_type || null,
        organization_type: form.organization_type || null,
        address: form.address || null, city: form.city || null,
        phone_org: form.phone_org || null, description: form.description || null,
        approx_users: form.approx_users || null,
        accepts_qr_table: form.accepts_qr_table, accepts_online: form.accepts_online,
        accepts_delivery: form.accepts_delivery, accepts_takeaway: form.accepts_takeaway,
        accepts_reservation: form.accepts_reservation,
        canteen_services: canteenServices,
        plan_slug: form.plan_slug,
      };
      const r = await fetch(API('/auth/pro-register'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `Erreur ${r.status}`);

      clearDraft();
      login(d.token, d.user);
      setSuccess({ module_type: d.module_type, org_name: form.org_name });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Écran de succès ─────────────────────────────────────────────────────────
  if (success) {
    const checklist = success.module_type === 'RESTAURANT' ? CHECKLIST_RESTAURANT : CHECKLIST_CANTEEN;
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#FFF7ED 0%,#fff 60%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 70, marginBottom: 16 }}>🎉</div>
          <h1 style={{ fontFamily: 'Poppins,sans-serif', fontSize: 28, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>
            Bienvenue sur RestoBook !
          </h1>
          <p style={{ color: '#6B7280', fontSize: 15, marginBottom: 32 }}>
            Votre espace <strong>{success.org_name}</strong> est prêt. Voici vos premières étapes :
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 36, textAlign: 'left' }}>
            {checklist.map((item, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'center', border: '1.5px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FFF7ED', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>{item.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{item.desc}</div>
                </div>
                <div style={{ marginLeft: 'auto', width: 22, height: 22, borderRadius: '50%', border: '2px solid #E5E7EB', flexShrink: 0 }} />
              </div>
            ))}
          </div>
          <BtnPrimary onClick={() => navigate('/')}>
            Accéder à mon espace →
          </BtnPrimary>
        </div>
      </div>
    );
  }

  // ── Fond avec dégradé côté gauche ───────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#F9FAFB' }}>

      {/* ── Colonne gauche (branding) ─────────────────────────────────────── */}
      <div className="prr-brand-col" style={{ width: 380, flexShrink: 0, background: 'linear-gradient(160deg,#1E1E1E 0%,#2D1A06 60%,#FF5D00 150%)', padding: '48px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}>
        {/* Logo */}
        <div>
          <BrandLogo variant="full" theme="dark" size="md" style={{ height: 38 }} />
          <div style={{ marginTop: 48 }}>
            <h2 style={{ fontFamily: 'Poppins,sans-serif', fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 14px', lineHeight: 1.2 }}>
              Développez votre activité avec RestoBook
            </h2>
            <p style={{ color: 'rgba(255,255,255,.65)', fontSize: 14, lineHeight: 1.7 }}>
              La plateforme tout-en-un pour restaurants, snacks, cafés, cantines et organisations.
            </p>
          </div>
          <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              ['⚡', 'Inscription en 5 minutes'],
              ['🎁', '30 jours d\'essai gratuit'],
              ['🔒', 'Données sécurisées'],
              ['📱', 'Application mobile incluse'],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.1)', display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
                <span style={{ color: 'rgba(255,255,255,.8)', fontSize: 13, fontWeight: 500 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
        <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 11, margin: 0 }}>
          © 2026 RestoBook — Tous droits réservés
        </p>
      </div>

      {/* ── Colonne droite (wizard) ───────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '48px 32px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>

          <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontFamily: 'Poppins,sans-serif', fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>
                Créer mon espace professionnel
              </h1>
              <p style={{ color: '#6B7280', fontSize: 13, margin: '4px 0 0' }}>
                Étape {step} sur 5
              </p>
            </div>
            <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6B7280', fontFamily: 'inherit', textDecoration: 'underline' }}>
              Déjà un compte ?
            </button>
          </div>

          <StepHeader step={step} total={5} />

          {/* ═══════════════════════ ÉTAPE 1 : COMPTE ══════════════════════ */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>👤 Votre compte responsable</h2>
              <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 24px' }}>Ces informations serviront à vous connecter et à gérer votre espace.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <FLabel req>Nom complet</FLabel>
                  <input style={inp} placeholder="Jean Dupont" value={form.nom} onChange={e => set('nom', e.target.value)} autoFocus />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <FLabel req>Email professionnel</FLabel>
                    <input type="email" style={inp} placeholder="jean@restaurant.ma" value={form.email} onChange={e => set('email', e.target.value)} />
                  </div>
                  <div>
                    <FLabel>Téléphone</FLabel>
                    <input type="tel" style={inp} placeholder="+212 6 …" value={form.phone} onChange={e => set('phone', e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <FLabel req>Mot de passe</FLabel>
                    <div style={{ position: 'relative' }}>
                      <input type={showPwd ? 'text' : 'password'} style={{ ...inp, paddingRight: 40 }} placeholder="Min. 6 caractères" value={form.password} onChange={e => set('password', e.target.value)} />
                      <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }}><EyeIcon open={showPwd} /></button>
                    </div>
                  </div>
                  <div>
                    <FLabel req>Confirmer le mot de passe</FLabel>
                    <div style={{ position: 'relative' }}>
                      <input type={showPwd2 ? 'text' : 'password'} style={{ ...inp, paddingRight: 40, borderColor: form.confirm_password && form.confirm_password !== form.password ? '#EF4444' : undefined }} placeholder="Répéter le mot de passe" value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)} />
                      <button type="button" onClick={() => setShowPwd2(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }}><EyeIcon open={showPwd2} /></button>
                    </div>
                  </div>
                </div>
                {form.confirm_password && form.confirm_password !== form.password && (
                  <p style={{ fontSize: 12, color: '#EF4444', margin: '-8px 0 0' }}>Les mots de passe ne correspondent pas.</p>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════ ÉTAPE 2 : MODULE ══════════════════════ */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>🏪 Quel est votre secteur ?</h2>
              <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 28px' }}>Choisissez le module qui correspond à votre activité. Cela détermine les fonctionnalités disponibles.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                {[
                  {
                    value: 'RESTAURANT', icon: '🍽️', title: 'Restaurant & Commerce alimentaire',
                    desc: 'Idéal pour restaurants, snacks, cafés, boulangeries, traiteurs. Marketplace publique, QR tables, livraison.',
                    tags: ['Marketplace publique', 'Commandes QR', 'Livraison', 'Réservations'],
                    color: '#FF8A00',
                  },
                  {
                    value: 'CANTEEN', icon: '🏢', title: 'Cantine & Organisation',
                    desc: 'Idéal pour entreprises, écoles, universités, hôpitaux. Gestion interne des repas et des utilisateurs.',
                    tags: ['Menus journaliers', 'Comptes employés', 'Badges QR', 'Statistiques'],
                    color: '#22C55E',
                  },
                ].map(m => (
                  <div key={m.value} onClick={() => set('module_type', m.value)} style={{
                    border: `2.5px solid ${form.module_type === m.value ? m.color : '#E5E7EB'}`,
                    borderRadius: 18, padding: '22px 20px', cursor: 'pointer', background: form.module_type === m.value ? `${m.color}0D` : '#fff',
                    transition: 'all .2s', boxShadow: form.module_type === m.value ? `0 8px 32px ${m.color}25` : '0 2px 8px rgba(0,0,0,.04)',
                  }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>{m.icon}</div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#111827', marginBottom: 8 }}>{m.title}</div>
                    <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 14 }}>{m.desc}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {m.tags.map(t => (
                        <span key={t} style={{ fontSize: 11, fontWeight: 600, background: `${m.color}18`, color: m.color, padding: '3px 10px', borderRadius: 20 }}>{t}</span>
                      ))}
                    </div>
                    {form.module_type === m.value && (
                      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6, color: m.color, fontWeight: 700, fontSize: 13 }}>
                        <span>✓</span><span>Sélectionné</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════ ÉTAPE 3A : RESTAURANT ══════════════════ */}
          {step === 3 && form.module_type === 'RESTAURANT' && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>🏪 Votre établissement</h2>
              <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 24px' }}>Ces informations seront affichées sur la marketplace RestoBook.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Type d'établissement */}
                <div>
                  <FLabel req>Type d'établissement</FLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                    {ESTAB_TYPES.map(t => (
                      <div key={t.value} onClick={() => set('establishment_type', t.value)} style={{
                        border: `2px solid ${form.establishment_type === t.value ? '#FF8A00' : '#E5E7EB'}`,
                        borderRadius: 12, padding: '10px 6px', cursor: 'pointer', textAlign: 'center',
                        background: form.establishment_type === t.value ? '#FFF7ED' : '#fff', transition: 'all .15s',
                      }}>
                        <div style={{ fontSize: 22, marginBottom: 4 }}>{t.icon}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: form.establishment_type === t.value ? '#FF8A00' : '#374151' }}>{t.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Infos de base */}
                <div>
                  <FLabel req>Nom commercial</FLabel>
                  <input style={inp} placeholder="Le Bon Repas" value={form.org_name} onChange={e => set('org_name', e.target.value)} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <FLabel>Ville</FLabel>
                    <input style={inp} placeholder="Casablanca" value={form.city} onChange={e => set('city', e.target.value)} />
                  </div>
                  <div>
                    <FLabel>Téléphone établissement</FLabel>
                    <input type="tel" style={inp} placeholder="+212 5 …" value={form.phone_org} onChange={e => set('phone_org', e.target.value)} />
                  </div>
                </div>

                <div>
                  <FLabel>Adresse</FLabel>
                  <input style={inp} placeholder="123 Rue Mohammed V" value={form.address} onChange={e => set('address', e.target.value)} />
                </div>

                <div>
                  <FLabel>Description courte</FLabel>
                  <textarea style={{ ...inp, resize: 'vertical' }} rows={3} placeholder="Décrivez votre établissement, votre ambiance, vos spécialités…" value={form.description} onChange={e => set('description', e.target.value)} />
                </div>

                {/* Services */}
                <div>
                  <FLabel>Services proposés</FLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {RESTO_SERVICES.map(s => (
                      <label key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: `1.5px solid ${form[s.key] ? '#FF8A00' : '#E5E7EB'}`, borderRadius: 12, cursor: 'pointer', background: form[s.key] ? '#FFF7ED' : '#fff', transition: 'all .15s' }}>
                        <input type="checkbox" checked={!!form[s.key]} onChange={e => set(s.key, e.target.checked)} style={{ width: 18, height: 18, accentColor: '#FF8A00', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{s.label}</div>
                          <div style={{ fontSize: 11, color: '#9CA3AF' }}>{s.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════ ÉTAPE 3B : CANTINE ═════════════════════ */}
          {step === 3 && form.module_type === 'CANTEEN' && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>🏢 Votre organisation</h2>
              <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 24px' }}>Configurez votre espace cantine interne.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Type d'organisation */}
                <div>
                  <FLabel req>Type d'organisation</FLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                    {ORG_TYPES.map(t => (
                      <div key={t.value} onClick={() => set('organization_type', t.value)} style={{
                        border: `2px solid ${form.organization_type === t.value ? '#22C55E' : '#E5E7EB'}`,
                        borderRadius: 12, padding: '10px 6px', cursor: 'pointer', textAlign: 'center',
                        background: form.organization_type === t.value ? '#F0FDF4' : '#fff', transition: 'all .15s',
                      }}>
                        <div style={{ fontSize: 22, marginBottom: 4 }}>{t.icon}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: form.organization_type === t.value ? '#22C55E' : '#374151' }}>{t.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <FLabel req>Nom de l'organisation</FLabel>
                  <input style={inp} placeholder="Entreprise XYZ — Cantine" value={form.org_name} onChange={e => set('org_name', e.target.value)} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <FLabel>Nombre d'utilisateurs (approx.)</FLabel>
                    <input type="number" min="1" style={inp} placeholder="ex. 150" value={form.approx_users} onChange={e => set('approx_users', e.target.value)} />
                  </div>
                  <div>
                    <FLabel>Ville</FLabel>
                    <input style={inp} placeholder="Casablanca" value={form.city} onChange={e => set('city', e.target.value)} />
                  </div>
                </div>

                <div>
                  <FLabel>Adresse</FLabel>
                  <input style={inp} placeholder="Km 7 Route de la Mecque" value={form.address} onChange={e => set('address', e.target.value)} />
                </div>

                {/* Services cantine */}
                <div>
                  <FLabel>Services souhaités</FLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {CANTEEN_SERVICES.map(s => (
                      <label key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: `1.5px solid ${form[s.key] ? '#22C55E' : '#E5E7EB'}`, borderRadius: 12, cursor: 'pointer', background: form[s.key] ? '#F0FDF4' : '#fff', transition: 'all .15s' }}>
                        <input type="checkbox" checked={!!form[s.key]} onChange={e => set(s.key, e.target.checked)} style={{ width: 18, height: 18, accentColor: '#22C55E', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{s.label}</div>
                          <div style={{ fontSize: 11, color: '#9CA3AF' }}>{s.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════ ÉTAPE 4 : PLAN ════════════════════════ */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>💳 Choisissez votre plan</h2>
              <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 28px' }}>
                Tous les plans incluent 30 jours d'essai gratuit. Vous pouvez changer de plan à tout moment.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {visiblePlans.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Chargement des plans…</div>
                )}
                {visiblePlans.map(plan => {
                  const isSelected = form.plan_slug === plan.slug;
                  const isFree = Number(plan.price_monthly) === 0;
                  const isEnterprise = plan.slug === 'enterprise';
                  const features = Object.entries(FEATURE_LABELS)
                    .filter(([k]) => plan[k])
                    .map(([, label]) => label);

                  return (
                    <div key={plan.slug} onClick={() => set('plan_slug', plan.slug)} style={{
                      border: `2.5px solid ${isSelected ? (plan.color || '#FF8A00') : '#E5E7EB'}`,
                      borderRadius: 18, padding: '20px 22px', cursor: 'pointer',
                      background: isSelected ? `${plan.color || '#FF8A00'}0C` : '#fff',
                      transition: 'all .2s', position: 'relative',
                      boxShadow: isSelected ? `0 8px 32px ${plan.color || '#FF8A00'}25` : '0 2px 6px rgba(0,0,0,.04)',
                    }}>
                      {plan.is_popular && (
                        <div style={{ position: 'absolute', top: -12, right: 20, background: 'linear-gradient(135deg,#FF8A00,#FF5D00)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 12px', borderRadius: 20 }}>
                          ⭐ Populaire
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 16, color: '#111827' }}>{plan.name}</div>
                          <div style={{ marginTop: 4 }}>
                            {isEnterprise ? (
                              <span style={{ fontWeight: 700, fontSize: 20, color: plan.color || '#8B5CF6' }}>Sur devis</span>
                            ) : isFree ? (
                              <><span style={{ fontWeight: 800, fontSize: 24, color: plan.color || '#64748B' }}>Gratuit</span><span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 4 }}>(30 jours)</span></>
                            ) : (
                              <><span style={{ fontWeight: 800, fontSize: 24, color: plan.color || '#374151' }}>{Number(plan.price_monthly).toFixed(0)} MAD</span><span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 4 }}>/mois</span></>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, fontSize: 12, color: '#6B7280' }}>
                          <span>{plan.max_restaurants === -1 ? 'Illimité' : `${plan.max_restaurants} établissement${plan.max_restaurants > 1 ? 's' : ''}`}</span>
                          <span>{plan.max_users === -1 ? 'Illimité' : `${plan.max_users} utilisateurs`}</span>
                        </div>
                      </div>
                      {features.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                          {features.map(f => (
                            <span key={f} style={{ fontSize: 11, background: '#F3F4F6', color: '#374151', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>{f}</span>
                          ))}
                        </div>
                      )}
                      {isSelected && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: plan.color || '#FF8A00', fontWeight: 700, fontSize: 13, marginTop: 4 }}>
                          <span>✓</span><span>Plan sélectionné</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 16, textAlign: 'center' }}>
                Besoin d'un plan Enterprise personnalisé ? Contactez-nous après l'inscription.
              </p>
            </div>
          )}

          {/* ═══════════════════════ ÉTAPE 5 : RÉCAP ═══════════════════════ */}
          {step === 5 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>✅ Récapitulatif</h2>
              <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 24px' }}>Vérifiez vos informations avant de créer votre espace.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Compte */}
                <div style={{ background: '#F9FAFB', borderRadius: 14, padding: '16px 20px', border: '1.5px solid #E5E7EB' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>👤 Compte responsable</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <RecapRow label="Nom" value={form.nom} />
                    <RecapRow label="Email" value={form.email} />
                    {form.phone && <RecapRow label="Téléphone" value={form.phone} />}
                  </div>
                </div>

                {/* Module */}
                <div style={{ background: '#F9FAFB', borderRadius: 14, padding: '16px 20px', border: '1.5px solid #E5E7EB' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>🏪 Module</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
                    {form.module_type === 'RESTAURANT' ? '🍽️ Restaurant & Commerce alimentaire' : '🏢 Cantine & Organisation'}
                  </div>
                  {form.establishment_type && (
                    <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                      {ESTAB_TYPES.find(t => t.value === form.establishment_type)?.label}
                    </div>
                  )}
                  {form.organization_type && (
                    <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                      {ORG_TYPES.find(t => t.value === form.organization_type)?.label}
                    </div>
                  )}
                </div>

                {/* Établissement */}
                <div style={{ background: '#F9FAFB', borderRadius: 14, padding: '16px 20px', border: '1.5px solid #E5E7EB' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>🏪 Établissement</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <RecapRow label="Nom" value={form.org_name} />
                    {form.city && <RecapRow label="Ville" value={form.city} />}
                    {form.address && <RecapRow label="Adresse" value={form.address} />}
                    {form.phone_org && <RecapRow label="Tél. établissement" value={form.phone_org} />}
                  </div>
                </div>

                {/* Plan */}
                {(() => {
                  const p = visiblePlans.find(pl => pl.slug === form.plan_slug);
                  return p ? (
                    <div style={{ background: `${p.color || '#FF8A00'}0C`, borderRadius: 14, padding: '16px 20px', border: `1.5px solid ${p.color || '#FF8A00'}30` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>💳 Plan sélectionné</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#111827' }}>{p.name}</div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: p.color || '#FF8A00' }}>
                          {Number(p.price_monthly) === 0 ? (p.slug === 'enterprise' ? 'Sur devis' : 'Gratuit') : `${Number(p.price_monthly).toFixed(0)} MAD/mois`}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>✓ 30 jours d'essai inclus</div>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div style={{ margin: '20px 0 0', padding: '12px 16px', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 12, color: '#DC2626', fontSize: 13, fontWeight: 600 }}>
              ❌ {error}
            </div>
          )}

          {/* ── Navigation ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, gap: 12 }}>
            {step > 1
              ? <BtnSecondary onClick={goPrev}>← Précédent</BtnSecondary>
              : <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#9CA3AF', fontFamily: 'inherit', textDecoration: 'underline' }}>Annuler</button>
            }
            {step < 5
              ? <BtnPrimary onClick={goNext}>Suivant →</BtnPrimary>
              : <BtnPrimary onClick={handleSubmit} loading={loading}>
                  Créer mon espace professionnel
                </BtnPrimary>
            }
          </div>

          {/* ── Lien client ── */}
          <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 24 }}>
            Vous êtes un client ?{' '}
            <button onClick={() => navigate('/marketplace')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF8A00', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', textDecoration: 'underline' }}>
              Commander en ligne
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function RecapRow({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{value}</div>
    </div>
  );
}
