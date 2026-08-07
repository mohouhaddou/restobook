import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { BrandLogo } from '../../components/brand/BrandLogo';
import { GeocodingPicker } from '../components/geo/GeocodingPicker';
import { BRAND } from '../../config/branding';
import GoogleAuthButton from '../../shared/components/auth/GoogleAuthButton';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// ── Persistance brouillon ────────────────────────────────────────────────────
const DRAFT_KEY = 'ifk_pro_reg_draft_v2';
const loadDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; } };
const saveDraft = (d) => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch {} };
const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch {} };

// ── Modules Ifilino ─────────────────────────────────────────────────────────
const MODULES = [
  {
    value: 'RESTAURANT',
    icon: '🍽️',
    label: 'Resto',
    title: 'Restaurant & Food',
    desc: 'Restaurant, snack, dark kitchen, traiteur, fast-food. Marketplace publique, QR table, livraison.',
    tags: ['Marketplace', 'QR Table', 'Livraison', 'Réservations'],
    color: '#FF8A00',
    bg: '#FFF7ED',
  },
  {
    value: 'CANTINE',
    icon: '🏢',
    label: 'Cantine',
    title: 'Cantine & Organisation',
    desc: 'Entreprise, école, université, hôpital. Gestion interne des repas, menus journaliers, badges.',
    tags: ['Menus journaliers', 'Comptes employés', 'Badges QR', 'Statistiques'],
    color: '#3B82F6',
    bg: '#EFF6FF',
  },
  {
    value: 'HANOUT',
    icon: '🏪',
    label: 'Hanout',
    title: 'Hanout & Commerce',
    desc: 'Épicerie, alimentation générale, droguerie, boucherie, boulangerie. Gestion des produits et commandes.',
    tags: ['Catalogue produits', 'Commandes', 'Click & Collect', 'Stock'],
    color: '#10B981',
    bg: '#ECFDF5',
  },
  {
    value: 'CAFE',
    icon: '☕',
    label: 'Café',
    title: 'Café & Boissons',
    desc: 'Café, salon de thé, glacier, bar à jus. Menu boissons, commandes en salle.',
    tags: ['Menu boissons', 'QR Table', 'Fidélité', 'Marketplace'],
    color: '#8B5CF6',
    bg: '#F5F3FF',
  },
  {
    value: 'PHARMACIE',
    icon: '💊',
    label: 'Pharmacie',
    title: 'Pharmacie',
    desc: 'Catalogue médicaments, gestion des lots et péremptions, ordonnances, ventes, crédit client.',
    tags: ['Lots & péremption', 'Ordonnances', 'POS', 'Marketplace'],
    color: '#0EA5E9',
    bg: '#F0F9FF',
  },
];

// ── Types précis par module ──────────────────────────────────────────────────
const PRECISE_TYPES = {
  RESTAURANT: [
    { value: 'restaurant',   label: 'Restaurant',        icon: '🍽️' },
    { value: 'snack',        label: 'Snack',             icon: '🥙' },
    { value: 'dark_kitchen', label: 'Dark Kitchen',      icon: '📦' },
    { value: 'traiteur',     label: 'Traiteur',          icon: '🍱' },
    { value: 'fast_food',    label: 'Fast-food',         icon: '🍔' },
    { value: 'patisserie',   label: 'Pâtisserie',        icon: '🥐' },
    { value: 'boulangerie',  label: 'Boulangerie',       icon: '🥖' },
    { value: 'autre',        label: 'Autre',             icon: '🏪' },
  ],
  CANTINE: [
    { value: 'entreprise',     label: 'Entreprise',        icon: '🏢' },
    { value: 'ecole',          label: 'École',             icon: '🏫' },
    { value: 'universite',     label: 'Université',        icon: '🎓' },
    { value: 'administration', label: 'Administration',    icon: '🏛️' },
    { value: 'hopital',        label: 'Hôpital',           icon: '🏥' },
    { value: 'usine',          label: 'Usine / Site',      icon: '🏭' },
    { value: 'autre',          label: 'Autre',             icon: '🔷' },
  ],
  HANOUT: [
    { value: 'epicerie',      label: 'Épicerie',           icon: '🛒' },
    { value: 'alimentation',  label: 'Alimentation',       icon: '🥫' },
    { value: 'boucherie',     label: 'Boucherie',          icon: '🥩' },
    { value: 'boulangerie',   label: 'Boulangerie',        icon: '🥖' },
    { value: 'droguerie',     label: 'Droguerie',          icon: '🧴' },
    { value: 'autre',         label: 'Autre',              icon: '🏪' },
  ],
  CAFE: [
    { value: 'cafe',          label: 'Café traditionnel',  icon: '☕' },
    { value: 'salon_the',     label: 'Salon de thé',       icon: '🍵' },
    { value: 'glacier',       label: 'Glacier',            icon: '🍦' },
    { value: 'juice_bar',     label: 'Bar à jus',          icon: '🧃' },
    { value: 'autre',         label: 'Autre',              icon: '🏪' },
  ],
  PHARMACIE: [
    { value: 'pharmacie',     label: 'Pharmacie',          icon: '💊' },
  ],
};

