import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import { API, ASSET } from '../../api';
import { BRAND } from '../../config/branding';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import './TableReservationPage.css';

/* ═══ CONSTANTS ══════════════════════════════════════════════════════════ */

const RESERVATION_TYPES = [
  { id: 'lunch',       label: 'Déjeuner',       icon: '☀️' },
  { id: 'dinner',      label: 'Dîner',           icon: '🌙' },
  { id: 'brunch',      label: 'Brunch',          icon: '🥐' },
  { id: 'breakfast',   label: 'Petit-déjeuner',  icon: '☕' },
  { id: 'romantic',    label: 'Dîner Romantique',icon: '💑' },
  { id: 'birthday',    label: 'Anniversaire',    icon: '🎂' },
  { id: 'business',    label: 'Business',        icon: '💼' },
  { id: 'family',      label: 'Famille',         icon: '👨‍👩‍👧‍👦' },
  { id: 'anniversary', label: 'Anniversaire de mariage', icon: '💍' },
  { id: 'corporate',   label: 'Événement corporate', icon: '🏢' },
  { id: 'celebration', label: 'Célébration',     icon: '🥂' },
  { id: 'other',       label: 'Autre',           icon: '✨' },
];

const EXTRAS_LIST = [
  { id: 'decoration',  label: 'Décoration',      icon: '🎊' },
  { id: 'flowers',     label: 'Fleurs',          icon: '💐' },
  { id: 'cake',        label: 'Gâteau',          icon: '🎂' },
  { id: 'champagne',   label: 'Champagne',       icon: '🍾' },
  { id: 'private',     label: 'Salle privée',    icon: '🔒' },
  { id: 'projector',   label: 'Projecteur',      icon: '📽️' },
  { id: 'highchair',   label: 'Chaise bébé',     icon: '👶' },
  { id: 'custom_menu', label: 'Menu personnalisé', icon: '📋' },
  { id: 'wine',        label: 'Accord mets-vins',icon: '🍷' },
  { id: 'photo',       label: 'Photographe',     icon: '📸' },
  { id: 'music',       label: 'Musique live',    icon: '🎵' },
  { id: 'bouquet',     label: 'Bouquet',         icon: '💮' },
];

const SUGGESTIONS = [
  'Allergie aux arachides',
  'Menu végétarien',
  'Menu halal',
  'Table au calme',
  'Vue sur jardin',
  'Surprise anniversaire',
  'Réunion professionnelle',
];

const WEEKDAYS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

const STEPS = [
  { id: 1,  label: 'Restaurant' },
  { id: 2,  label: 'Occasion' },
  { id: 3,  label: 'Convives' },
  { id: 4,  label: 'Date' },
  { id: 5,  label: 'Heure' },
  { id: 6,  label: 'Table' },
  { id: 7,  label: 'Extras' },
  { id: 8,  label: 'Menus' },
  { id: 9,  label: 'Demandes' },
  { id: 10, label: 'Résumé' },
];

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80';

/* ═══ HELPERS ════════════════════════════════════════════════════════════ */

function buildCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Convert Sunday-first to Monday-first
  const offset = (firstDay + 6) % 7;
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function dateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDateFr(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

function guestLabel(n) { return n === 1 ? '1 personne' : `${n} personnes`; }

/* ═══ SUB-COMPONENTS ═════════════════════════════════════════════════════ */

function GuestCounter({ label, sub, value, min = 0, max = 20, onChange }) {
  return (
    <div className="trp-guest-row">
      <div className="trp-guest-label">
        <div className="trp-guest-label-main">{label}</div>
        {sub && <div className="trp-guest-label-sub">{sub}</div>}
      </div>
      <div className="trp-guest-ctrl">
        <button className="trp-guest-btn" onClick={() => onChange(value - 1)} disabled={value <= min}>−</button>
        <span className="trp-guest-count">{value}</span>
        <button className="trp-guest-btn" onClick={() => onChange(value + 1)} disabled={value >= max}>+</button>
      </div>
    </div>
  );
}

function LuxuryCalendar({ selectedDate, onSelect, availability }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const cells = buildCalendarDays(viewYear, viewMonth);

  const isPast = (day) => {
    const d = new Date(viewYear, viewMonth, day);
    d.setHours(0, 0, 0, 0);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return d < t;
  };
  const isToday = (day) => {
    const d = new Date(viewYear, viewMonth, day);
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };
  const ds = (day) => day ? dateStr(viewYear, viewMonth, day) : '';
  const isSelected = (day) => day && ds(day) === selectedDate;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(v => v - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(v => v + 1); }
    else setViewMonth(m => m + 1);
  };

  const canPrev = () => viewYear > today.getFullYear() || viewMonth > today.getMonth();

  return (
    <div className="trp-calendar">
      <div className="trp-cal-header">
        <button className="trp-cal-nav" onClick={prevMonth} disabled={!canPrev()}>‹</button>
        <span className="trp-cal-month">{MONTHS[viewMonth]} {viewYear}</span>
        <button className="trp-cal-nav" onClick={nextMonth}>›</button>
      </div>
      <div className="trp-cal-weekdays">
        {WEEKDAYS.map(w => <div key={w} className="trp-cal-wd">{w}</div>)}
      </div>
      <div className="trp-cal-days">
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} className="trp-cal-day empty" />;
          const past = isPast(day);
          const sel  = isSelected(day);
          const tod  = isToday(day);
          return (
            <div
              key={day}
              className={['trp-cal-day', past ? 'past' : 'available', sel ? 'selected' : '', tod && !sel ? 'today' : ''].filter(Boolean).join(' ')}
              onClick={() => !past && onSelect(ds(day))}
            >
              {day}
            </div>
          );
        })}
      </div>
      <div className="trp-cal-legend">
        <span className="trp-cal-legend-item">
          <span className="trp-cal-legend-dot" style={{ background:'#22C55E' }} />
          Disponible
        </span>
        <span className="trp-cal-legend-item">
          <span className="trp-cal-legend-dot" style={{ background:'var(--trp-orange)' }} />
          Sélectionné
        </span>
      </div>
    </div>
  );
}

