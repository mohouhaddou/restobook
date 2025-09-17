import React, { useEffect, useMemo, useState } from 'react';
import { API, ASSET } from './api';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import autoTable from 'jspdf-autotable';

const LOGO_LIGHT = '/brand/restobook_light.png';
const LOGO_DARK = '/brand/restobook_dark.png';

/* -------------------- Utils -------------------- */
function formatDate(d = new Date()) {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}
function mondayOf(dateStr) {
  const d = new Date(dateStr);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return formatDate(d);
}
async function jfetch(url, options = {}, token) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch(url, { ...options, headers });
  const text = await resp.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!resp.ok) {
    const msg = data?.error || `${resp.status} ${resp.statusText}`;
    throw new Error(msg);
  }
  return data;
}
const CATS = ['entrée', 'plat', 'dessert', 'boisson'];
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

function FloatingMsg({ msg, onClose, autoHideMs = 6000, kind = 'info', offset = 16 }) {
  const [open, setOpen] = React.useState(Boolean(msg));

  const COLORS = {
    info: '#2563eb', // bleu
    success: '#16a34a', // vert
    error: '#dc2626'  // rouge
  };
  const border = COLORS[kind] || COLORS.info;

  React.useEffect(() => {
    setOpen(Boolean(msg));
    if (!msg || !autoHideMs) return;
    const t = setTimeout(() => { setOpen(false); onClose?.(); }, autoHideMs);
    return () => clearTimeout(t);
  }, [msg, autoHideMs, onClose]);

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); onClose?.(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!open || !msg) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        right: 16,
        bottom: offset,            // ⬅ empilage : changez offset pour éviter le chevauchement
        maxWidth: 420,
        zIndex: 9999,
        background: '#fff',
        border: `1px solid ${border}`,
        borderRadius: 10,
        boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
        padding: 12,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        animation: 'fadeInUp .18s ease-out'
      }}
    >
      <div style={{ flex: 1, color: '#111' }}>{msg}</div>
      <button className="btn" onClick={() => { setOpen(false); onClose?.(); }}>
        Fermer
      </button>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// Charge une image statique du dossier /public en DataURL