// ── Plans affichés ────────────────────────────────────────────────────────────
const PLAN_SLUGS_DISPLAY = {
  free_demo:  { badge: 'Gratuit',    priceLabel: 'Gratuit',     color: '#64748B' },
  pro:        { badge: 'Pro',        priceLabel: null,          color: '#FF8A00' },
  enterprise: { badge: 'Entreprise', priceLabel: 'Sur devis',   color: '#8B5CF6' },
};

// ── Module → dashboard route ─────────────────────────────────────────────────
const MODULE_DASHBOARD = {
  RESTAURANT: '/', CAFE: '/', HANOUT: '/', CANTINE: '/canteen-dashboard', PHARMACIE: '/',
};

// ── État initial ─────────────────────────────────────────────────────────────
const INIT_FORM = {
  email: '', password: '', confirm_password: '',
  first_name: '', last_name: '', phone: '', whatsapp: '',
  org_name: '', description: '', phone_org: '',
  module_type: '',
  precise_type: '',
  plan_slug: '',
  address: '', city: '', district: '', latitude: null, longitude: null, formatted_address: null, geocoding_source: null,
};

const TOTAL_STEPS = 7;

// ── Styles partagés ──────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '11px 14px', border: '1.5px solid #E5E7EB',
  borderRadius: 10, fontSize: 14, outline: 'none', fontFamily: 'inherit',
  color: '#111827', background: '#fff', transition: 'border-color .15s',
  boxSizing: 'border-box',
};

// ── Sous-composants ──────────────────────────────────────────────────────────
function FLabel({ children, req }) {
  return (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
      {children}{req && <span style={{ color: '#EF4444', marginLeft: 3 }}>*</span>}
    </label>
  );
}

function EyeIcon({ open }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {open
        ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
    </svg>
  );
}

function BtnPrimary({ children, onClick, type = 'button', disabled, loading, color = '#FF8A00' }) {
  const grad = `linear-gradient(135deg,${color},${color}CC)`;
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} style={{
      padding: '13px 28px', background: (disabled || loading) ? '#D1D5DB' : grad,
      color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15,
      cursor: (disabled || loading) ? 'default' : 'pointer', fontFamily: 'inherit',
      boxShadow: (disabled || loading) ? 'none' : `0 4px 20px ${color}40`, transition: 'all .2s',
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
      padding: '13px 28px', background: 'transparent', color: '#6B7280',
      border: '1.5px solid #E5E7EB', borderRadius: 12, fontWeight: 600, fontSize: 14,
      cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
    }}>
      {children}
    </button>
  );
}

// ── Barre de progression ─────────────────────────────────────────────────────
const STEP_LABELS = ['Compte', 'Propriétaire', 'Établissement', 'Module', 'Type', 'Plan', 'Adresse'];