function TimeSlots({ slots, selected, onSelect, loading }) {
  if (loading) return <div className="trp-spinner" />;
  if (!slots.length) return <div style={{ textAlign:'center', color:'#9CA3AF', padding:'40px 0' }}>Aucun créneau disponible pour ce jour.</div>;

  return (
    <div className="trp-slots-grid">
      {slots.map(slot => {
        const sel = selected === slot.time;
        const unavail = !slot.available;
        const badge = slot.popularity === 'high' ? { label:'🔥 Populaire', cls:'fire' }
                    : slot.popularity === 'medium' ? { label:'⭐ Recommandé', cls:'star' }
                    : { label:'⚡ Dispo', cls:'fast' };
        return (
          <div
            key={slot.time}
            className={['trp-slot', sel ? 'selected' : '', unavail ? 'unavailable' : '', slot.popularity === 'high' && !unavail ? 'popular' : ''].filter(Boolean).join(' ')}
            onClick={() => !unavail && onSelect(slot.time)}
          >
            <div className="trp-slot-time">{slot.time}</div>
            {!unavail && <span className={`trp-slot-badge ${badge.cls}`}>{badge.label}</span>}
            {unavail && <span className="trp-slot-badge" style={{ color:'#D1D5DB' }}>Complet</span>}
          </div>
        );
      })}
    </div>
  );
}

function SummaryRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div className="trp-summary-row">
      <span className="trp-summary-row-icon">{icon}</span>
      <div>
        <div className="trp-summary-row-label">{label}</div>
        <div className="trp-summary-row-value">{value}</div>
      </div>
    </div>
  );
}

/* ═══ MAIN PAGE ══════════════════════════════════════════════════════════ */