async function toDataURL(url) {
  const resp = await fetch(url, { cache: 'no-store' });
  const blob = await resp.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// Dessine le logo en haut à gauche, retourne la nouvelle position Y
async function addLogoToPdf(doc, { y = 28, maxW = 150 } = {}) {
  const dataUrl = await toDataURL('/brand/restobook_light.png');
  const w = maxW;
  const h = w * 0.30; // ratio approximatif mot-symbole
  doc.addImage(dataUrl, 'PNG', 56, y, w, h);
  return y + h + 12; // nouvelle ligne après le logo
}

/* -------------------- App -------------------- */
export default function App() {
  /* Session */
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const isManager = user?.role === 'manager' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';
  const canUseEmployee = user?.role === 'user' || user?.role === 'admin';


  /* UI global */
  const [msg, setMsg] = useState('');
  const [activeTab, setActiveTab] = useState('employee'); // employee | plan | prep | items | users | settings

  /* Date & menu du jour */
  const [date, setDate] = useState(formatDate());
  const [menu, setMenu] = useState({ items: [], locked: false, date_jour: formatDate() });

  /* Données employé */
  const [myResa, setMyResa] = useState([]);

  /* Items catalogue (pour planification & admin) */
  const [items, setItems] = useState([]);

  /* Paramètres administrateur */
  const [settings, setSettings] = useState({ cutoff_time: '', allow_cancel_until: '', hero_image_url: '' });

  /* Préparation (manager/admin) */
  const [dailySummary, setDailySummary] = useState([]);
  const [dailyList, setDailyList] = useState([]);
  const [dayStatus, setDayStatus] = useState('confirmed'); // confirmed | cancelled | all

  /* Planification hebdo (manager/admin) */
  const weekStart = useMemo(() => mondayOf(date), [date]);
  const days = useMemo(() => [...Array(5)].map((_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return formatDate(d); }), [weekStart]);
  const [plan, setPlan] = useState({});
  function setDayItem(day, idx, field, value) {
    setPlan(p => { const arr = [...(p[day] || [{}, {}, {}, {}])]; arr[idx] = { ...(arr[idx] || {}), [field]: value }; return { ...p, [day]: arr }; });
  }

  /* Panier brouillon */
  const [cart, setCart] = useState({ entree_id: null, plat_id: null, dessert_id: null, boisson_id: null });
  const [cartMsg, setCartMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  function addToCart(item) {
    const cat = item.type === 'entree' ? 'entrée' : item.type; // tolère "entree"
    const key = `${cat === 'entrée' ? 'entree' : cat}_id`;      // entrée→entree_id
    setCart(c => ({ ...c, [key]: item.id }));
  }
  function clearCart() { setCart({ entree_id: null, plat_id: null, dessert_id: null, boisson_id: null }); }


  async function confirmOrder() {
    setCartMsg('');
    const payload = { date_jour: date, selections: cart };
    const any = payload.selections.entree_id || payload.selections.plat_id || payload.selections.dessert_id || payload.selections.boisson_id;
    if (!any) { setCartMsg('Sélectionnez au moins un item.'); return; }
    try {
      setSubmitting(true);
      const j = await jfetch(API('/reservations/confirm'), { method: 'POST', body: JSON.stringify(payload) }, token);
      setCartMsg('✅ Commande validée.');
      clearCart();
      await Promise.all([loadMine(), loadMenu()]);
    } catch (e) {
      setCartMsg(`❌ ${e.message}`);
    } finally { setSubmitting(false); }
  }

  const [qrSvg, setQrSvg] = useState('');
  const [qrForOrder, setQrForOrder] = useState(null);

  async function showOrderQR(orderCode) {
    try {
      // on encode juste l'order_code (simple et clair)
      const svg = await QRCode.toString(orderCode, { type: 'svg', margin: 0, width: 160 });
      setQrSvg(svg); setQrForOrder(orderCode);
    } catch (e) { setMsg('QR réservation impossible'); }
  }

  async function cancelResa(id) {
    if (!id) return;
    if (!confirm('Confirmer l’annulation de cette réservation ?')) return;
    try {
      setMsg('');
      await jfetch(API(`/reservations/${id}`), { method: 'DELETE' }, token);
      setMsg('Réservation annulée.');
      await Promise.all([loadMine(), loadMenu()]);
    } catch (e) {
      setMsg(`❌ ${e.message}`);
      console.error(e);
    }
  }

  async function cancelOrder(orderCode) {
    if (!orderCode) return;
    if (!confirm('Annuler toute la réservation de ce jour ?')) return;
    try {
      setMsg('');
      const r = await jfetch(API('/reservations/cancel-order'), {
        method: 'POST',
        body: JSON.stringify({ order_code: orderCode })
      }, token);

      if (r.cancelled > 0) {
        setMsg(`Réservation annulée : ${r.cancelled} item(s) annulé(s).`);
      } else {
        const d = r.diagnostic || {};
        setMsg(
          `Aucun item annulé. Détails — total:${d.total ?? '?'}, confirmées:${d.confirmed ?? '?'}, déjà annulées:${d.already_cancelled ?? '?'}, déjà retirées:${d.already_picked ?? '?'}`
        );
      }
      await Promise.all([loadMine(), loadMenu()]);
    } catch (e) {
      setMsg(`❌ ${e.message}`);
    }
  }




  // Génère et télécharge le PDF de reçu pour une ligne (regroupée par date)
  async function downloadReceiptForDay(drow) {
  try {
    if (!drow?.order_code) {
      setMsg("Aucun code de réservation (order_code) n'est associé à cette date.");
      return;
    }

    // 1) Préparer données
    const title = "Reçu de Réservation — Cantine";
    const filename = `recu_${drow.date_jour}_${(user?.matricule || 'user')}.pdf`;

    // QR basé sur order_code
    const qrDataUrl = await QRCode.toDataURL(drow.order_code, { margin: 0, width: 220 });

    // 2) Créer le PDF
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // >>> AJOUT LOGO
    let y = await addLogoToPdf(doc, { y: 28, maxW: 150 });

    // En-tête
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title, 56, y); y += 24;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Date : ${drow.date_jour}`, 56, y); y += 16;
    doc.text(`Réservation : ${drow.order_code}`, 56, y); y += 16;
    doc.text(`Utilisateur : ${user?.nom || ''} (${user?.matricule || ''})`, 56, y); y += 20;

    // Ligne horizontale
    doc.setDrawColor(180); doc.line(56, y, pageW - 56, y); y += 18;

    // 3) Détail des items (Entrée / Plat / Dessert / Boisson)
    doc.setFont('helvetica', 'bold');
    doc.text("Détails commande", 56, y); y += 16;

    const rows = [
      { label: "Entrée",  cell: drow.entree  },
      { label: "Plat",    cell: drow.plat    },
      { label: "Dessert", cell: drow.dessert },
      { label: "Boisson", cell: drow.boisson },
    ];

    doc.setFont('helvetica', 'normal');
    rows.forEach(r => {
      const txt = r.cell
        ? `${r.cell.label}  —  statut: ${r.cell.status}${r.cell.pickup_code ? `  —  code: ${r.cell.pickup_code}` : ''}`
        : '—';
      doc.text(`${r.label} : ${txt}`, 56, y);
      y += 18;
    });

    y += 10;
    doc.setDrawColor(220); doc.line(56, y, pageW - 56, y); y += 16;

    // 4) QR Code (order_code)
    doc.setFont('helvetica', 'bold');
    doc.text("QR de réservation (order_code)", 56, y); y += 8;

    // Image QR à droite
    const qrW = 140, qrH = 140;
    const qrX = pageW - 56 - qrW;
    const qrY = y;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrW, qrH);

    // Rappel d’usage
    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(
      "Présentez ce QR au point de retrait : un seul scan validera toute la commande du jour.",
      56, y, { maxWidth: pageW - 56 - 56 - qrW - 16 }
    );

    // 5) Pied de page
    const footer = "RestoBook — Généré automatiquement";
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(footer, 56, 820);

    // 6) Téléchargement
    doc.save(filename);
  } catch (err) {
    console.error(err);
    setMsg("Échec lors de la génération du reçu.");
  }
}



  /* Connexion */
  async function login(e) {
    e.preventDefault();
    setMsg('');
    const form = new FormData(e.target);
    const matricule = form.get('matricule');
    const password = form.get('password');
    try {
      const j = await jfetch(API('/auth/login'), { method: 'POST', body: JSON.stringify({ matricule, password }) });
      setToken(j.token); setUser(j.user);
    } catch (err) { setMsg(err.message); }
  }
  function logout() { setToken(null); setUser(null); setActiveTab('employee'); }

  /* Chargements */
  const loadMenu = async () => {
    if (!token) return;
    try { const j = await jfetch(API(`/menu/today?date=${date}`), {}, token); setMenu(j); }
    catch (e) { setMsg(e.message); }
  };
  const loadMine = async () => {
    if (!token) return;
    try {
      const j = await jfetch(API('/reservations/me?view=matrix_day'), {}, token);
      setMyResa(j.items || []);
    } catch (e) { setMsg(e.message); }
  };

  const loadItems = async () => {
    if (!token) return;
    try { const j = await jfetch(API('/menu/items'), {}, token); setItems(j.items || []); }
    catch (e) { setMsg(e.message); }
  };

  const [prepView, setPrepView] = useState('person'); // 'item' | 'person'

  async function loadPrep() {
    if (!token || !isManager) return;
    try {
      const sum = await jfetch(API(`/reservations/summary?date=${date}`), {}, token);
      setDailySummary(sum.items || []);
      const lst = await jfetch(API(`/reservations/day?date=${date}&status=${dayStatus}&view=matrix`), {}, token);
      setDailyList(lst.items || []);
    } catch (e) { setMsg(e.message); }
  }

  useEffect(() => { if (isManager) loadPrep(); }, [token, isManager, date, dayStatus, prepView]);



 async function exportPrepPDF() {
  try {
    // 1) Recharger les données nécessaires (évite les décalages de format)
    const [sum, matrix] = await Promise.all([
      jfetch(API(`/reservations/summary?date=${date}`), {}, token),                        // -> { items: [{category, libelle, count}] }
      jfetch(API(`/reservations/day?date=${date}&status=${dayStatus}&view=matrix`), {}, token) // -> { items: [{matricule, nom, entree, plat, dessert, boisson}] }
    ]);

    // 2) Construire le récap catégorisé
    const cats = { 'entrée': [], 'plat': [], 'dessert': [], 'boisson': [] };
    (sum.items || []).forEach(it => {
      const c = (it.category || '').replace(/^entree$/, 'entrée');
      if (!cats[c]) cats[c] = [];
      cats[c].push({ libelle: it.libelle, count: Number(it.count || 0) });
    });

    // 3) Lignes “préparation par personne”
    const prepRows = (matrix.items || []).map(r => ([
      r.matricule || '',
      r.nom || '',
      r.entree || '—',
      r.plat || '—',
      r.dessert || '—',
      r.boisson || '—'
    ]));

    // 4) Génération du PDF
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // Logo RestoBook
    let y = await addLogoToPdf(doc, { y: 28, maxW: 150 });

    // En-tête
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text(`Préparation du ${date}`, 40, y + 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text('Généré par RestoBook', 40, y + 34);

    // --- Récapitulatif par catégorie ---
    y += 56;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Récapitulatif par catégorie', 40, y); y += 10;

    const order = ['entrée', 'plat', 'dessert', 'boisson'];
    for (const cat of order) {
      const items = cats[cat] || [];
      if (!items.length) continue;

      y += 18;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text(cat.toUpperCase(), 40, y); y += 6;

      autoTable(doc, {
        startY: y + 8,
        head: [['Plat', 'Quantité']],
        body: items.map(it => [it.libelle, it.count]),
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [240, 240, 240] },
        margin: { left: 40, right: 40 },
        tableWidth: pageW - 80
      });
      y = doc.lastAutoTable.finalY || y;
    }

    // Séparateur
    y += 24; doc.setDrawColor(220); doc.line(40, y, pageW - 40, y); y += 16;

    // --- Préparation par personne ---
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Préparation par personne', 40, y);

    autoTable(doc, {
      startY: y + 12,
      head: [['Matricule', 'Nom', 'Entrée', 'Plat', 'Dessert', 'Boisson']],
      body: prepRows,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [240, 240, 240] },
      margin: { left: 40, right: 40 },
      tableWidth: pageW - 80,
      columnStyles: {
        0: { cellWidth: 80 },   // Matricule
        1: { cellWidth: 160 }   // Nom
        // autres colonnes s'adaptent
      }
    });

    // 5) Télécharger
    doc.save(`preparation_${date}.pdf`);
  } catch (e) {
    console.error(e);
    setMsg(`❌ Export PDF impossible : ${e.message}`);
  }
}



  /* Admin: users */
  const [users, setUsers] = useState([]);
  async function loadUsers() {
    if (!token || !isAdmin) return;
    const j = await jfetch(API('/admin/users'), {}, token);
    setUsers(j.users || []);
  }
  async function adminCreate(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const payload = {
      matricule: f.get('matricule'),
      nom: f.get('nom'),
      email: f.get('email'),
      role: f.get('role'),
      password: f.get('password') || 'changeme',
      actif: true
    };
    try { await jfetch(API('/admin/users'), { method: 'POST', body: JSON.stringify(payload) }, token); setMsg('Utilisateur créé'); e.target.reset(); loadUsers(); }
    catch (e) { setMsg(e.message); }
  }
  async function adminUpdate(u, data) {
    try { await jfetch(API(`/admin/users/${u.id}`), { method: 'PATCH', body: JSON.stringify(data) }, token); setMsg('Utilisateur mis à jour'); loadUsers(); }
    catch (e) { setMsg(e.message); }
  }
  async function adminDelete(u) {
    if (!confirm('Supprimer utilisateur ?')) return;
    try { await jfetch(API(`/admin/users/${u.id}`), { method: 'DELETE' }, token); setMsg('Utilisateur supprimé'); loadUsers(); }
    catch (e) { setMsg(e.message); }
  }

  /* Admin: settings & héro */
  async function loadSettings() {
    if (!token || !isAdmin) return;
    try {
      const j = await jfetch(API('/admin/settings'), {}, token);
      setSettings({
        cutoff_time: j.settings?.cutoff_time || '',
        allow_cancel_until: j.settings?.allow_cancel_until || '',
        hero_image_url: j.settings?.hero_image_url || '/img/hero.jpg'
      });
    } catch (e) { setMsg(e.message); }
  }
  async function saveSettings(e) {
    e?.preventDefault?.();
    try {
      await jfetch(API('/admin/settings'), {
        method: 'PUT',
        body: JSON.stringify({
          cutoff_time: settings.cutoff_time,
          allow_cancel_until: settings.allow_cancel_until
        })
      }, token);
      setMsg('Paramètres sauvegardés');
    } catch (e) { setMsg(e.message); }
  }
  const [heroUrlInput, setHeroUrlInput] = useState('');
  const [heroFile, setHeroFile] = useState(null);
  async function uploadHero(e) {
    e.preventDefault();
    if (!heroFile) { setMsg('Choisissez un fichier image.'); return; }
    try {
      const fd = new FormData();
      fd.append('image', heroFile);
      const r = await fetch(API('/admin/branding/hero'), { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Upload impossible');
      setMsg('Image héro mise à jour.');
      setHeroFile(null);
      await loadSettings();
    } catch (e) { setMsg(e.message); }
  }
  async function saveHeroUrl(e) {
    e.preventDefault();
    try {
      await jfetch(API('/admin/settings'), { method: 'PUT', body: JSON.stringify({ hero_image_url: heroUrlInput || '/img/hero.jpg' }) }, token);
      setMsg('URL héro enregistrée.');
      setHeroUrlInput('');
      await loadSettings();
    } catch (e) { setMsg(e.message); }
  }

  /* Admin/Manager: Items CRUD */
  const [adminItems, setAdminItems] = useState([]);
  const [editItem, setEditItem] = useState(null);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [clearImage, setClearImage] = useState(false);
  async function adminLoadItems() {
    if (!token || (!isAdmin && !isManager)) return; // <- corrige la condition
    try {
      const j = await jfetch(API('/menu/items'), {}, token);
      setAdminItems(j.items || []);
    } catch (e) { setMsg(e.message); }
  }
  async function adminUpdateItem(e) {
    e?.preventDefault?.();
    if (!editItem) return;
    try {
      const hasFile = !!editImageFile;
      const hasUrl = !!editImageUrl;
      let body, headers;
      if (hasFile) {
        const fd = new FormData();
        fd.append('libelle', editItem.libelle || '');
        fd.append('description', editItem.description || '');
        fd.append('type', editItem.type || 'plat');
        if (clearImage) fd.append('clear_image', 'true');
        fd.append('image', editImageFile);
        body = fd; headers = { Authorization: `Bearer ${token}` };
      } else {
        const payload = {
          libelle: editItem.libelle || '',
          description: editItem.description || '',
          type: editItem.type || 'plat',
        };
        if (clearImage) payload.clear_image = true;
        if (hasUrl) payload.image_url = editImageUrl;
        body = JSON.stringify(payload);
        headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      }
      const r = await fetch(API(`/menu/items/${editItem.id}`), { method: 'PATCH', headers, body });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Mise à jour impossible');
      setMsg('Item mis à jour.');
      setEditItem(null); setEditImageFile(null); setEditImageUrl(''); setClearImage(false);
      adminLoadItems(); loadItems();
    } catch (e) { setMsg(e.message); }
  }
  async function adminDeleteItem(item) {
    if (!confirm(`Supprimer "${item.libelle}" ?`)) return;
    try {
      const r = await fetch(API(`/menu/items/${item.id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Suppression impossible');
      setMsg('Item supprimé.'); adminLoadItems(); loadItems();
    } catch (e) { setMsg(e.message); }
  }

  /* Effets */
  useEffect(() => { if (token) loadMenu(); }, [date, token]);
  useEffect(() => { if (token) { loadMine(); loadItems(); } }, [token]);
  useEffect(() => { if (isAdmin) { loadUsers(); loadSettings(); } }, [token, isAdmin]);
  useEffect(() => { if (isManager) loadPrep(); }, [token, isManager, date, dayStatus]);
  useEffect(() => { if (isAdmin || isManager) adminLoadItems(); }, [token, isAdmin, isManager]);
  useEffect(() => {
  if (!user) return;
  if (!canUseEmployee && activeTab === 'employee') {
    // manager → basculer vers un onglet autorisé
    setActiveTab(isManager ? 'plan' : 'prep');
  }
}, [user, canUseEmployee, isManager, activeTab]);


  /* Groupes par catégorie pour vue Employé */
  const grouped = useMemo(() => {
    const g = { 'entrée': [], 'plat': [], 'dessert': [], 'boisson': [] };
    (menu.items || []).forEach(it => { const t = (it.type === 'entree' ? 'entrée' : it.type); if (g[t]) g[t].push(it); });
    return g;
  }, [menu.items]);
  const [activeCat, setActiveCat] = useState('tous');
  const counts = useMemo(() => ({
    'entrée': grouped['entrée'].length,
    'plat': grouped['plat'].length,
    'dessert': grouped['dessert'].length,
    'boisson': grouped['boisson'].length,
    'tous': (menu.items || []).length
  }), [grouped, menu.items]);

  /* Actions planification */
  async function saveDay(day) {
    try {
      const itemsForDay = (plan[day] || []).filter(x => x.menu_item_id);
      await jfetch(API('/menu/day'), {
        method: 'POST',
        body: JSON.stringify({ date_jour: day, items: itemsForDay.map(x => ({ menu_item_id: Number(x.menu_item_id), quota: x.quota ? Number(x.quota) : null })) })
      }, token);
      setMsg(`Menu enregistré pour ${day}`);
      if (day === date) loadMenu();
    } catch (e) { setMsg(e.message); }
  }

  /* --- Rendu --- */
  return (
    <div className="shell">
      {/* Nav / Session */}
      <div className="nav">

        <div className="brand">
          <picture>
            <img src={LOGO_LIGHT} alt="RestoBook" height={88} style={{ display: 'block' }} />
          </picture>
        </div>

        <div className="row">
          {user ? (
            <>
              <span className="muted">
                Connecté : <b>{user.nom || user.matricule}</b> <span className="muted">({user.role})</span>
              </span>
              <button className="btn" onClick={logout}>Déconnexion</button>
            </>
          ) : null}
        </div>
      </div>



      {/* Héro */}
      <div className="hero" style={{ backgroundImage: `url('${ASSET(settings.hero_image_url || '/img/hero.jpg')}')` }}>
        <div className="hero-brand">
          <div>
            <h2>RestoBook — Réservations & Préparation</h2>
            <div className="hero-sub">Planifiez le menu, collectez les réservations, préparez les plats.</div>
          </div>
        </div>
      </div>

      {/* Connexion */}
      {!user ? (
        <div className="card">
          <h3>Connexion</h3>
          <p className="muted">Comptes démo — admin: <code>admin</code>/<code>admin123</code> • user: <code>E12345</code>/<code>test123</code></p>
          <form onSubmit={login} className="grid">
            <input name="matricule" placeholder="Matricule" required />
            <input name="password" type="password" placeholder="Mot de passe" required />
            <button className="btn primary" type="submit">Se connecter</button>
          </form>
          <FloatingMsg msg={msg} onClose={() => setMsg('')} kind="info" offset={16} />


        </div>
      ) : (
        <>
          <FloatingMsg msg={msg} onClose={() => setMsg('')} />


          {/* Layout avec sidebar */}
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16 }}>
            {/* Sidebar navigation */}
            <aside className="card" style={{ padding: 12, position: 'sticky', top: 12, height: 'fit-content' }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Navigation</div>
                <div className="grid" style={{ gap: 8 }}>
                  {canUseEmployee && (
                    <button
                      className={`btn ${activeTab === 'employee' ? 'is-active' : ''}`}
                      onClick={() => setActiveTab('employee')}
                    >
                      Espace Employé
                    </button>
                  )}
                  {isManager && (
                    <button
                      className={`btn ${activeTab === 'plan' ? 'is-active' : ''}`}
                      onClick={() => setActiveTab('plan')}
                    >
                      Gestion hebdo
                    </button>
                  )}
                  {isManager && (
                    <button
                      className={`btn ${activeTab === 'prep' ? 'is-active' : ''}`}
                      onClick={() => setActiveTab('prep')}
                    >
                      Préparation du jour
                    </button>
                  )}
                  {(isAdmin || isManager) && (
                    <button
                      className={`btn ${activeTab === 'items' ? 'is-active' : ''}`}
                      onClick={() => setActiveTab('items')}
                    >
                      Admin — Items
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      className={`btn ${activeTab === 'users' ? 'is-active' : ''}`}
                      onClick={() => setActiveTab('users')}
                    >
                      Admin — Utilisateurs
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      className={`btn ${activeTab === 'settings' ? 'is-active' : ''}`}
                      onClick={() => setActiveTab('settings')}
                    >
                      Paramètres
                    </button>
                  )}
                </div>


              {/* Filtre catégories (seulement onglet Employé si des items) */}
              {canUseEmployee && activeTab === 'employee' && (menu.items?.length ?? 0) > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Catégories</div>
                  {['tous', ...CATS].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveCat(cat)}
                      className="btn"
                      style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: 8, background: activeCat === cat ? '#e2e8f0' : undefined }}
                    >
                      <span style={{ textTransform: 'capitalize' }}>{cat}</span>
                      <span className="pill">{counts[cat] ?? 0}</span>
                    </button>
                  ))}
                </div>
              )}
            </aside>

            {/* Contenu principal */}
            <main className="grid" style={{ gap: 16 }}>
              {/* Onglet Employé */}
              {activeTab === 'employee' && (
                <div className="card">
                  <div className="row" style={{ marginBottom: 8 }}>
                    <label>Date :</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} />
                    <button className="btn" onClick={loadMenu}>Recharger</button>
                    {menu.locked && <span className="pill" title="Verrouillé">Jour verrouillé</span>}
                  </div>

                  {(menu.items?.length ?? 0) === 0 ? (
                    <p className="muted">Aucun item planifié pour ce jour.</p>
                  ) : (
                    <>
                      {/* Mode filtré */}
                      {activeCat !== 'tous' ? (
                        <>
                          <h3 style={{ margin: '8px 0' }}>{cap(activeCat)} ({counts[activeCat]})</h3>
                          {(grouped[activeCat] || []).length === 0 ? (
                            <div className="muted">Aucun élément.</div>
                          ) : (
                            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                              {grouped[activeCat].map(it => (
                                <MenuCard key={it.id} it={it} menu={menu} addToCart={addToCart} />
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        /* Sections par catégorie */
                        <>
                          {CATS.map(cat => (
                            <section key={cat} style={{ marginBottom: 16 }}>
                              <h3 style={{ margin: '8px 0' }}>{cap(cat)} ({counts[cat]})</h3>
                              {(grouped[cat] || []).length === 0 ? (
                                <div className="muted">Aucun {cat} planifié.</div>
                              ) : (
                                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                  {grouped[cat].map(it => (
                                    <MenuCard key={it.id} it={it} menu={menu} addToCart={addToCart} />
                                  ))}
                                </div>
                              )}
                            </section>
                          ))}
                        </>
                      )}
                    </>
                  )}

                  {/* Panier */}
                  <div className="card" style={{ marginTop: 12 }}>
                    <h3>Panier du {date} (brouillon)</h3>
                    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      {['entrée', 'plat', 'dessert', 'boisson'].map(cat => {
                        const key = `${cat === 'entrée' ? 'entree' : cat}_id`;
                        const id = cart[key];
                        const item = id ? menu.items.find(x => x.id === id) : null;
                        return (
                          <div key={cat} className="card" style={{ padding: 12 }}>
                            <div style={{ fontWeight: 600, marginBottom: 6 }}>{cat.toUpperCase()}</div>
                            {item ? (
                              <>
                                <div className="muted">{item.libelle}</div>
                                <button className="btn danger" onClick={() => setCart(c => ({ ...c, [key]: null }))} style={{ marginTop: 8 }}>Retirer</button>
                              </>
                            ) : (
                              <div className="muted">Aucun {cat} sélectionné</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="row" style={{ marginTop: 8 }}>
                      <button className="btn" onClick={clearCart} disabled={submitting}>Vider</button>
                      <button className="btn primary" onClick={confirmOrder} disabled={submitting}>
                        {submitting ? 'Validation…' : 'Valider la commande'}
                      </button>
                    </div>
                    <FloatingMsg
                      msg={cartMsg}
                      onClose={() => setCartMsg('')}
                      kind={/✅|validée|ok/i.test(cartMsg) ? 'success' : (/❌|erreur|fail/i.test(cartMsg) ? 'error' : 'info')}
                      offset={84}
                    />

                  </div>

                  {/* Mes réservations */}
                  <div className="card">
                    <h3>Mes réservations</h3>
                    {(!myResa || myResa.length === 0) ? (
                      <div className="muted">Aucune réservation.</div>
                    ) : (
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Entrée</th>
                            <th>Plat</th>
                            <th>Dessert</th>
                            <th>Boisson</th>
                            <th>Actions</th>

                          </tr>
                        </thead>
                        <tbody>
                          {myResa.map((drow) => (
                            <tr key={drow.date_jour}>
                              <td><b>{drow.date_jour}</b></td>

                              {['entree', 'plat', 'dessert', 'boisson'].map(cat => {
                                const cell = drow[cat];
                                return (
                                  <td key={cat}>
                                    {cell ? (
                                      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                                        <span>{cell.label}</span>
                                        <span className="pill">{cell.status}</span>
                                        <span className="pill">{cell.pickup_code}</span>
                                        {cell.status === 'confirmed' && (
                                          <button className="btn danger" onClick={() => cancelResa(cell.id)}>Annuler</button>
                                        )}
                                      </div>
                                    ) : <span className="muted">—</span>}
                                  </td>
                                );
                              })}


                              <td className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                                {drow.order_code ? (
                                  <>
                                    <button className="btn" onClick={() => downloadReceiptForDay(drow)}>Télécharger reçu</button>
                                    <button className="btn danger" onClick={() => cancelOrder(drow.order_code)}>Annuler la journée</button>
                                  </>
                                ) : <span className="muted">—</span>}
                              </td>


                            </tr>
                          ))}
                        </tbody>
                      </table>

                    )}
                  </div>
                  {qrForOrder && (
                    <div className="card" style={{ marginTop: 12 }}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <h4>QR — Réservation {qrForOrder}</h4>
                        <button className="btn" onClick={() => { setQrForOrder(null); setQrSvg(''); }}>Fermer</button>
                      </div>
                      <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
                      <div className="muted">Présentez ce QR au point de retrait pour valider toute la commande du jour.</div>
                    </div>
                  )}


                </div>
              )}

              {/* Onglet Gestion hebdo */}
              {isManager && activeTab === 'plan' && (
                <div className="card">
                  <h3>Planification hebdomadaire</h3>
                  <div className="muted">Semaine du <b>{weekStart}</b></div>
                  <div className="grid" style={{ gap: 12 }}>
                    {days.map((d) => (
                      <div key={d} className="card" style={{ padding: 12 }}>
                        <div className="row"><b>{d}</b> <button className="btn" onClick={() => saveDay(d)}>Enregistrer ce jour</button></div>
                        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                          <div key={i} className="row">
                            <select value={plan[d]?.[i]?.menu_item_id || ''} onChange={e => setDayItem(d, i, 'menu_item_id', e.target.value)}>
                              <option value="">— Plat —</option>
                              {items.map(it => <option key={it.id} value={it.id}>{it.libelle}</option>)}
                            </select>
                            <input type="number" min="0" placeholder="Quota (vide = ∞)" value={plan[d]?.[i]?.quota || ''} onChange={e => setDayItem(d, i, 'quota', e.target.value)} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>


                </div>
              )}

              {/* Onglet Préparation */}
              {isManager && activeTab === 'prep' && (
                <div className="card">
                  <h3>Préparation du jour</h3>
                  <div className="row" style={{ marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                    <label>Date :</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} />
                    <label>Statut :</label>
                    <select value={dayStatus} onChange={e => setDayStatus(e.target.value)}>
                      <option value="confirmed">confirmées</option>
                      <option value="cancelled">annulées</option>
                      <option value="all">toutes</option>
                    </select>

                    <label>Vue :</label>
                    <select value={prepView} onChange={e => setPrepView(e.target.value)}>
                      <option value="person">par personne</option>
                      <option value="item">par plat</option>
                    </select>

                    <button className="btn" onClick={loadPrep}>Actualiser</button>
                    <button className="btn" onClick={exportPrepPDF}>Exporter PDF</button>

                  </div>


                  <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="card">
                      <h4>Récapitulatif par plat</h4>
                      {dailySummary.length ? (
                        <table>
                          <thead><tr><th>Plat</th><th>Quantité</th></tr></thead>
                          <tbody>
                            {dailySummary.map(it => (
                              <tr key={it.menu_item_id}>
                                <td>{it.libelle}</td>
                                <td><b>{it.count}</b></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : <div className="muted">Aucune réservation.</div>}
                    </div>

                    <div className="card">
                      <h4>{prepView === 'person' ? 'Préparation par personne' : 'Liste des réservations'}</h4>

                      {prepView === 'person' ? (
                        dailyList.length ? (
                          <table>
                            <thead>
                              <tr>
                                <th>Matricule</th>
                                <th>Nom</th>
                                <th>Entrée</th>
                                <th>Plat</th>
                                <th>Dessert</th>
                                <th>Boisson</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dailyList.map((r, idx) => (
                                <tr key={idx}>
                                  <td>{r.matricule}</td>
                                  <td>{r.nom}</td>
                                  <td>{r.entree || '—'}</td>
                                  <td>{r.plat || '—'}</td>
                                  <td>{r.dessert || '—'}</td>
                                  <td>{r.boisson || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="muted">Aucune réservation.</div>
                        )
                      ) : (
                        // Vue "item" = votre table existante
                        (dailyList.length ? (
                          <table>
                            <thead><tr><th>Matricule</th><th>Nom</th><th>Plat</th><th>Statut</th><th>Créée</th></tr></thead>
                            <tbody>
                              {dailyList.map(r => (
                                <tr key={r.id}>
                                  <td>{r.matricule}</td>
                                  <td>{r.nom}</td>
                                  <td>{r.plat}</td>
                                  <td>{r.status}</td>
                                  <td>{String(r.created_at).replace('T', ' ').slice(0, 19)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : <div className="muted">Aucune réservation.</div>)
                      )}
                    </div>

                  </div>
                </div>
              )}

              {/* Onglet Administration — Items */}
              {(isAdmin || isManager) && activeTab === 'items' && (
                <div className="card">
                  <h3>Administration — Items du menu</h3>
                  <p className="muted">Modifier libellé, description, type ou image (upload/URL). Vous pouvez aussi retirer l’image.</p>
                  <table>
                    <thead>
                      <tr><th>Image</th><th>Libellé</th><th>Type</th><th>Description</th><th style={{ width: 180 }}>Actions</th></tr>
                    </thead>
                    <tbody>
                      {adminItems.map(it => (
                        <tr key={it.id}>
                          <td>{it.image_url ? (<img src={ASSET(it.image_url)} alt="" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }} />) : <span className="muted">—</span>}</td>
                          <td>{it.libelle}</td>
                          <td>{it.type}</td>
                          <td className="muted">{it.description}</td>
                          <td className="row">
                            <button className="btn" onClick={() => { setEditItem({ id: it.id, libelle: it.libelle, description: it.description || '', type: it.type, image_url: it.image_url || '' }); setEditImageFile(null); setEditImageUrl(''); setClearImage(false); }}>Éditer</button>
                            {(isManager || isAdmin) && <button className="btn danger" onClick={() => adminDeleteItem(it)}>Supprimer</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {editItem && (
                    <div className="card" style={{ marginTop: 12 }}>
                      <h4>Modifier : {editItem.libelle}</h4>
                      <form onSubmit={adminUpdateItem} className="grid" style={{ gap: 8 }}>
                        <div className="row">
                          <input value={editItem.libelle} onChange={e => setEditItem(s => ({ ...s, libelle: e.target.value }))} placeholder="Libellé" required />
                          <select value={editItem.type} onChange={e => setEditItem(s => ({ ...s, type: e.target.value }))}>
                            <option value="plat">Plat</option>
                            <option value="entrée">Entrée</option>
                            <option value="dessert">Dessert</option>
                            <option value="boisson">Boisson</option>
                          </select>
                        </div>
                        <input value={editItem.description} onChange={e => setEditItem(s => ({ ...s, description: e.target.value }))} placeholder="Description" />
                        <div className="row" style={{ alignItems: 'center' }}>
                          <div className="card" style={{ padding: 8 }}>
                            <div className="muted">Aperçu</div>
                            <img
                              src={ASSET(editItem.image_url || '')}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              alt=""
                              style={{ width: 240, height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }}
                            />
                          </div>
                          <div className="grid">
                            <label><b>Remplacer par un fichier</b></label>
                            <input type="file" accept="image/*" onChange={e => { setEditImageFile(e.target.files?.[0] || null); setEditImageUrl(''); }} />
                            <span className="muted">ou</span>
                            <input placeholder="URL http(s):// ou /uploads/..." value={editImageUrl} onChange={e => { setEditImageUrl(e.target.value); setEditImageFile(null); }} style={{ minWidth: 320 }} />
                            <label className="row"><input type="checkbox" checked={clearImage} onChange={e => setClearImage(e.target.checked)} /> Retirer l’image</label>
                          </div>
                        </div>
                        <div className="row">
                          <button className="btn" type="button" onClick={() => { setEditItem(null); setEditImageFile(null); setEditImageUrl(''); setClearImage(false); }}>Annuler</button>
                          <button className="btn primary" type="submit">Enregistrer</button>
                        </div>
                      </form>
                    </div>
                  )}
                  <div className="card" style={{ marginTop: 12 }}>
                    <h4>Ajouter un item de menu</h4>
                    <AddItem onDone={loadItems} token={token} />
                  </div>
                </div>
              )}

              {/* Onglet Administration — Utilisateurs */}
              {isAdmin && activeTab === 'users' && (
                <div className="card">
                  <h3>Administration — Utilisateurs</h3>
                  <form onSubmit={adminCreate} className="row" style={{ marginBottom: 12 }}>
                    <input name="matricule" placeholder="Matricule" required />
                    <input name="nom" placeholder="Nom" />
                    <input name="email" placeholder="Email" />
                    <select name="role" defaultValue="user">
                      <option value="user">user</option>
                      <option value="manager">manager</option>
                      <option value="admin">admin</option>
                    </select>
                    <input name="password" type="password" placeholder="Mot de passe (déf: changeme)" />
                    <button className="btn primary" type="submit">Créer</button>
                  </form>

                  <table>
                    <thead><tr><th>Matricule</th><th>Nom</th><th>Email</th><th>Rôle</th><th>Actif</th><th>Actions</th></tr></thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td>{u.matricule}</td>
                          <td>{u.nom || ''}</td>
                          <td>{u.email || ''}</td>
                          <td>
                            <select value={u.role} onChange={e => adminUpdate(u, { role: e.target.value })}>
                              <option value="user">user</option>
                              <option value="manager">manager</option>
                              <option value="admin">admin</option>
                            </select>
                          </td>
                          <td><input type="checkbox" checked={u.actif} onChange={e => adminUpdate(u, { actif: e.target.checked })} /></td>
                          <td className="row">
                            <button className="btn" onClick={() => { const pw = prompt('Nouveau mot de passe :'); if (pw) adminUpdate(u, { password: pw }); }}>Réinitialiser MDP</button>
                            <button className="btn danger" onClick={() => adminDelete(u)}>Supprimer</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Onglet Paramètres */}
              {isAdmin && activeTab === 'settings' && (
                <>
                  <div className="card">
                    <h3>Paramètres — Heures limites</h3>
                    <p className="muted">Fuseau : Africa/Casablanca. Format 24h <code>HH:MM</code>.</p>
                    <form onSubmit={saveSettings} className="row" style={{ marginTop: 8 }}>
                      <label>Heure limite réservation (cutoff) :</label>
                      <input type="time" required value={settings.cutoff_time || ''} onChange={e => setSettings(s => ({ ...s, cutoff_time: e.target.value }))} />
                      <label>Heure limite d’annulation :</label>
                      <input type="time" required value={settings.allow_cancel_until || ''} onChange={e => setSettings(s => ({ ...s, allow_cancel_until: e.target.value }))} />
                      <button className="btn primary" type="submit">Enregistrer</button>
                      <button className="btn" type="button" onClick={loadSettings}>Recharger</button>
                    </form>
                  </div>

                  <div className="card" style={{ marginTop: 12 }}>
                    <h4>Image de héro</h4>
                    <div className="row" style={{ alignItems: 'flex-start' }}>
                      <div className="card" style={{ padding: 8 }}>
                        <div className="muted">Aperçu actuel</div>
                        <img
                          src={ASSET(settings.hero_image_url || '/img/hero.jpg')}
                          alt="Hero"
                          style={{ width: 360, height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }}
                        />
                      </div>

                      <form onSubmit={uploadHero} className="grid">
                        <label><b>Uploader un fichier (remplace immédiatement)</b></label>
                        <input type="file" accept="image/*" onChange={e => setHeroFile(e.target.files?.[0] || null)} />
                        <button className="btn" type="submit">Uploader</button>
                      </form>

                      <form onSubmit={saveHeroUrl} className="grid">
                        <label><b>Ou définir une URL (http(s):// ou /uploads/...)</b></label>
                        <input
                          placeholder="https://… ou /uploads/branding/hero_xxx.jpg"
                          value={heroUrlInput}
                          onChange={e => setHeroUrlInput(e.target.value)}
                          style={{ minWidth: 320 }}
                        />
                        <button className="btn" type="submit">Enregistrer URL</button>
                      </form>
                    </div>
                    <p className="muted">Formats: jpeg, png, webp, gif. Taille max: 6 MB.</p>
                  </div>
                </>
              )}
            </main>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------- Composants auxiliaires -------------------- */
function MenuCard({ it, menu, addToCart }) {
  const disabled = menu.locked || (it.restant !== null && it.restant <= 0);
  return (
    <div className="card menu-item">
      <div className="thumb" style={{ backgroundImage:`url('${ASSET(it.image_url) || ''}')` }} />
      <div style={{ flex:1 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:700 }}>{it.libelle}</div>
          <span className="pill">{it.type}</span>
        </div>
        <div className="muted" style={{ margin:'4px 0 6px' }}>{it.description}</div>
        <div className="muted">Restant : {it.restant === null ? '∞' : it.restant}</div>
        <div className="row" style={{ marginTop:8 }}>
          <button className="btn" disabled={disabled} onClick={() => addToCart(it)}>
            Ajouter {it.type === 'entrée' ? "l'entrée" : it.type === 'plat' ? 'le plat' : (it.type === 'dessert' ? 'le dessert' : 'la boisson')}
          </button>
        </div>
      </div>
    </div>
  );
}


function AddItem({ onDone, token }) {
  const [libelle, setLibelle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('plat');
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');

  async function save(e) {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('libelle', libelle);
      if (description) fd.append('description', description);
      fd.append('type', type);
      if (imageFile) fd.append('image', imageFile); else if (imageUrl) fd.append('image_url', imageUrl);

      const r = await fetch(API('/menu/items'), { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur ajout item');

      setLibelle(''); setDescription(''); setType('plat'); setImageFile(null); setImageUrl('');
      onDone?.();
      alert('Item créé' + (j.image_url ? ' (image attachée)' : ''));
    } catch (e) { alert(e.message); }
  }

  return (
    <form onSubmit={save} className="grid" style={{ gap: 8 }}>
      <div className="row">
        <input placeholder="Libellé" value={libelle} onChange={e => setLibelle(e.target.value)} required />
        <select value={type} onChange={e => setType(e.target.value)}>
          <option value="plat">Plat</option>
          <option value="entrée">Entrée</option>
          <option value="dessert">Dessert</option>
          <option value="boisson">Boisson</option>
        </select>
      </div>
      <input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />

      <div className="row">
        <label>Image (fichier) :</label>
        <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
        <span className="muted">ou</span>
        <input placeholder="URL d’image (https://…)" value={imageUrl} onChange={e => setImageUrl(e.target.value)} style={{ minWidth: 280 }} />
      </div>

      <button className="btn primary" type="submit">Ajouter</button>
    </form>
  );
}