function StepBar({ step }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <React.Fragment key={n}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  fontWeight: 800, fontSize: 12,
                  background: done ? '#22C55E' : active ? 'linear-gradient(135deg,#FF8A00,#FF5D00)' : '#F3F4F6',
                  color: (done || active) ? '#fff' : '#9CA3AF',
                  boxShadow: active ? '0 4px 14px rgba(255,138,0,.4)' : 'none',
                  transition: 'all .2s', flexShrink: 0,
                }}>
                  {done ? '✓' : n}
                </div>
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, color: active ? '#FF8A00' : done ? '#22C55E' : '#9CA3AF', whiteSpace: 'nowrap' }}>
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: done ? '#22C55E' : '#E5E7EB', transition: 'background .3s', marginBottom: 18 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ── Carte Leaflet pour la localisation ──────────────────────────────────────
function LocationMap({ lat, lng, onPick }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markerRef    = useRef(null);

  // Fix icône par défaut Leaflet (cassée avec Vite)
  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center = lat && lng ? [parseFloat(lat), parseFloat(lng)] : [33.5731, -7.5898]; // Casablanca
    const map = L.map(containerRef.current, { center, zoom: lat ? 14 : 6 });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    if (lat && lng) {
      markerRef.current = L.marker([parseFloat(lat), parseFloat(lng)], { draggable: true }).addTo(map);
      markerRef.current.on('dragend', e => {
        const p = e.target.getLatLng();
        onPick(p.lat, p.lng);
      });
    }

    map.on('click', e => {
      const { lat: clat, lng: clng } = e.latlng;
      if (markerRef.current) {
        markerRef.current.setLatLng([clat, clng]);
      } else {
        markerRef.current = L.marker([clat, clng], { draggable: true }).addTo(map);
        markerRef.current.on('dragend', ev => {
          const p = ev.target.getLatLng();
          onPick(p.lat, p.lng);
        });
      }
      onPick(clat, clng);
    });

    mapRef.current = map;
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mettre à jour le marker si lat/lng changent sans recréer la carte
  useEffect(() => {
    if (!mapRef.current || !lat || !lng) return;
    const pos = [parseFloat(lat), parseFloat(lng)];
    if (markerRef.current) {
      markerRef.current.setLatLng(pos);
    } else {
      markerRef.current = L.marker(pos, { draggable: true }).addTo(mapRef.current);
      markerRef.current.on('dragend', e => {
        const p = e.target.getLatLng();
        onPick(p.lat, p.lng);
      });
    }
    mapRef.current.setView(pos, 15);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1.5px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
      <div ref={containerRef} style={{ height: 280, width: '100%' }} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function ProRegisterPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, token, login } = useAuth();

  // Compte Google inexistant, proposé à la création depuis /login (bouton
  // "Créer mon compte professionnel") — { token: pending_signup_token, profile }.
  // Aucune session n'existe encore : le compte + l'organisation ne sont créés
  // qu'à la soumission finale du wizard (POST /auth/google/complete-pro-signup).
  const pendingSignup = location.state?.googlePendingSignup || null;

  // Legacy : arrivée déjà authentifiée via Google (compte pro provisoire créé
  // avant l'introduction du pending_signup_token, sans organisation) — on
  // saute l'étape "Compte" et on complète directement l'établissement via
  // POST /auth/pro-register-complete (authentifié).
  const arrivedViaGoogle = !!location.state?.googleOnboarding;
  const [googleAuthedInline, setGoogleAuthedInline] = useState(false);
  const skipAccountStep = !!pendingSignup
    || ((arrivedViaGoogle || googleAuthedInline) && !!token && !!user && !user.organization_id);

  const [step, setStep]       = useState(() => (pendingSignup || arrivedViaGoogle ? 2 : 1));
  const [form, setForm]       = useState(() => {
    const draft = loadDraft();
    if (pendingSignup) {
      const [firstGuess = '', ...restGuess] = (pendingSignup.profile?.name || '').split(' ');
      return { ...INIT_FORM, email: pendingSignup.profile?.email || '', first_name: firstGuess, last_name: restGuess.join(' ') };
    }
    if (arrivedViaGoogle) return { ...INIT_FORM, ...(draft || {}), email: user?.email || '' };
    return draft || { ...INIT_FORM };
  });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [plans, setPlans]     = useState([]);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [submitted, setSubmitted] = useState(null); // { org_name, module_type }
  const [geoLoading, setGeoLoading] = useState(false);

  // Compte déjà rattaché à une organisation (onboarding déjà terminé) :
  // rien à faire ici.
  useEffect(() => {
    if (arrivedViaGoogle && user?.organization_id) navigate('/', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { saveDraft(form); }, [form]);

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

  const activeModule = MODULES.find(m => m.value === form.module_type);
  const moduleColor  = activeModule?.color || '#FF8A00';
  const moduleBg     = activeModule?.bg    || '#FFF7ED';

  // Plans filtrés selon le module (cantine = plans canteen/enterprise seulement)
  const visiblePlans = plans.filter(p => {
    if (form.module_type === 'CANTINE') return ['free_demo', 'canteen', 'enterprise'].includes(p.slug);
    return ['free_demo', 'pro', 'enterprise'].includes(p.slug);
  });

  // ── Géolocalisation rapide ──────────────────────────────────────────────
  function geolocate() {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => { set('latitude', pos.coords.latitude); set('longitude', pos.coords.longitude); setGeoLoading(false); },
      ()  => { setGeoLoading(false); },
      { timeout: 6000 }
    );
  }

  // ── Validation par étape ─────────────────────────────────────────────────
  function validate() {
    if (step === 1) {
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Email invalide.';
      if (form.password.length < 6) return 'Mot de passe minimum 6 caractères.';
      if (form.password !== form.confirm_password) return 'Les mots de passe ne correspondent pas.';
    }
    if (step === 2) {
      if (!form.first_name.trim()) return 'Le prénom est requis.';
      if (!form.last_name.trim())  return 'Le nom est requis.';
    }
    if (step === 3) {
      if (!form.org_name.trim()) return 'Le nom de l\'établissement est requis.';
    }
    if (step === 4) {
      if (!form.module_type) return 'Choisissez un module.';
    }
    if (step === 5) {
      if (!form.precise_type) return 'Choisissez un type d\'établissement.';
    }
    if (step === 6) {
      if (!form.plan_slug) return 'Choisissez un plan.';
    }
    if (step === 7) {
      if (!form.city?.trim()) return 'La ville est requise.';
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
  function goPrev() {
    if (skipAccountStep && step <= 2) return; // pas de retour vers l'étape "Compte" déjà remplie par Google
    setError('');
    setStep(s => s - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleGoogleInlineSuccess(d) {
    setError('');
    login(d.token, d.user);
    set('email', d.user?.email || '');
    setGoogleAuthedInline(true);
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Soumission ────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const err = validate();
    if (err) { setError(err); return; }
    setError(''); setLoading(true);
    try {
      const orgPayload = {
        first_name:   form.first_name.trim(),
        last_name:    form.last_name.trim(),
        phone:        form.phone  || null,
        whatsapp:     form.whatsapp || null,
        org_name:     form.org_name.trim(),
        description:  form.description || null,
        phone_org:    form.phone_org || null,
        module_type:  form.module_type,
        precise_type: form.precise_type || null,
        plan_slug:    form.plan_slug,
        address:      form.address || null,
        city:         form.city || null,
        district:     form.district || null,
        latitude:     form.latitude  || null,
        longitude:    form.longitude || null,
        formatted_address: form.formatted_address || null,
        geocoding_source:  form.geocoding_source  || null,
      };

      const r = pendingSignup
        ? await fetch(API('/auth/google/complete-pro-signup'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pending_signup_token: pendingSignup.token, ...orgPayload }),
          })
        : skipAccountStep
        ? await fetch(API('/auth/pro-register-complete'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(orgPayload),
          })
        : await fetch(API('/auth/pro-register'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email:    form.email.trim().toLowerCase(),
              password: form.password,
              confirm_password: form.confirm_password,
              ...orgPayload,
            }),
          });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `Erreur ${r.status}`);
      if (pendingSignup && d.token) login(d.token, d.user); // compte + organisation créés ensemble : on ouvre enfin la session
      clearDraft();
      setSubmitted({ org_name: form.org_name, module_type: form.module_type });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Écran de succès (pending) ─────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#FFF7ED 0%,#fff 60%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <style>{`@keyframes prr-spin{to{transform:rotate(360deg)}} @keyframes prr-pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
        <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#FF8A00,#FF5D00)', display: 'grid', placeItems: 'center', fontSize: 38, margin: '0 auto 24px', boxShadow: '0 8px 32px rgba(255,138,0,.3)' }}>📋</div>
          <h1 style={{ fontFamily: 'Poppins,sans-serif', fontSize: 26, fontWeight: 800, color: '#111827', margin: '0 0 10px' }}>
            Demande envoyée !
          </h1>
          <p style={{ color: '#6B7280', fontSize: 15, marginBottom: 8 }}>
            Votre espace <strong>{submitted.org_name}</strong> est en cours de validation.
          </p>
          <div style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 14, padding: '20px 24px', margin: '24px 0', textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#92400E', marginBottom: 12 }}>⏱ Ce qui se passe maintenant :</div>
            {[
              ['1.', 'Votre dossier est examiné par notre équipe'],
              ['2.', 'Validation sous 24 heures ouvrées'],
              ['3.', 'Email de confirmation à la validation'],
              ['4.', 'Accès immédiat à votre tableau de bord'],
            ].map(([n, t]) => (
              <div key={n} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                <span style={{ background: '#FF8A00', color: '#fff', fontWeight: 800, fontSize: 11, borderRadius: 6, padding: '2px 7px', flexShrink: 0, marginTop: 1 }}>{n}</span>
                <span style={{ fontSize: 13, color: '#374151' }}>{t}</span>
              </div>
            ))}
          </div>
          <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 12, padding: '14px 18px', marginBottom: 28 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#166534' }}>
              📧 Un email de confirmation a été envoyé à <strong>{form.email}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => navigate('/login')} style={{
              padding: '14px 28px', background: 'linear-gradient(135deg,#FF8A00,#FF5D00)', color: '#fff',
              border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer',
              fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(255,138,0,.35)',
            }}>
              Me connecter quand mon espace est actif
            </button>
            <button onClick={() => navigate('/')} style={{
              padding: '12px 24px', background: 'transparent', color: '#6B7280',
              border: '1.5px solid #E5E7EB', borderRadius: 12, fontWeight: 600, fontSize: 14,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Retour à l'accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#F9FAFB' }}>
      <style>{`
        @keyframes prr-spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) { .prr-brand-col { display: none !important; } .prr-main { padding: 24px 16px !important; } }
      `}</style>

      {/* ── Colonne gauche branding ──────────────────────────────────────── */}
      <div className="prr-brand-col" style={{ width: 360, flexShrink: 0, background: 'linear-gradient(160deg,#1E1E1E 0%,#2D1A06 60%,#FF5D00 160%)', padding: '44px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}>
        <div>
          <div style={{ marginBottom: 40 }}>
            <BrandLogo variant="full" theme="dark" size="sm" style={{ height: 88 }} />
          </div>
          <h2 style={{ fontFamily: 'Poppins,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 12px', lineHeight: 1.3 }}>
            Développez votre activité avec {BRAND.APP_NAME}
          </h2>
          <p style={{ color: 'rgba(255,255,255,.65)', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
            La plateforme tout-en-un pour restaurants, cafés, cantines et commerces de proximité.
          </p>

          {/* Modules visuels */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 28 }}>
            {MODULES.map(m => (
              <div key={m.value} style={{
                background: form.module_type === m.value ? `${m.color}30` : 'rgba(255,255,255,.06)',
                border: `1.5px solid ${form.module_type === m.value ? m.color : 'rgba(255,255,255,.1)'}`,
                borderRadius: 12, padding: '10px 12px', transition: 'all .2s',
              }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: form.module_type === m.value ? m.color : 'rgba(255,255,255,.7)' }}>{m.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[['⚡','Inscription en 5 min'], ['🎁','30 jours essai gratuit'], ['🔒','Données sécurisées'], ['📱','Multi-plateforme']].map(([ic, t]) => (
              <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,.1)', display: 'grid', placeItems: 'center', fontSize: 16, flexShrink: 0 }}>{ic}</div>
                <span style={{ color: 'rgba(255,255,255,.8)', fontSize: 12, fontWeight: 500 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
        <p style={{ color: 'rgba(255,255,255,.3)', fontSize: 10, margin: 0 }}>
          © {new Date().getFullYear()} {BRAND.APP_NAME} — Tous droits réservés
        </p>
      </div>

      {/* ── Colonne droite wizard ────────────────────────────────────────── */}
      <div className="prr-main" style={{ flex: 1, overflowY: 'auto', padding: '44px 36px' }}>
        <div style={{ maxWidth: 580, margin: '0 auto' }}>

          {/* En-tête */}
          <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontFamily: 'Poppins,sans-serif', fontSize: 21, fontWeight: 800, color: '#111827', margin: 0 }}>
                Créer mon espace professionnel
              </h1>
              <p style={{ color: '#9CA3AF', fontSize: 12, margin: '4px 0 0' }}>
                Étape {step} sur {TOTAL_STEPS} — {STEP_LABELS[step - 1]}
              </p>
            </div>
            <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9CA3AF', fontFamily: 'inherit', textDecoration: 'underline', flexShrink: 0 }}>
              Déjà un compte ?
            </button>
          </div>

          <StepBar step={step} />

          {/* ══ ÉTAPE 1 : Compte ════════════════════════════════════════════ */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>🔐 Créez votre compte</h2>
              <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 24px' }}>Ces identifiants vous serviront à vous connecter.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <FLabel req>Email professionnel</FLabel>
                  <input type="email" style={inp} placeholder="vous@etablissement.ma" value={form.email} onChange={e => set('email', e.target.value)} autoFocus />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <FLabel req>Mot de passe</FLabel>
                    <div style={{ position: 'relative' }}>
                      <input type={showPwd ? 'text' : 'password'} style={{ ...inp, paddingRight: 42 }} placeholder="Min. 6 caractères" value={form.password} onChange={e => set('password', e.target.value)} />
                      <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }}>
                        <EyeIcon open={showPwd} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <FLabel req>Confirmer</FLabel>
                    <div style={{ position: 'relative' }}>
                      <input type={showPwd2 ? 'text' : 'password'} style={{ ...inp, paddingRight: 42, borderColor: form.confirm_password && form.confirm_password !== form.password ? '#EF4444' : undefined }} placeholder="Répéter" value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)} />
                      <button type="button" onClick={() => setShowPwd2(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }}>
                        <EyeIcon open={showPwd2} />
                      </button>
                    </div>
                    {form.confirm_password && form.confirm_password !== form.password && (
                      <p style={{ fontSize: 11, color: '#EF4444', margin: '4px 0 0' }}>Les mots de passe ne correspondent pas.</p>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0 18px' }}>
                <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
                <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>OU</span>
                <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
              </div>
              <GoogleAuthButton roleIntent="business_owner" onSuccess={handleGoogleInlineSuccess} onError={setError} />
            </div>
          )}

          {/* ══ ÉTAPE 2 : Propriétaire ══════════════════════════════════════ */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>👤 Informations propriétaire</h2>
              <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 24px' }}>Ces informations sont utilisées pour la validation de votre dossier.</p>
              {skipAccountStep && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 12, padding: '10px 14px', marginBottom: 20 }}>
                  <span style={{ fontSize: 16 }}>✅</span>
                  <span style={{ fontSize: 13, color: '#166534' }}>Connecté avec Google ({form.email}) — complétez maintenant votre établissement.</span>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <FLabel req>Prénom</FLabel>
                    <input style={inp} placeholder="Mohammed" value={form.first_name} onChange={e => set('first_name', e.target.value)} autoFocus />
                  </div>
                  <div>
                    <FLabel req>Nom de famille</FLabel>
                    <input style={inp} placeholder="Alami" value={form.last_name} onChange={e => set('last_name', e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <FLabel>Téléphone</FLabel>
                    <input type="tel" style={inp} placeholder="+212 6 00 00 00 00" value={form.phone} onChange={e => set('phone', e.target.value)} />
                  </div>
                  <div>
                    <FLabel>WhatsApp</FLabel>
                    <input type="tel" style={inp} placeholder="+212 6 00 00 00 00" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ ÉTAPE 3 : Établissement ═════════════════════════════════════ */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>🏪 Votre établissement</h2>
              <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 24px' }}>Ces informations seront affichées sur votre profil Ifilino.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <FLabel req>Nom commercial</FLabel>
                  <input style={inp} placeholder="Le Bon Repas, Cantine XYZ…" value={form.org_name} onChange={e => set('org_name', e.target.value)} autoFocus />
                </div>
                <div>
                  <FLabel>Description courte</FLabel>
                  <textarea style={{ ...inp, resize: 'vertical' }} rows={3} placeholder="Décrivez votre établissement, vos spécialités, votre ambiance…" value={form.description} onChange={e => set('description', e.target.value)} />
                </div>
                <div>
                  <FLabel>Téléphone de l'établissement</FLabel>
                  <input type="tel" style={inp} placeholder="+212 5 00 00 00 00" value={form.phone_org} onChange={e => set('phone_org', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ══ ÉTAPE 4 : Module ════════════════════════════════════════════ */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>🧩 Choisissez votre module</h2>
              <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 24px' }}>Le module détermine les fonctionnalités disponibles dans votre espace.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                {MODULES.map(m => {
                  const sel = form.module_type === m.value;
                  return (
                    <div key={m.value} onClick={() => { set('module_type', m.value); set('precise_type', ''); }} style={{
                      border: `2.5px solid ${sel ? m.color : '#E5E7EB'}`,
                      borderRadius: 18, padding: '20px 18px', cursor: 'pointer',
                      background: sel ? m.bg : '#fff', transition: 'all .2s',
                      boxShadow: sel ? `0 8px 28px ${m.color}25` : '0 2px 6px rgba(0,0,0,.04)',
                    }}>
                      <div style={{ fontSize: 34, marginBottom: 10 }}>{m.icon}</div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#111827', marginBottom: 6 }}>{m.title}</div>
                      <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, marginBottom: 12 }}>{m.desc}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {m.tags.map(t => (
                          <span key={t} style={{ fontSize: 10, fontWeight: 600, background: `${m.color}18`, color: m.color, padding: '2px 9px', borderRadius: 20 }}>{t}</span>
                        ))}
                      </div>
                      {sel && (
                        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 5, color: m.color, fontWeight: 700, fontSize: 12 }}>
                          <span>✓</span><span>Sélectionné</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ ÉTAPE 5 : Type précis ═══════════════════════════════════════ */}
          {step === 5 && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>
                {activeModule?.icon} Type d'établissement précis
              </h2>
              <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 24px' }}>
                Module sélectionné : <span style={{ fontWeight: 700, color: moduleColor }}>{activeModule?.label}</span>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                {(PRECISE_TYPES[form.module_type] || []).map(t => {
                  const sel = form.precise_type === t.value;
                  return (
                    <div key={t.value} onClick={() => set('precise_type', t.value)} style={{
                      border: `2px solid ${sel ? moduleColor : '#E5E7EB'}`,
                      borderRadius: 14, padding: '14px 8px', cursor: 'pointer', textAlign: 'center',
                      background: sel ? moduleBg : '#fff', transition: 'all .15s',
                      boxShadow: sel ? `0 4px 16px ${moduleColor}20` : 'none',
                    }}>
                      <div style={{ fontSize: 26, marginBottom: 6 }}>{t.icon}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: sel ? moduleColor : '#374151', lineHeight: 1.3 }}>{t.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ ÉTAPE 6 : Plan ══════════════════════════════════════════════ */}
          {step === 6 && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>💳 Choisissez votre plan</h2>
              <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 24px' }}>
                30 jours d'essai gratuit sur tous les plans. Changement possible à tout moment.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {visiblePlans.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
                    <div style={{ animation: 'prr-spin .7s linear infinite', width: 24, height: 24, border: '3px solid #E5E7EB', borderTopColor: '#FF8A00', borderRadius: '50%', margin: '0 auto 12px' }} />
                    Chargement des plans…
                  </div>
                )}
                {visiblePlans.map(plan => {
                  const sel    = form.plan_slug === plan.slug;
                  const meta   = PLAN_SLUGS_DISPLAY[plan.slug] || {};
                  const color  = plan.color || meta.color || '#374151';
                  const isFree = Number(plan.price_monthly) === 0;
                  const isEnterprise = plan.slug === 'enterprise';
                  return (
                    <div key={plan.slug} onClick={() => set('plan_slug', plan.slug)} style={{
                      border: `2.5px solid ${sel ? color : '#E5E7EB'}`,
                      borderRadius: 16, padding: '18px 20px', cursor: 'pointer',
                      background: sel ? `${color}0C` : '#fff', transition: 'all .2s',
                      boxShadow: sel ? `0 8px 24px ${color}25` : '0 1px 4px rgba(0,0,0,.04)',
                      position: 'relative',
                    }}>
                      {plan.is_popular && (
                        <div style={{ position: 'absolute', top: -11, right: 18, background: `linear-gradient(135deg,${color},${color}AA)`, color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 11px', borderRadius: 20 }}>
                          ⭐ Populaire
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 15, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                            {plan.name}
                            <span style={{ background: `${color}18`, color, fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>{meta.badge || plan.slug}</span>
                          </div>
                          <div style={{ marginTop: 6 }}>
                            {isEnterprise ? (
                              <span style={{ fontWeight: 700, fontSize: 18, color }}>Sur devis</span>
                            ) : isFree ? (
                              <><span style={{ fontWeight: 800, fontSize: 22, color }}>Gratuit</span><span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 4 }}>30 jours</span></>
                            ) : (
                              <><span style={{ fontWeight: 800, fontSize: 22, color }}>{Number(plan.price_monthly).toFixed(0)} MAD</span><span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 4 }}>/mois</span></>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'right' }}>
                          <div>{plan.max_restaurants === -1 ? 'Illimité' : `${plan.max_restaurants} établ.`}</div>
                          <div>{plan.max_users === -1 ? 'Illimité' : `${plan.max_users} users`}</div>
                        </div>
                      </div>
                      {sel && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color, fontWeight: 700, fontSize: 12 }}>
                          <span>✓</span><span>Plan sélectionné</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 14, textAlign: 'center' }}>
                Plan Enterprise personnalisé ? Contactez-nous après l'inscription.
              </p>
            </div>
          )}

          {/* ══ ÉTAPE 7 : Adresse + Carte Leaflet ══════════════════════════ */}
          {step === 7 && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>📍 Adresse et localisation</h2>
              <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 24px' }}>
                Recherchez votre adresse, utilisez le GPS ou cliquez sur la carte pour positionner votre établissement.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <GeocodingPicker
                  lat={form.latitude}
                  lng={form.longitude}
                  address={form.address}
                  city={form.city}
                  district={form.district}
                  formattedAddress={form.formatted_address}
                  geocodingSource={form.geocoding_source}
                  onUpdate={data => {
                    set('latitude',          data.lat);
                    set('longitude',         data.lng);
                    set('address',           data.address);
                    set('city',              data.city);
                    set('district',          data.district);
                    set('formatted_address', data.formatted_address);
                    set('geocoding_source',  data.geocoding_source);
                  }}
                />
                <div style={{ display: 'none' }} />

                {/* Récap final avant soumission */}
                <div style={{ background: '#F9FAFB', borderRadius: 14, padding: '16px 18px', border: '1.5px solid #E5E7EB' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Récapitulatif de votre dossier</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      ['Prénom & nom', `${form.first_name} ${form.last_name}`],
                      ['Email', form.email],
                      ['Établissement', form.org_name],
                      ['Module', activeModule?.label || form.module_type],
                      ['Type', (PRECISE_TYPES[form.module_type] || []).find(t => t.value === form.precise_type)?.label || form.precise_type],
                      ['Plan', visiblePlans.find(p => p.slug === form.plan_slug)?.name || form.plan_slug],
                    ].map(([label, val]) => val ? (
                      <div key={label}>
                        <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</div>
                      </div>
                    ) : null)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Erreur ── */}
          {error && (
            <div style={{ margin: '18px 0 0', padding: '12px 16px', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 12, color: '#DC2626', fontSize: 13, fontWeight: 600 }}>
              ❌ {error}
            </div>
          )}

          {/* ── Navigation ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 30, gap: 12 }}>
            {step > 1 && !(skipAccountStep && step === 2)
              ? <BtnSecondary onClick={goPrev}>← Précédent</BtnSecondary>
              : (!skipAccountStep && <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9CA3AF', fontFamily: 'inherit', textDecoration: 'underline' }}>Annuler</button>)
            }
            {step < TOTAL_STEPS
              ? <BtnPrimary onClick={goNext} color={moduleColor}>Suivant →</BtnPrimary>
              : <BtnPrimary onClick={handleSubmit} loading={loading} color={moduleColor}>
                  Soumettre ma demande ✓
                </BtnPrimary>
            }
          </div>

          {/* ── Lien client ── */}
          <p style={{ textAlign: 'center', fontSize: 11, color: '#9CA3AF', marginTop: 20 }}>
            Vous êtes client ?{' '}
            <button onClick={() => navigate('/marketplace')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF8A00', fontWeight: 700, fontSize: 11, fontFamily: 'inherit', textDecoration: 'underline' }}>
              Commander en ligne
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