export default function TableReservationPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { authHeader } = useCustomerAuth();

  /* ── Restaurant data ── */
  const [org, setOrg]       = useState(location.state?.org || null);
  const [loadingOrg, setLoadingOrg] = useState(!org);

  /* ── Wizard state ── */
  const [step, setStep] = useState(1);

  /* ── Booking fields ── */
  const [reservationType, setReservationType] = useState('');
  const [adults,    setAdults]    = useState(2);
  const [children,  setChildren]  = useState(0);
  const [infants,   setInfants]   = useState(0);
  const [wheelchairSeats, setWheelchairSeats] = useState(0);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedTable, setSelectedTable] = useState('any');
  const [extras,    setExtras]    = useState([]);
  const [notes,     setNotes]     = useState('');

  /* ── Contact ── */
  const [name,  setName]  = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  /* ── Availability ── */
  const [slots, setSlots]         = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  /* ── Tables ── */
  const [tables, setTables]       = useState([]);

  /* ── Menu pré-commande ── */
  const [menuCategories, setMenuCategories] = useState([]);
  const [menuLoading,    setMenuLoading]    = useState(false);
  const [menuLoaded,     setMenuLoaded]     = useState(false);
  const [menuTab,        setMenuTab]        = useState(0);
  const [preOrders,      setPreOrders]      = useState([]); // [{id, libelle, prix, qty}]
  const [dailyMenu,      setDailyMenu]      = useState(null);
  const [menuMode,       setMenuMode]       = useState('carte'); // 'carte' | 'menu_du_jour'

  /* ── Submission ── */
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [reservationNumber, setReservationNumber] = useState('');
  const [error, setError]           = useState('');

  /* ── QR code ── */
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (!reservationNumber) return;
    QRCode.toDataURL(reservationNumber, { width: 256, margin: 2, color: { dark: '#111827', light: '#FFFFFF' } })
      .then(url => setQrDataUrl(url))
      .catch(() => {});
  }, [reservationNumber]);

  // Callback ref : s'exécute dès que le canvas est monté dans le DOM
  const qrCanvasCallback = useCallback((canvas) => {
    if (!canvas || !reservationNumber) return;
    QRCode.toCanvas(canvas, reservationNumber, { width: 200, margin: 2, color: { dark: '#111827', light: '#FFFFFF' } }).catch(() => {});
  }, [reservationNumber]);

  /* ── Load restaurant info ── */
  useEffect(() => {
    if (org) return;
    setLoadingOrg(true);
    fetch(API(`/marketplace/restaurants/${slug}`))
      .then(r => r.json())
      .then(d => { setOrg(d.restaurant || d); setLoadingOrg(false); })
      .catch(() => setLoadingOrg(false));
  }, [slug]);

  /* ── Load tables once ── */
  useEffect(() => {
    fetch(API(`/marketplace/restaurants/${slug}/tables`))
      .then(r => r.json())
      .then(d => setTables(d.tables || []))
      .catch(() => {});
  }, [slug]);

  /* ── Load menu when reaching step 8 ── */
  useEffect(() => {
    if (step !== 8 || menuLoaded) return;
    setMenuLoading(true);
    const dateStr = selectedDate || new Date().toISOString().slice(0, 10);
    Promise.all([
      fetch(API(`/marketplace/restaurants/${slug}/menu`)).then(r => r.json()),
      fetch(API(`/marketplace/restaurants/${slug}/daily-menu?date=${dateStr}`)).then(r => r.json()).catch(() => ({ menu: null })),
    ])
      .then(([d, dm]) => {
        const cats = (d.categories || []).filter(c => (c.items || []).some(i => i.is_available !== false));
        setMenuCategories(cats);
        if (dm.menu && (dm.menu.items || []).length > 0) {
          setDailyMenu(dm.menu);
          setMenuMode('menu_du_jour');
        }
        setMenuLoaded(true);
      })
      .catch(() => setMenuLoaded(true))
      .finally(() => setMenuLoading(false));
  }, [step, slug, menuLoaded, selectedDate]);

  /* ── Load time slots when date changes ── */
  useEffect(() => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    setSelectedTime('');
    fetch(API(`/marketplace/restaurants/${slug}/table-availability?date=${selectedDate}`))
      .then(r => r.json())
      .then(d => { setSlots(d.slots || []); setLoadingSlots(false); })
      .catch(() => { setSlots([]); setLoadingSlots(false); });
  }, [selectedDate, slug]);

  /* ── Navigation ── */
  const totalGuests = adults + children;
  const canProceed = useCallback(() => {
    if (step === 2) return !!reservationType;
    if (step === 3) return totalGuests >= 1;
    if (step === 4) return !!selectedDate;
    if (step === 5) return !!selectedTime;
    if (step === 10) return name.trim().length >= 2 && phone.trim().length >= 6;
    return true;
  }, [step, reservationType, totalGuests, selectedDate, selectedTime, name, phone]);

  const goNext = () => {
    if (step < STEPS.length) setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goBack = () => {
    if (step > 1) setStep(s => s - 1);
    else navigate(`/r/${slug}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleExtra = (id) => setExtras(prev =>
    prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
  );

  /* ── Pre-order helpers ── */
  const getPreOrderQty = (id) => preOrders.find(p => p.id === id)?.qty || 0;
  const setPreOrderQty = (item, qty) => {
    setPreOrders(prev => {
      const filtered = prev.filter(p => p.id !== item.id);
      if (qty <= 0) return filtered;
      return [...filtered, { id: item.id, libelle: item.libelle, prix: Number(item.prix || 0), qty }];
    });
  };
  const preOrderTotal = preOrders.reduce((s, p) => s + p.prix * p.qty, 0);

  /* ── Submit ── */
  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      // Formatter la pré-commande dans les notes
      let preOrderNote = '';
      if (preOrders.length > 0) {
        const lines = preOrders.map(p => `• ${p.qty}× ${p.libelle} (${p.prix} MAD/u.) = ${(p.prix * p.qty).toFixed(2)} MAD`);
        preOrderNote = `PRÉ-COMMANDE:\n${lines.join('\n')}\nTotal pré-commande: ${preOrderTotal.toFixed(2)} MAD`;
      }
      const noteParts = [preOrderNote, notes.trim()].filter(Boolean);

      const body = {
        guest_name:       name.trim(),
        guest_phone:      phone.trim(),
        guest_email:      email.trim() || undefined,
        date_jour:        selectedDate,
        time_slot:        selectedTime,
        guests_count:     totalGuests,
        table_label:      selectedTable === 'any' ? undefined : selectedTable,
        reservation_type: RESERVATION_TYPES.find(t => t.id === reservationType)?.label || reservationType,
        extras:           extras.map(id => EXTRAS_LIST.find(e => e.id === id)?.label).filter(Boolean),
        notes:            noteParts.join('\n---\n') || undefined,
      };
      const res = await fetch(API(`/marketplace/restaurants/${slug}/table-reserve`), {
        method: 'POST',
        // authHeader ajoute Authorization si le client est connecté (rattache
        // la réservation à son compte, voir historique dashboard) — vide sinon,
        // la réservation invité reste inchangée.
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la réservation');
      setReservationNumber(data.reservation_number || `RB${data.id}`);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e.message);
    }
    setSubmitting(false);
  }

  /* ── Download receipt PDF ── */
  async function downloadReservationReceipt() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [90, 160] });
    const W = 90;
    let y = 0;

    // Header gradient band
    doc.setFillColor(255, 138, 0);
    doc.rect(0, 0, W, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(BRAND.APP_NAME, W / 2, 10, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('Confirmation de réservation', W / 2, 17, { align: 'center' });
    doc.setFontSize(8);
    doc.text(org?.name || '', W / 2, 23, { align: 'center' });
    y = 32;

    // QR code
    if (qrDataUrl) {
      const qrSize = 36;
      doc.addImage(qrDataUrl, 'PNG', (W - qrSize) / 2, y, qrSize, qrSize);
      y += qrSize + 3;
    }

    // Reservation number
    doc.setTextColor(255, 138, 0);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(reservationNumber, W / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Numéro de réservation', W / 2, y, { align: 'center' });
    y += 7;

    // Divider
    doc.setDrawColor(230, 230, 230);
    doc.line(8, y, W - 8, y);
    y += 5;

    // Details
    const rows = [
      ['Restaurant', org?.name || ''],
      ['Date',       formatDateFr(selectedDate)],
      ['Heure',      selectedTime],
      ['Convives',   guestLabel(totalGuests)],
      ['Table',      selectedTable === 'any' ? 'Meilleure disponible' : selectedTable],
    ];
    if (reservationType) rows.splice(1, 0, ['Occasion', RESERVATION_TYPES.find(t => t.id === reservationType)?.label || reservationType]);
    if (name)  rows.push(['Nom',       name]);
    if (phone) rows.push(['Téléphone', phone]);
    if (extras.length) rows.push(['Extras', extras.map(id => EXTRAS_LIST.find(e => e.id === id)?.label).join(', ')]);
    if (notes) rows.push(['Note', notes]);

    doc.setFontSize(8.5);
    for (const [label, value] of rows) {
      doc.setFont('helvetica', 'bold');  doc.setTextColor(60, 60, 60);
      doc.text(label, 8, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20);
      const lines = doc.splitTextToSize(String(value), 50);
      doc.text(lines, 40, y);
      y += lines.length * 5 + 1;
      if (y > 148) break;
    }

    if (preOrders.length > 0) {
      y += 4;
      doc.setFillColor(255, 138, 0);
      doc.roundedRect(8, y - 4, 74, 6, 2, 2, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
      doc.text('PRÉ-COMMANDE', 45, y, { align: 'center' });
      y += 6;
      doc.setTextColor(40, 40, 40); doc.setFontSize(8);
      for (const p of preOrders) {
        doc.setFont('helvetica', 'normal');
        doc.text(`${p.qty}× ${p.libelle}`, 10, y);
        doc.setFont('helvetica', 'bold');
        doc.text(`${(p.prix * p.qty).toFixed(2)} MAD`, 82, y, { align: 'right' });
        y += 5;
      }
      y += 1;
      doc.setDrawColor(255, 138, 0); doc.setLineWidth(0.3);
      doc.line(10, y, 80, y);
      y += 4;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 93, 0);
      doc.text('Total pré-commande', 10, y);
      doc.text(`${preOrderTotal.toFixed(2)} MAD`, 82, y, { align: 'right' });
      y += 6;
    }

    // Footer
    y += 4;
    doc.setDrawColor(230, 230, 230);
    doc.line(8, y, W - 8, y);
    y += 5;
    doc.setFontSize(7); doc.setTextColor(150, 150, 150);
    doc.text('Présentez ce document à l\'accueil.', W / 2, y, { align: 'center' });
    y += 4;
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} par ${BRAND.APP_NAME}`, W / 2, y, { align: 'center' });

    doc.save(`reservation-${reservationNumber}.pdf`);
  }

  /* ── Grouped tables by floor ── */
  const tablesByFloor = tables.reduce((acc, t) => {
    const key = t.floor || 'Salle principale';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  /* ── Cover image ── */
  const coverUrl = org?.cover_url ? ASSET(org.cover_url) : DEFAULT_COVER;
  const logoUrl  = org?.logo_url  ? ASSET(org.logo_url)  : null;

  /* ════ SUCCESS SCREEN ════════════════════════════════════════════════ */
  if (submitted) {
    return (
      <div className="trp-success">
        <div className="trp-success-anim">✓</div>
        <h1 className="trp-success-title">Réservation confirmée !</h1>
        <p className="trp-success-sub">
          Votre table chez {org?.name} est réservée pour le {formatDateFr(selectedDate)} à {selectedTime}.
          Vous recevrez une confirmation.
        </p>

        {/* ── QR Code card ── */}
        <div style={{ background:'#fff', borderRadius:24, padding:'28px 24px', maxWidth:380, width:'100%', marginBottom:20, boxShadow:'0 8px 32px rgba(0,0,0,.08)', border:'1.5px solid #E5E7EB', textAlign:'center' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>Numéro de réservation</div>
          <div style={{ fontSize:30, fontWeight:900, color:'var(--trp-orange,#FF8A00)', letterSpacing:3, marginBottom:16 }}>{reservationNumber}</div>

          {/* QR canvas */}
          <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}>
            <div style={{ background:'#fff', padding:12, borderRadius:16, boxShadow:'0 4px 20px rgba(0,0,0,.08)', border:'1px solid #F3F4F6', display:'inline-block' }}>
              <canvas ref={qrCanvasCallback} style={{ display:'block' }} />
            </div>
          </div>
          <div style={{ fontSize:12, color:'#9CA3AF', marginBottom:20 }}>Présentez ce QR code à l'accueil</div>

          {/* Récap compact */}
          <div style={{ background:'#F9FAFB', borderRadius:14, padding:'14px 16px', textAlign:'left', display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
            {[
              { icon:'🍽️', label: org?.name },
              { icon:'📅', label: formatDateFr(selectedDate) },
              { icon:'🕐', label: selectedTime },
              { icon:'👥', label: guestLabel(totalGuests) },
              selectedTable !== 'any' && { icon:'🪑', label: selectedTable },
              reservationType && { icon:'✨', label: RESERVATION_TYPES.find(t => t.id === reservationType)?.label },
            ].filter(Boolean).map((row, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#374151' }}>
                <span>{row.icon}</span>
                <span style={{ fontWeight:600 }}>{row.label}</span>
              </div>
            ))}
          </div>

          {/* Download button */}
          <button
            onClick={downloadReservationReceipt}
            style={{ width:'100%', padding:'13px', border:'2px solid var(--trp-orange,#FF8A00)', borderRadius:14, background:'#fff', color:'var(--trp-orange,#FF8A00)', fontWeight:800, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'all .2s', fontFamily:'inherit' }}
            onMouseOver={e => { e.currentTarget.style.background='#FFF7ED'; }}
            onMouseOut={e  => { e.currentTarget.style.background='#fff'; }}
          >
            ⬇ Télécharger le reçu (PDF)
          </button>
        </div>

        <div className="trp-success-actions">
          <button className="trp-action-btn-primary" onClick={() => navigate(`/r/${slug}`)}>
            🍽️ Voir le menu
          </button>
          <button className="trp-action-btn-secondary" onClick={() => navigate('/marketplace')}>
            ← Retour au marketplace
          </button>
        </div>
      </div>
    );
  }

  /* ════ MAIN WIZARD ═══════════════════════════════════════════════════ */
  const progress = ((step - 1) / (STEPS.length - 1)) * 100;
  const stepInfo = STEPS[step - 1];

  return (
    <div className="trp-page">

      {/* ── HERO ── */}
      <div className="trp-hero">
        <img src={coverUrl} alt={org?.name || ''} className="trp-hero-img" />
        <div className="trp-hero-overlay" />
        <button className="trp-hero-back" onClick={() => navigate(`/r/${slug}`)}>
          ← {org?.name || 'Retour'}
        </button>
        {org && (
          <div className="trp-hero-info">
            <div className="trp-hero-title">
              {step === 1 ? `Réserver chez ${org.name}` : `${org.name}`}
            </div>
            <div className="trp-hero-meta">
              {org.avg_rating > 0 && (
                <span className="trp-hero-badge">
                  <span className="trp-hero-stars">★</span>
                  {Number(org.avg_rating).toFixed(1)}
                  {org.total_reviews > 0 && ` (${org.total_reviews})`}
                </span>
              )}
              {org.cuisine_type && <span className="trp-hero-badge">🍴 {org.cuisine_type}</span>}
              {org.city && <span className="trp-hero-badge">📍 {org.city}</span>}
            </div>
          </div>
        )}
      </div>

      {/* ── PROGRESS BAR ── */}
      <div className="trp-progress-wrap">
        <div className="trp-progress-header">
          <span className="trp-progress-label">{stepInfo?.label}</span>
          <span className="trp-progress-counter">Étape {step} / {STEPS.length}</span>
        </div>
        <div className="trp-progress-bar">
          <div className="trp-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="trp-step-dots">
          {STEPS.map(s => (
            <div key={s.id} className={['trp-step-dot', s.id < step ? 'done' : '', s.id === step ? 'active' : ''].filter(Boolean).join(' ')} />
          ))}
        </div>
      </div>

      {/* ════ STEP CONTENT ════════════════════════════════════════════ */}
      <div className="trp-step-wrap">

        {/* ── Step 1 : Restaurant overview ── */}
        {step === 1 && (
          <div className="trp-step-animate">
            <h2 className="trp-step-title">Bienvenue 👋</h2>
            <p className="trp-step-subtitle">
              Réservez votre table en quelques étapes. Une expérience sur-mesure vous attend.
            </p>

            {loadingOrg ? (
              <div className="trp-spinner" />
            ) : org && (
              <>
                {/* Info chips */}
                <div className="trp-info-grid">
                  {org.accepts_dine_in && (
                    <div className="trp-info-chip">
                      <div className="trp-info-chip-icon">🪑</div>
                      <div className="trp-info-chip-label">Sur place</div>
                      <div className="trp-info-chip-value">Disponible</div>
                    </div>
                  )}
                  {org.cuisine_type && (
                    <div className="trp-info-chip">
                      <div className="trp-info-chip-icon">🍴</div>
                      <div className="trp-info-chip-label">Cuisine</div>
                      <div className="trp-info-chip-value">{org.cuisine_type}</div>
                    </div>
                  )}
                  {org.avg_rating > 0 && (
                    <div className="trp-info-chip">
                      <div className="trp-info-chip-icon">⭐</div>
                      <div className="trp-info-chip-label">Note moyenne</div>
                      <div className="trp-info-chip-value">{Number(org.avg_rating).toFixed(1)} / 5</div>
                    </div>
                  )}
                  {org.city && (
                    <div className="trp-info-chip">
                      <div className="trp-info-chip-icon">📍</div>
                      <div className="trp-info-chip-label">Ville</div>
                      <div className="trp-info-chip-value">{org.city}</div>
                    </div>
                  )}
                  {org.avg_prep_time > 0 && (
                    <div className="trp-info-chip">
                      <div className="trp-info-chip-icon">⏱️</div>
                      <div className="trp-info-chip-label">Préparation</div>
                      <div className="trp-info-chip-value">~{org.avg_prep_time} min</div>
                    </div>
                  )}
                  <div className="trp-info-chip">
                    <div className="trp-info-chip-icon">📅</div>
                    <div className="trp-info-chip-label">Réservation</div>
                    <div className="trp-info-chip-value">Gratuite</div>
                  </div>
                </div>

                {org.description && (
                  <div style={{ background:'#fff', border:'1.5px solid #E5E7EB', borderRadius:16, padding:'18px 20px', marginBottom:20, fontSize:14, color:'#374151', lineHeight:1.7 }}>
                    {org.description}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Step 2 : Reservation type ── */}
        {step === 2 && (
          <div className="trp-step-animate">
            <h2 className="trp-step-title">Quelle est l'occasion ? 🎉</h2>
            <p className="trp-step-subtitle">Choisissez le type de réservation pour que nous puissions préparer votre expérience.</p>
            <div className="trp-type-grid">
              {RESERVATION_TYPES.map(t => (
                <div
                  key={t.id}
                  className={`trp-type-card ${reservationType === t.id ? 'selected' : ''}`}
                  onClick={() => setReservationType(t.id)}
                >
                  <div className="trp-type-check">✓</div>
                  <span className="trp-type-icon">{t.icon}</span>
                  <div className="trp-type-name">{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3 : Guests ── */}
        {step === 3 && (
          <div className="trp-step-animate">
            <h2 className="trp-step-title">Combien serez-vous ? 👥</h2>
            <p className="trp-step-subtitle">Nous préparerons l'espace idéal pour votre groupe.</p>
            <div className="trp-guest-rows">
              <GuestCounter label="Adultes"  value={adults}   min={1} max={20} onChange={setAdults} />
              <GuestCounter label="Enfants"  sub="2–12 ans"   value={children}  min={0} max={10} onChange={setChildren} />
              <GuestCounter label="Bébés"    sub="Moins de 2 ans" value={infants} min={0} max={5}  onChange={setInfants} />
              <GuestCounter label="Fauteuil roulant" sub="Nous réservons un espace accessible" value={wheelchairSeats} min={0} max={5} onChange={setWheelchairSeats} />
            </div>
            <div style={{ marginTop:16, background:'#F0FDF4', borderRadius:14, padding:'14px 18px', fontSize:13, color:'#15803D', fontWeight:600, display:'flex', gap:10, alignItems:'center' }}>
              <span>✓</span>
              Total : {guestLabel(totalGuests)}{infants > 0 ? ` + ${infants} bébé${infants > 1 ? 's' : ''}` : ''}
            </div>
          </div>
        )}

        {/* ── Step 4 : Date ── */}
        {step === 4 && (
          <div className="trp-step-animate">
            <h2 className="trp-step-title">Choisissez votre date 📅</h2>
            <p className="trp-step-subtitle">Sélectionnez le jour qui vous convient. Les dates disponibles sont indiquées.</p>
            <LuxuryCalendar
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
            />
            {selectedDate && (
              <div style={{ marginTop:16, background:'linear-gradient(135deg, #FFF7ED, #FFEDD5)', borderRadius:14, padding:'14px 18px', fontSize:14, color:'var(--trp-orange)', fontWeight:700, display:'flex', gap:10, alignItems:'center', border:'1px solid #FED7AA' }}>
                <span>📅</span>
                {formatDateFr(selectedDate)} sélectionné
              </div>
            )}
          </div>
        )}

        {/* ── Step 5 : Time ── */}
        {step === 5 && (
          <div className="trp-step-animate">
            <h2 className="trp-step-title">Choisissez votre heure 🕐</h2>
            <p className="trp-step-subtitle">
              Créneaux disponibles pour le {formatDateFr(selectedDate)}.
            </p>
            <TimeSlots
              slots={slots}
              selected={selectedTime}
              onSelect={setSelectedTime}
              loading={loadingSlots}
            />
          </div>
        )}

        {/* ── Step 6 : Table selection ── */}
        {step === 6 && (
          <div className="trp-step-animate">
            <h2 className="trp-step-title">Choisissez votre table 🪑</h2>
            <p className="trp-step-subtitle">Optionnel — laissez-nous choisir pour vous ou sélectionnez votre table préférée.</p>

            <div
              className={`trp-table-any ${selectedTable === 'any' ? 'selected' : ''}`}
              onClick={() => setSelectedTable('any')}
            >
              ✨ Meilleure table disponible (recommandé)
            </div>

            {tables.length > 0 ? Object.entries(tablesByFloor).map(([floor, floorTables]) => (
              <div key={floor} className="trp-tables-section">
                <div className="trp-tables-floor">{floor}</div>
                <div className="trp-tables-grid">
                  {floorTables.map(t => (
                    <div
                      key={t.id}
                      className={`trp-table-card ${selectedTable === t.label ? 'selected' : ''}`}
                      onClick={() => setSelectedTable(selectedTable === t.label ? 'any' : t.label)}
                    >
                      <span className="trp-table-icon">🪑</span>
                      <div className="trp-table-label">{t.label}</div>
                      <div className="trp-table-cap">👥 {t.capacity} pers. max</div>
                    </div>
                  ))}
                </div>
              </div>
            )) : (
              <div style={{ textAlign:'center', padding:'32px 0', color:'#9CA3AF', fontSize:14 }}>
                Nous sélectionnerons la meilleure table pour vous.
              </div>
            )}
          </div>
        )}

        {/* ── Step 7 : Extras ── */}
        {step === 7 && (
          <div className="trp-step-animate">
            <h2 className="trp-step-title">Services premium ✨</h2>
            <p className="trp-step-subtitle">Optionnel — personnalisez votre expérience avec nos services exclusifs.</p>
            <div className="trp-extras-grid">
              {EXTRAS_LIST.map(ex => (
                <div
                  key={ex.id}
                  className={`trp-extra ${extras.includes(ex.id) ? 'selected' : ''}`}
                  onClick={() => toggleExtra(ex.id)}
                >
                  <div className="trp-extra-check">✓</div>
                  <span className="trp-extra-icon">{ex.icon}</span>
                  <div className="trp-extra-name">{ex.label}</div>
                </div>
              ))}
            </div>
            <div className="trp-skip">
              <button className="trp-skip-link" onClick={goNext}>Passer cette étape →</button>
            </div>
          </div>
        )}

        {/* ── Step 8 : Menu pré-commande ── */}
        {step === 8 && (
          <div className="trp-step-animate">
            <h2 className="trp-step-title">Pré-commander un plat ? 🍽️</h2>
            <p className="trp-step-subtitle">Optionnel — choisissez vos plats à l'avance pour que le restaurant soit prêt à votre arrivée.</p>

            {menuLoading ? (
              <div className="trp-spinner" />
            ) : (menuCategories.length === 0 && !dailyMenu) ? (
              <div style={{ textAlign:'center', padding:'32px 0', color:'#9CA3AF', fontSize:14 }}>
                Aucun menu disponible à la pré-commande.<br />Vous choisirez sur place.
              </div>
            ) : (
              <>
                {/* Toggle carte / menu du jour */}
                {dailyMenu && (
                  <div style={{ display:'flex', gap:0, marginBottom:18, background:'#F9FAFB', borderRadius:14, padding:4, border:'1px solid #E5E7EB', width:'fit-content' }}>
                    <button onClick={() => setMenuMode('menu_du_jour')} style={{ padding:'8px 16px', border:'none', background:menuMode==='menu_du_jour'?'var(--trp-orange,#FF8A00)':'transparent', color:menuMode==='menu_du_jour'?'#fff':'#6B7280', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:13, fontFamily:'inherit', transition:'all .15s' }}>
                      📅 Menu du jour{dailyMenu.price ? ` — ${Number(dailyMenu.price).toFixed(0)} MAD` : ''}
                    </button>
                    {menuCategories.length > 0 && (
                      <button onClick={() => setMenuMode('carte')} style={{ padding:'8px 16px', border:'none', background:menuMode==='carte'?'#fff':'transparent', color:menuMode==='carte'?'#374151':'#6B7280', borderRadius:10, cursor:'pointer', fontWeight:menuMode==='carte'?700:500, fontSize:13, fontFamily:'inherit', transition:'all .15s', boxShadow:menuMode==='carte'?'0 1px 4px rgba(0,0,0,.1)':'none' }}>
                        À la carte
                      </button>
                    )}
                  </div>
                )}

                {/* ── Menu du jour items ── */}
                {menuMode === 'menu_du_jour' && dailyMenu && (
                  <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
                    {dailyMenu.title && <div style={{ fontWeight:800, fontSize:15, color:'#111827', marginBottom:4 }}>{dailyMenu.title}</div>}
                    {dailyMenu.description && <div style={{ fontSize:13, color:'#6B7280', marginBottom:8 }}>{dailyMenu.description}</div>}
                    {(dailyMenu.items || []).map(dmi => {
                      const item = dmi.menu_item;
                      if (!item) return null;
                      const qty = getPreOrderQty(item.id);
                      return (
                        <div key={dmi.id} style={{ background:'#fff', border:`2px solid ${qty > 0 ? 'var(--trp-orange,#FF8A00)' : '#E5E7EB'}`, borderRadius:16, padding:'14px 16px', display:'flex', gap:12, alignItems:'center', transition:'border-color .2s' }}>
                          {item.image_url ? (
                            <img src={item.image_url.startsWith('http') ? item.image_url : `/${item.image_url}`} alt={item.libelle} style={{ width:64, height:64, borderRadius:12, objectFit:'cover', flexShrink:0, border:'1px solid #F3F4F6' }} onError={e => { e.target.style.display='none'; }} />
                          ) : (
                            <div style={{ width:64, height:64, borderRadius:12, background:'#F9FAFB', display:'grid', placeItems:'center', fontSize:28, flexShrink:0, border:'1px solid #F3F4F6' }}>🍽️</div>
                          )}
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:700, fontSize:14, color:'#111827', marginBottom:2 }}>{item.libelle}</div>
                            {item.description && <div style={{ fontSize:12, color:'#9CA3AF', lineHeight:1.4, marginBottom:4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{item.description}</div>}
                            <div style={{ fontSize:14, fontWeight:800, color:'var(--trp-orange,#FF8A00)' }}>{Number(item.prix || 0).toFixed(2)} MAD</div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                            <button onClick={() => setPreOrderQty(item, qty - 1)} disabled={qty === 0} style={{ width:32, height:32, borderRadius:'50%', border:'2px solid #E5E7EB', background:'#fff', fontSize:18, cursor:'pointer', display:'grid', placeItems:'center', color:'#374151', transition:'all .15s', fontFamily:'inherit', opacity: qty===0 ? 0.35 : 1 }}>−</button>
                            <span style={{ fontWeight:800, fontSize:16, minWidth:20, textAlign:'center', color: qty>0 ? 'var(--trp-orange,#FF8A00)' : '#374151' }}>{qty}</span>
                            <button onClick={() => setPreOrderQty(item, qty + 1)} style={{ width:32, height:32, borderRadius:'50%', border:'2px solid var(--trp-orange,#FF8A00)', background:'var(--trp-orange,#FF8A00)', fontSize:18, cursor:'pointer', display:'grid', placeItems:'center', color:'#fff', transition:'all .15s', fontFamily:'inherit' }}>+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── À la carte items ── */}
                {menuMode === 'carte' && menuCategories.length > 0 && (
                  <>
                    {/* Category tabs */}
                    <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', marginBottom:16, paddingBottom:2 }}>
                      {menuCategories.map((cat, i) => (
                        <button key={cat.id ?? cat.name} onClick={() => setMenuTab(i)} style={{ padding:'8px 16px', border:'2px solid', borderColor: menuTab===i ? 'var(--trp-orange,#FF8A00)' : '#E5E7EB', borderRadius:20, background: menuTab===i ? '#FFF7ED' : '#fff', color: menuTab===i ? 'var(--trp-orange,#FF8A00)' : '#6B7280', fontWeight:700, fontSize:13, cursor:'pointer', whiteSpace:'nowrap', transition:'all .15s', fontFamily:'inherit', flexShrink:0 }}>
                          {cat.name}
                        </button>
                      ))}
                    </div>

                    {/* Items */}
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {(menuCategories[menuTab]?.items || []).filter(i => i.is_available !== false).map(item => {
                        const qty = getPreOrderQty(item.id);
                        return (
                          <div key={item.id} style={{ background:'#fff', border:`2px solid ${qty > 0 ? 'var(--trp-orange,#FF8A00)' : '#E5E7EB'}`, borderRadius:16, padding:'14px 16px', display:'flex', gap:12, alignItems:'center', transition:'border-color .2s' }}>
                            {item.image_url ? (
                              <img src={item.image_url.startsWith('http') ? item.image_url : `/${item.image_url}`} alt={item.libelle} style={{ width:64, height:64, borderRadius:12, objectFit:'cover', flexShrink:0, border:'1px solid #F3F4F6' }} onError={e => { e.target.style.display='none'; }} />
                            ) : (
                              <div style={{ width:64, height:64, borderRadius:12, background:'#F9FAFB', display:'grid', placeItems:'center', fontSize:28, flexShrink:0, border:'1px solid #F3F4F6' }}>🍽️</div>
                            )}
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontWeight:700, fontSize:14, color:'#111827', marginBottom:2 }}>{item.libelle}</div>
                              {item.description && <div style={{ fontSize:12, color:'#9CA3AF', lineHeight:1.4, marginBottom:4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{item.description}</div>}
                              <div style={{ fontSize:14, fontWeight:800, color:'var(--trp-orange,#FF8A00)' }}>{Number(item.prix || 0).toFixed(2)} MAD</div>
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                              <button onClick={() => setPreOrderQty(item, qty - 1)} disabled={qty === 0} style={{ width:32, height:32, borderRadius:'50%', border:'2px solid #E5E7EB', background:'#fff', fontSize:18, cursor:'pointer', display:'grid', placeItems:'center', color:'#374151', transition:'all .15s', fontFamily:'inherit', opacity: qty===0 ? 0.35 : 1 }}>−</button>
                              <span style={{ fontWeight:800, fontSize:16, minWidth:20, textAlign:'center', color: qty>0 ? 'var(--trp-orange,#FF8A00)' : '#374151' }}>{qty}</span>
                              <button onClick={() => setPreOrderQty(item, qty + 1)} style={{ width:32, height:32, borderRadius:'50%', border:'2px solid var(--trp-orange,#FF8A00)', background:'var(--trp-orange,#FF8A00)', fontSize:18, cursor:'pointer', display:'grid', placeItems:'center', color:'#fff', transition:'all .15s', fontFamily:'inherit' }}>+</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Pre-order total */}
                {preOrders.length > 0 && (
                  <div style={{ marginTop:16, background:'linear-gradient(135deg,#FFF7ED,#FFEDD5)', borderRadius:14, padding:'14px 18px', border:'1.5px solid #FED7AA', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:'#92400E' }}>Pré-commande</div>
                      <div style={{ fontSize:11, color:'#B45309', marginTop:2 }}>{preOrders.reduce((s,p) => s+p.qty, 0)} article{preOrders.reduce((s,p) => s+p.qty, 0) > 1 ? 's' : ''} sélectionné{preOrders.reduce((s,p) => s+p.qty, 0) > 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ fontSize:18, fontWeight:900, color:'var(--trp-orange,#FF8A00)' }}>{preOrderTotal.toFixed(2)} MAD</div>
                  </div>
                )}
              </>
            )}

            <div className="trp-skip">
              <button className="trp-skip-link" onClick={goNext}>Commander sur place →</button>
            </div>
          </div>
        )}

        {/* ── Step 9 : Special requests ── */}
        {step === 9 && (
          <div className="trp-step-animate">
            <h2 className="trp-step-title">Demandes spéciales 💬</h2>
            <p className="trp-step-subtitle">Optionnel — allergies, préférences ou tout autre souhait particulier.</p>
            <textarea
              className="trp-textarea"
              placeholder="Ex : allergie aux noix, menu végétarien, table au calme, surprise d'anniversaire…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              maxLength={500}
            />
            <div style={{ textAlign:'right', fontSize:11, color:'#9CA3AF', marginTop:6 }}>{notes.length}/500</div>
            <div className="trp-suggestions">
              {SUGGESTIONS.map(s => (
                <button key={s} className="trp-suggestion" onClick={() => setNotes(n => n ? `${n}, ${s.toLowerCase()}` : s)}>
                  + {s}
                </button>
              ))}
            </div>
            <div className="trp-skip">
              <button className="trp-skip-link" onClick={goNext}>Passer cette étape →</button>
            </div>
          </div>
        )}

        {/* ── Step 10 : Summary + Contact ── */}
        {step === 10 && (
          <div className="trp-step-animate">
            <h2 className="trp-step-title">Récapitulatif 📋</h2>
            <p className="trp-step-subtitle">Vérifiez votre réservation et complétez vos coordonnées.</p>

            {/* Summary card */}
            <div className="trp-summary-card">
              <div className="trp-summary-header">
                <span className="trp-summary-header-icon">🍽️</span>
                <div>
                  <div className="trp-summary-header-title">{org?.name}</div>
                  <div className="trp-summary-header-sub">{org?.city}</div>
                </div>
              </div>
              <div className="trp-summary-rows">
                {reservationType && <SummaryRow icon="✨" label="Occasion"  value={RESERVATION_TYPES.find(t => t.id === reservationType)?.label} />}
                <SummaryRow icon="📅" label="Date"       value={formatDateFr(selectedDate)} />
                <SummaryRow icon="🕐" label="Heure"      value={selectedTime} />
                <SummaryRow icon="👥" label="Convives"   value={[
                  guestLabel(adults),
                  children > 0 ? `${children} enfant${children > 1 ? 's' : ''}` : '',
                  infants > 0  ? `${infants} bébé${infants > 1 ? 's' : ''}` : '',
                  wheelchairSeats > 0 ? `${wheelchairSeats} fauteuil${wheelchairSeats > 1 ? 's' : ''}` : '',
                ].filter(Boolean).join(' · ')} />
                <SummaryRow icon="🪑" label="Table"      value={selectedTable === 'any' ? 'Meilleure table disponible' : selectedTable} />
                {extras.length > 0 && <SummaryRow icon="🎁" label="Extras"  value={extras.map(id => EXTRAS_LIST.find(e => e.id === id)?.label).join(', ')} />}
                {preOrders.length > 0 && (
                  <div style={{ borderTop:'1px solid #F3F4F6', marginTop:8, paddingTop:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <span style={{ fontWeight:700, fontSize:13, color:'#374151' }}>🍽️ Pré-commande</span>
                      <span style={{ fontWeight:800, fontSize:13, color:'var(--trp-orange,#FF8A00)' }}>{preOrderTotal.toFixed(2)} MAD</span>
                    </div>
                    {preOrders.map(p => (
                      <div key={p.id} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#6B7280', lineHeight:1.8 }}>
                        <span>{p.qty}× {p.libelle}</span>
                        <span>{(p.prix * p.qty).toFixed(2)} MAD</span>
                      </div>
                    ))}
                  </div>
                )}
                {notes && <SummaryRow icon="💬" label="Note"        value={notes} />}
              </div>
            </div>

            {/* Contact form */}
            <div className="trp-contact-card">
              <div className="trp-contact-title">
                👤 Vos coordonnées
              </div>
              <div className="trp-form-grid">
                <div className="trp-input-group trp-input-full">
                  <label className="trp-label">Nom complet <span>*</span></label>
                  <input className="trp-input" placeholder="Prénom Nom" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="trp-input-group">
                  <label className="trp-label">Téléphone <span>*</span></label>
                  <input className="trp-input" type="tel" placeholder="+212 6XX XXX XXX" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                <div className="trp-input-group">
                  <label className="trp-label">Email</label>
                  <input className="trp-input" type="email" placeholder="vous@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Policy */}
            <div className="trp-policy">
              <strong>Politique d'annulation :</strong> La réservation peut être annulée gratuitement jusqu'à 2h avant l'heure prévue.
              En cas de no-show répété, des restrictions peuvent s'appliquer.<br />
              <strong>Confirmation :</strong> Votre réservation sera confirmée par le restaurant dans les meilleurs délais.
            </div>

            {error && (
              <div style={{ background:'#FEE2E2', border:'1px solid #FCA5A5', borderRadius:12, padding:'14px 18px', color:'#DC2626', fontWeight:600, fontSize:14, marginBottom:16 }}>
                ⚠️ {error}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── BOTTOM NAV BAR ── */}
      {!submitted && (
        <div className="trp-bottom-bar">
          <div className="trp-bottom-inner">
            <button className="trp-back-btn" onClick={goBack}>←</button>
            {step < STEPS.length ? (
              <button className="trp-next-btn" onClick={goNext} disabled={!canProceed()}>
                Continuer <span>→</span>
              </button>
            ) : (
              <button
                className="trp-next-btn"
                onClick={handleSubmit}
                disabled={!canProceed() || submitting}
                style={{ background: submitting ? '#9CA3AF' : undefined }}
              >
                {submitting ? 'Réservation en cours…' : '✓ Confirmer la réservation'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
