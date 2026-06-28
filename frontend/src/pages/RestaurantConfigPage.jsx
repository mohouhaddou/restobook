import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import { useApi } from '../hooks/useApi';
import { Toast } from '../components/ui/Toast';
import { API, ASSET } from '../api';

// ── Jours de la semaine ──────────────────────────────────────────────────────
const DAYS_FR = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

function weekDates(monday) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function getMondayOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

// ── Input stylé réutilisable ─────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '10px 13px', borderRadius: 10, fontSize: 14,
  border: '1.5px solid #E5E7EB', outline: 'none', color: '#111827',
  background: '#fff', fontFamily: 'inherit',
};

function Label({ children, req }) {
  return (
    <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>
      {children}{req && <span style={{ color: '#EF4444', marginLeft: 3 }}>*</span>}
    </label>
  );
}

function ToggleSwitch({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <div onClick={() => onChange(!checked)} style={{ width: 44, height: 24, borderRadius: 12, background: checked ? 'var(--rb-orange,#FF8A00)' : '#D1D5DB', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 3, left: checked ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
      </div>
      <span style={{ fontSize: 13, color: '#374151' }}>{label}</span>
    </label>
  );
}

// ── ImageUploadCard ───────────────────────────────────────────────────────────
function ImageUploadCard({ type, currentUrl, token, onUploaded, onError }) {
  const [dragging, setDragging]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview]     = useState(currentUrl || '');
  const inputRef = useRef();

  useEffect(() => { setPreview(currentUrl || ''); }, [currentUrl]);

  // Nginx sert /uploads/ à la racine (pas sous /restobook/).
  function imgSrc(url) {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return url.startsWith('/') ? url : '/' + url;
  }

  async function upload(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
      onError?.('Format non supporté (JPEG, PNG, WebP, GIF)');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await fetch(API(`/restaurant/upload/${type}`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        onError?.(d.error || `Erreur ${r.status}`);
      } else {
        setPreview(d.url);
        onUploaded(type, d.url);
      }
    } catch (err) {
      onError?.(err.message || 'Erreur réseau');
    } finally {
      setUploading(false);
    }
  }

  const isCover = type === 'cover';
  const W = isCover ? 280 : 120;
  const H = isCover ? 130 : 120;

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files[0]); }}
      onClick={() => inputRef.current?.click()}
      style={{ width: W, height: H, borderRadius: isCover ? 14 : '50%', border: `2px dashed ${dragging ? '#FF8A00' : '#D1D5DB'}`, background: dragging ? '#FFF7ED' : '#F9FAFB', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', transition: 'all .2s', flexShrink: 0 }}
    >
      {preview ? (
        <img src={imgSrc(preview)} alt={type} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
      ) : (
        <>
          <span style={{ fontSize: 28, marginBottom: 6 }}>{isCover ? '🖼️' : '🏪'}</span>
          <span style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', padding: '0 8px' }}>{isCover ? 'Photo de couverture' : 'Logo / miniature'}</span>
        </>
      )}
      {uploading && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.7)', display: 'grid', placeItems: 'center' }}>
          <div style={{ width: 28, height: 28, border: '3px solid #FF8A00', borderTopColor: 'transparent', borderRadius: '50%', animation: 'rcp-spin .7s linear infinite' }} />
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={e => upload(e.target.files[0])} />
    </div>
  );
}

// ── Composant carte Leaflet pour localisation ────────────────────────────────
function LocationMap({ lat, lng, onMove }) {
  const ref    = useRef(null);
  const mapRef = useRef(null);
  const mkRef  = useRef(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const center = (lat && lng) ? [lat, lng] : [33.5731, -7.5898];
    const map = L.map(ref.current, { center, zoom: lat ? 14 : 6 });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CARTO © OpenStreetMap', maxZoom: 19
    }).addTo(map);

    if (lat && lng) {
      const icon = L.divIcon({ className:'', html:`<div style="background:#FF8A00;color:#fff;font-size:18px;width:38px;height:38px;border-radius:50% 50% 50% 4px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.3);transform:rotate(-45deg);border:2.5px solid #fff"><span style="transform:rotate(45deg)">🏪</span></div>`, iconSize:[38,38], iconAnchor:[19,38] });
      mkRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
      mkRef.current.on('dragend', e => {
        const p = e.target.getLatLng();
        onMove(p.lat, p.lng);
      });
    }

    map.on('click', e => {
      const { lat: clat, lng: clng } = e.latlng;
      onMove(clat, clng);
      if (mkRef.current) { mkRef.current.setLatLng([clat, clng]); }
      else {
        const icon = L.divIcon({ className:'', html:`<div style="background:#FF8A00;color:#fff;font-size:18px;width:38px;height:38px;border-radius:50% 50% 50% 4px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.3);transform:rotate(-45deg);border:2.5px solid #fff"><span style="transform:rotate(45deg)">🏪</span></div>`, iconSize:[38,38], iconAnchor:[19,38] });
        mkRef.current = L.marker([clat, clng], { icon, draggable: true }).addTo(map);
        mkRef.current.on('dragend', ev => {
          const p = ev.target.getLatLng();
          onMove(p.lat, p.lng);
        });
      }
    });

    mapRef.current = map;
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; mkRef.current = null; } };
  }, []);

  // Met à jour le marqueur si lat/lng change depuis l'extérieur (GPS ou saisie manuelle)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !lat || !lng) return;
    map.setView([lat, lng], 15, { animate: true });
    if (mkRef.current) { mkRef.current.setLatLng([lat, lng]); }
    else {
      const icon = L.divIcon({ className:'', html:`<div style="background:#FF8A00;color:#fff;font-size:18px;width:38px;height:38px;border-radius:50% 50% 50% 4px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.3);transform:rotate(-45deg);border:2.5px solid #fff"><span style="transform:rotate(45deg)">🏪</span></div>`, iconSize:[38,38], iconAnchor:[19,38] });
      mkRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
      mkRef.current.on('dragend', e => { const p = e.target.getLatLng(); onMove(p.lat, p.lng); });
    }
  }, [lat, lng]);

  return (
    <div ref={ref} style={{ width:'100%', height:300, borderRadius:14, border:'1.5px solid #E5E7EB', overflow:'hidden' }} />
  );
}

// ── Horaires ouverture ────────────────────────────────────────────────────────
const DAYS_OPENING = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAYS_OPENING_FR = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

function HoursEditor({ value, onChange }) {
  const hours = value || {};
  function setDay(day, field, val) {
    onChange({ ...hours, [day]: { ...hours[day], [field]: val } });
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {DAYS_OPENING.map((day, i) => {
        const h = hours[day] || {};
        return (
          <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ width: 70, fontSize: 12, fontWeight: 600, color: '#374151' }}>{DAYS_OPENING_FR[i]}</div>
            <ToggleSwitch checked={!h.closed} onChange={v => setDay(day, 'closed', !v)} label="" />
            {!h.closed && (
              <>
                <input type="time" value={h.open || '09:00'} onChange={e => setDay(day, 'open', e.target.value)} style={{ ...inp, width: 100 }} />
                <span style={{ color: '#9CA3AF', fontSize: 12 }}>→</span>
                <input type="time" value={h.close || '22:00'} onChange={e => setDay(day, 'close', e.target.value)} style={{ ...inp, width: 100 }} />
              </>
            )}
            {h.closed && <span style={{ fontSize: 12, color: '#9CA3AF' }}>Fermé</span>}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function RestaurantConfigPage() {
  const { get, patch, post, del, token } = useApi();

  const [tab, setTab]       = useState('profil');
  const [msg, setMsg]       = useState('');
  const [kind, setKind]     = useState('success');
  const [saving, setSaving] = useState(false);

  // ── Profil ──────────────────────────────────────────────────────────────
  const [org, setOrg]       = useState(null);

  // ── Menu du jour ─────────────────────────────────────────────────────────
  const [weekStart, setWeekStart] = useState(getMondayOfWeek());
  const [menus, setMenus]         = useState([]);
  const [allItems, setAllItems]   = useState([]);
  const [editingDay, setEditingDay] = useState(null); // date ISO en cours d'édition
  const [menuForm, setMenuForm]   = useState({ title: '', price: '', description: '' });
  const [menuSearch, setMenuSearch] = useState('');

  // Charger profil
  useEffect(() => {
    get('/restaurant/profile').then(d => setOrg(d.restaurant || null)).catch(() => {});
  }, []);

  // Charger menu du jour (semaine)
  useEffect(() => {
    if (tab !== 'menu') return;
    loadWeek();
    get('/items?limit=200').then(d => setAllItems(d.items || [])).catch(() => {});
  }, [tab, weekStart]);

  async function loadWeek() {
    try {
      const d = await get(`/restaurant/daily-menu?week=${weekStart}`);
      setMenus(d.menus || []);
    } catch {}
  }

  // ── Géolocalisation & Nominatim ──────────────────────────────────────────
  const [geoLoading, setGeoLoading] = useState(false);
  const [addrSearch, setAddrSearch] = useState('');
  const [addrResults, setAddrResults] = useState([]);
  const [addrLoading, setAddrLoading] = useState(false);
  const addrDebRef = useRef(null);

  function detectGPS() {
    if (!navigator.geolocation) { setMsg('Géolocalisation non supportée par ce navigateur'); setKind('error'); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setOrg(prev => ({ ...prev, latitude: lat.toFixed(7), longitude: lng.toFixed(7), location_verified: true }));
        try {
          const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`);
          const data = await res.json();
          const a = data.address || {};
          setOrg(prev => ({
            ...prev,
            city:     prev.city     || a.city || a.town || a.village || '',
            zone:     prev.zone     || a.suburb || a.neighbourhood || '',
            district: prev.district || a.district || a.county || '',
            postal_code: prev.postal_code || a.postcode || '',
            country:  prev.country  || a.country || 'Maroc',
            address:  prev.address  || data.display_name || '',
          }));
        } catch {}
        setGeoLoading(false);
      },
      err => { setMsg(`GPS refusé: ${err.message}`); setKind('error'); setGeoLoading(false); },
      { timeout: 10000, maximumAge: 60000 }
    );
  }

  async function searchAddress(q) {
    if (!q || q.length < 3) { setAddrResults([]); return; }
    setAddrLoading(true);
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&accept-language=fr`);
      const data = await res.json();
      setAddrResults(data);
    } catch {}
    setAddrLoading(false);
  }

  function pickAddress(item) {
    const a = item.address || {};
    setOrg(prev => ({
      ...prev,
      latitude:    parseFloat(item.lat).toFixed(7),
      longitude:   parseFloat(item.lon).toFixed(7),
      address:     item.display_name || prev.address,
      city:        a.city || a.town || a.village || prev.city || '',
      zone:        a.suburb || a.neighbourhood || prev.zone || '',
      district:    a.district || a.county || prev.district || '',
      postal_code: a.postcode || prev.postal_code || '',
      country:     a.country || prev.country || 'Maroc',
      location_verified: true,
    }));
    setAddrSearch(item.display_name);
    setAddrResults([]);
  }

  // ── Profil handlers ──────────────────────────────────────────────────────
  function setField(f, v) { setOrg(prev => ({ ...prev, [f]: v })); }

  function onUploaded(type, url) {
    setOrg(prev => ({
      ...prev,
      cover_url: type === 'cover' ? url : prev.cover_url,
      logo_url:  type === 'logo'  ? url : prev.logo_url,
    }));
  }

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const lat = org.latitude  ? parseFloat(org.latitude)  : null;
      const lng = org.longitude ? parseFloat(org.longitude) : null;
      if (lat !== null && (lat < -90 || lat > 90))   { setMsg('Latitude invalide (entre -90 et 90)'); setKind('error'); setSaving(false); return; }
      if (lng !== null && (lng < -180 || lng > 180)) { setMsg('Longitude invalide (entre -180 et 180)'); setKind('error'); setSaving(false); return; }

      await patch('/restaurant/profile', {
        name: org.name, description: org.description, phone: org.phone, email: org.email,
        address: org.address, city: org.city, zone: org.zone,
        district: org.district || null,
        postal_code: org.postal_code || null,
        country: org.country || 'Maroc',
        cuisine_type: org.cuisine_type,
        delivery_fee: Number(org.delivery_fee || 0), min_order_amount: Number(org.min_order_amount || 0),
        avg_prep_time: Number(org.avg_prep_time || 20),
        accepts_delivery: !!org.accepts_delivery, accepts_takeaway: !!org.accepts_takeaway,
        accepts_dine_in: !!org.accepts_dine_in,
        accepts_reservation: !!org.accepts_reservation,
        accepts_qr_table: !!org.accepts_qr_table,
        opening_hours: org.opening_hours || {},
        latitude:  lat,
        longitude: lng,
        location_verified: !!org.location_verified,
      });
      setMsg('Profil mis à jour ✓'); setKind('success');
    } catch (err) { setMsg(err.message); setKind('error'); }
    setSaving(false);
  }

  // ── Menu du jour handlers ────────────────────────────────────────────────
  const dates = weekDates(weekStart);

  function getMenuForDate(date) { return menus.find(m => m.date_jour === date) || null; }

  function prevWeek() {
    const d = new Date(weekStart); d.setDate(d.getDate() - 7);
    setWeekStart(d.toISOString().slice(0, 10));
  }
  function nextWeek() {
    const d = new Date(weekStart); d.setDate(d.getDate() + 7);
    setWeekStart(d.toISOString().slice(0, 10));
  }

  async function createOrSelectDay(date) {
    const existing = getMenuForDate(date);
    if (existing) {
      setMenuForm({ title: existing.title || '', price: existing.price || '', description: existing.description || '' });
    } else {
      setMenuForm({ title: '', price: '', description: '' });
    }
    setEditingDay(date);
    setMenuSearch('');
  }

  async function saveMenuDay() {
    try {
      await post('/restaurant/daily-menu', { date_jour: editingDay, title: menuForm.title || undefined, price: menuForm.price ? Number(menuForm.price) : undefined, description: menuForm.description || undefined });
      await loadWeek();
      setMsg('Menu enregistré ✓'); setKind('success');
    } catch (err) { setMsg(err.message); setKind('error'); }
  }

  async function deleteMenu(id) {
    try { await del(`/restaurant/daily-menu/${id}`); await loadWeek(); } catch {}
  }

  async function addItemToMenu(date, menuItemId) {
    let menu = getMenuForDate(date);
    if (!menu) {
      // Créer le menu si inexistant
      const d = await post('/restaurant/daily-menu', { date_jour: date });
      menu = d.menu;
    }
    try {
      await post(`/restaurant/daily-menu/${menu.id}/items`, { menu_item_id: menuItemId });
      await loadWeek();
    } catch (err) { setMsg(err.message); setKind('error'); }
  }

  async function removeItemFromMenu(menuId, dmiId) {
    try { await del(`/restaurant/daily-menu/${menuId}/items/${dmiId}`); await loadWeek(); } catch {}
  }

  const filteredItems = allItems.filter(i =>
    !menuSearch || i.libelle?.toLowerCase().includes(menuSearch.toLowerCase())
  );

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #F3F4F6', paddingBottom: 0 }}>
        {[
          { key: 'profil',    icon: '🏪', label: 'Profil & Images' },
          { key: 'location',  icon: '📍', label: 'Localisation' },
          { key: 'menu',      icon: '📅', label: 'Menu du jour' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '10px 18px', border: 'none', borderBottom: `3px solid ${tab === t.key ? 'var(--rb-orange,#FF8A00)' : 'transparent'}`, background: 'none', fontWeight: tab === t.key ? 800 : 500, fontSize: 14, color: tab === t.key ? 'var(--rb-orange,#FF8A00)' : '#6B7280', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════ ONGLET PROFIL ══════════════════════════════════════ */}
      {tab === 'profil' && org && (
        <form onSubmit={saveProfile}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>

            {/* Images */}
            <div className="card p-4">
              <h6 style={{ fontWeight: 800, marginBottom: 16 }}>📸 Images</h6>
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <Label>Photo de couverture</Label>
                  <ImageUploadCard type="cover" currentUrl={org.cover_url} token={token} onUploaded={onUploaded} onError={e => { setMsg(e); setKind('error'); }} />
                  <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6, maxWidth: 280 }}>Bannière affichée en haut de la page restaurant (1200×400 recommandé)</p>
                </div>
                <div>
                  <Label>Logo / miniature</Label>
                  <ImageUploadCard type="logo" currentUrl={org.logo_url} token={token} onUploaded={onUploaded} onError={e => { setMsg(e); setKind('error'); }} />
                  <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6, maxWidth: 120 }}>Logo affiché dans les listes (carré, 300×300 min)</p>
                </div>
              </div>
            </div>

            {/* Infos générales */}
            <div className="card p-4">
              <h6 style={{ fontWeight: 800, marginBottom: 16 }}>🏪 Informations générales</h6>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div><Label req>Nom du restaurant</Label><input style={inp} value={org.name || ''} onChange={e => setField('name', e.target.value)} required /></div>
                <div><Label>Type de cuisine</Label><input style={inp} value={org.cuisine_type || ''} onChange={e => setField('cuisine_type', e.target.value)} placeholder="Marocain, Méditerranéen, Fast-food…" /></div>
                <div><Label>Description</Label><textarea style={{ ...inp, resize: 'vertical' }} rows={4} value={org.description || ''} onChange={e => setField('description', e.target.value)} placeholder="Décrivez votre restaurant, votre ambiance…" /></div>
              </div>
            </div>

            {/* Contact */}
            <div className="card p-4">
              <h6 style={{ fontWeight: 800, marginBottom: 16 }}>📞 Contact & Adresse</h6>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><Label>Téléphone</Label><input style={inp} value={org.phone || ''} onChange={e => setField('phone', e.target.value)} placeholder="+212 6 …" /></div>
                  <div><Label>Email</Label><input type="email" style={inp} value={org.email || ''} onChange={e => setField('email', e.target.value)} /></div>
                </div>
                <div><Label>Adresse</Label><input style={inp} value={org.address || ''} onChange={e => setField('address', e.target.value)} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><Label>Ville</Label><input style={inp} value={org.city || ''} onChange={e => setField('city', e.target.value)} /></div>
                  <div><Label>Zone / Quartier</Label><input style={inp} value={org.zone || ''} onChange={e => setField('zone', e.target.value)} /></div>
                </div>
              </div>
            </div>

            {/* Services & livraison */}
            <div className="card p-4">
              <h6 style={{ fontWeight: 800, marginBottom: 16 }}>🛵 Services proposés</h6>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <ToggleSwitch checked={!!org.accepts_delivery} onChange={v => setField('accepts_delivery', v)} label="Livraison à domicile" />
                <ToggleSwitch checked={!!org.accepts_takeaway} onChange={v => setField('accepts_takeaway', v)} label="À emporter / Click & Collect" />
                <ToggleSwitch checked={!!org.accepts_dine_in}  onChange={v => setField('accepts_dine_in', v)}  label="Sur place / Réservation de table" />
                {org.accepts_delivery && (
                  <div style={{ background: '#F9FAFB', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div><Label>Frais de livraison (MAD)</Label><input type="number" min="0" step="0.5" style={inp} value={org.delivery_fee || ''} onChange={e => setField('delivery_fee', e.target.value)} /></div>
                      <div><Label>Commande min. (MAD)</Label><input type="number" min="0" step="1" style={inp} value={org.min_order_amount || ''} onChange={e => setField('min_order_amount', e.target.value)} /></div>
                    </div>
                  </div>
                )}
                <div><Label>Temps de préparation moyen (min)</Label><input type="number" min="5" max="180" style={inp} value={org.avg_prep_time || ''} onChange={e => setField('avg_prep_time', e.target.value)} /></div>
              </div>
            </div>

            {/* Services */}
            <div className="card p-4">
              <h6 style={{ fontWeight: 800, marginBottom: 16 }}>✅ Services additionnels</h6>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <ToggleSwitch checked={!!org.accepts_reservation} onChange={v => setField('accepts_reservation', v)} label="Réservation de table en ligne" />
                <ToggleSwitch checked={!!org.accepts_qr_table}    onChange={v => setField('accepts_qr_table', v)}    label="Commande QR table (scan & order)" />
              </div>
            </div>

            {/* Horaires */}
            <div className="card p-4" style={{ gridColumn: '1 / -1' }}>
              <h6 style={{ fontWeight: 800, marginBottom: 16 }}>🕐 Horaires d'ouverture</h6>
              <HoursEditor value={org.opening_hours} onChange={v => setField('opening_hours', v)} />
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" disabled={saving} style={{ padding: '12px 32px', background: saving ? '#9CA3AF' : 'var(--rb-orange,#FF8A00)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: saving ? 'default' : 'pointer', boxShadow: '0 4px 16px rgba(255,138,0,.3)' }}>
              {saving ? 'Enregistrement…' : '✓ Enregistrer le profil'}
            </button>
          </div>
        </form>
      )}

      {/* ══════════════════════════════════════ ONGLET LOCALISATION ══════════════════════════════ */}
      {tab === 'location' && org && (
        <form onSubmit={saveProfile}>
          {/* Statut localisation */}
          <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 14, background: org.latitude && org.longitude ? 'linear-gradient(135deg,#F0FDF4,#DCFCE7)' : 'linear-gradient(135deg,#FFF7ED,#FFEDD5)', border: `1.5px solid ${org.latitude && org.longitude ? '#86EFAC' : '#FED7AA'}`, display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 28 }}>{org.latitude && org.longitude ? '✅' : '⚠️'}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: org.latitude && org.longitude ? '#166534' : '#92400E' }}>
                {org.latitude && org.longitude ? 'Localisation configurée' : 'Localisation manquante'}
              </div>
              <div style={{ fontSize: 12, color: org.latitude && org.longitude ? '#15803D' : '#B45309' }}>
                {org.latitude && org.longitude
                  ? `${parseFloat(org.latitude).toFixed(5)}, ${parseFloat(org.longitude).toFixed(5)} · ${org.location_verified ? 'Vérifiée' : 'Non vérifiée'}`
                  : 'Votre établissement ne sera pas visible dans la marketplace sans coordonnées GPS'}
              </div>
            </div>
            {org.latitude && org.longitude && org.location_verified && (
              <span style={{ marginLeft: 'auto', background: '#BBF7D0', color: '#166534', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>✓ Vérifiée</span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
            {/* Adresse complète */}
            <div className="card p-4">
              <h6 style={{ fontWeight: 800, marginBottom: 16 }}>🏠 Adresse complète</h6>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <Label req>Adresse</Label>
                  <input style={inp} value={org.address || ''} onChange={e => setField('address', e.target.value)} placeholder="N° rue, nom de rue…" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><Label req>Ville</Label><input style={inp} value={org.city || ''} onChange={e => setField('city', e.target.value)} placeholder="Casablanca" /></div>
                  <div><Label>Quartier / Zone</Label><input style={inp} value={org.zone || ''} onChange={e => setField('zone', e.target.value)} placeholder="Maarif" /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><Label>District / Arrondissement</Label><input style={inp} value={org.district || ''} onChange={e => setField('district', e.target.value)} placeholder="Aïn Chock" /></div>
                  <div><Label>Code postal</Label><input style={inp} value={org.postal_code || ''} onChange={e => setField('postal_code', e.target.value)} placeholder="20000" /></div>
                </div>
                <div><Label>Pays</Label><input style={inp} value={org.country || 'Maroc'} onChange={e => setField('country', e.target.value)} /></div>
              </div>
            </div>

            {/* GPS */}
            <div className="card p-4">
              <h6 style={{ fontWeight: 800, marginBottom: 16 }}>🗺️ Coordonnées GPS</h6>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Recherche adresse Nominatim */}
                <div style={{ position: 'relative' }}>
                  <Label>Recherche d'adresse</Label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      style={{ ...inp, flex: 1 }}
                      value={addrSearch}
                      onChange={e => {
                        setAddrSearch(e.target.value);
                        clearTimeout(addrDebRef.current);
                        addrDebRef.current = setTimeout(() => searchAddress(e.target.value), 500);
                      }}
                      placeholder="Saisir une adresse pour géocoder…"
                    />
                    {addrLoading && <span style={{ display: 'flex', alignItems: 'center', fontSize: 18 }}>⏳</span>}
                  </div>
                  {addrResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 10, zIndex: 50, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.1)' }}>
                      {addrResults.map((item, i) => (
                        <button key={i} type="button" onClick={() => pickAddress(item)} style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 12, color: '#374151', borderBottom: '1px solid #F3F4F6', fontFamily: 'inherit' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                          📍 {item.display_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bouton GPS */}
                <button type="button" onClick={detectGPS} disabled={geoLoading} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 12, border: 'none', background: geoLoading ? '#F1F5F9' : 'linear-gradient(135deg,#3B82F6,#2563EB)', color: geoLoading ? '#94A3B8' : '#fff', cursor: geoLoading ? 'default' : 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit', width: '100%', justifyContent: 'center', transition: 'all .15s', boxShadow: geoLoading ? 'none' : '0 4px 14px rgba(59,130,246,.35)' }}>
                  {geoLoading
                    ? <><span style={{ width: 16, height: 16, border: '2px solid #CBD5E1', borderTopColor: '#64748B', borderRadius: '50%', animation: 'rcp-spin .7s linear infinite', display: 'inline-block' }} /> Localisation en cours…</>
                    : <>📍 Utiliser ma position actuelle</>}
                </button>

                {/* Lat / Lng manuels */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <Label>Latitude</Label>
                    <input style={inp} type="number" step="0.0000001" min="-90" max="90" value={org.latitude || ''} onChange={e => setField('latitude', e.target.value)} placeholder="33.5731" />
                  </div>
                  <div>
                    <Label>Longitude</Label>
                    <input style={inp} type="number" step="0.0000001" min="-180" max="180" value={org.longitude || ''} onChange={e => setField('longitude', e.target.value)} placeholder="-7.5898" />
                  </div>
                </div>

                {org.latitude && org.longitude && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!org.location_verified} onChange={e => setField('location_verified', e.target.checked)} style={{ accentColor: '#FF8A00', width: 16, height: 16 }} />
                    <span style={{ fontSize: 13, color: '#374151' }}>Marquer la localisation comme vérifiée</span>
                  </label>
                )}
              </div>
            </div>

            {/* Carte Leaflet pleine largeur */}
            <div className="card p-4" style={{ gridColumn: '1 / -1' }}>
              <h6 style={{ fontWeight: 800, marginBottom: 8 }}>🗺️ Position sur la carte</h6>
              <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 14 }}>Cliquez sur la carte ou faites glisser le marqueur pour ajuster la position. Utilisez "Utiliser ma position" pour un positionnement automatique.</p>
              <LocationMap
                lat={org.latitude ? parseFloat(org.latitude) : null}
                lng={org.longitude ? parseFloat(org.longitude) : null}
                onMove={(lat, lng) => setOrg(prev => ({ ...prev, latitude: lat.toFixed(7), longitude: lng.toFixed(7), location_verified: true }))}
              />
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" disabled={saving} style={{ padding: '12px 32px', background: saving ? '#9CA3AF' : 'var(--rb-orange,#FF8A00)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: saving ? 'default' : 'pointer', boxShadow: '0 4px 16px rgba(255,138,0,.3)' }}>
              {saving ? 'Enregistrement…' : '✓ Enregistrer la localisation'}
            </button>
          </div>
        </form>
      )}

      {/* ══════════════════════════════════════ ONGLET MENU DU JOUR ═══════════════════════════════ */}
      {tab === 'menu' && (
        <div>
          {/* Navigation semaine */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button onClick={prevWeek} style={{ padding: '8px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 16, fontFamily: 'inherit' }}>‹</button>
            <div style={{ fontWeight: 800, fontSize: 15, flex: 1, textAlign: 'center' }}>
              Semaine du {fmtDate(weekStart)} au {fmtDate(dates[6])}
            </div>
            <button onClick={nextWeek} style={{ padding: '8px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 16, fontFamily: 'inherit' }}>›</button>
          </div>

          {/* Grille des 7 jours */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginBottom: 24 }}>
            {dates.map((date, i) => {
              const menu = getMenuForDate(date);
              const isToday = date === new Date().toISOString().slice(0, 10);
              const isEditing = editingDay === date;

              return (
                <div key={date} style={{ background: '#fff', borderRadius: 16, border: `2px solid ${isEditing ? 'var(--rb-orange,#FF8A00)' : isToday ? '#FED7AA' : '#E5E7EB'}`, overflow: 'hidden' }}>
                  {/* En-tête du jour */}
                  <div style={{ background: isToday ? 'linear-gradient(135deg,#FF8A00,#FF5D00)' : '#F9FAFB', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: isToday ? '#fff' : '#374151' }}>{DAYS_FR[i]}</div>
                      <div style={{ fontSize: 11, color: isToday ? 'rgba(255,255,255,.8)' : '#9CA3AF' }}>{fmtDate(date)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {menu && (
                        <button onClick={() => deleteMenu(menu.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: isToday ? 'rgba(255,255,255,.7)' : '#EF4444', fontFamily: 'inherit' }} title="Supprimer">🗑</button>
                      )}
                      <button onClick={() => isEditing ? setEditingDay(null) : createOrSelectDay(date)} style={{ padding: '4px 10px', borderRadius: 8, border: `1.5px solid ${isToday ? 'rgba(255,255,255,.5)' : '#E5E7EB'}`, background: isEditing ? 'var(--rb-orange,#FF8A00)' : isToday ? 'rgba(255,255,255,.15)' : '#fff', color: isEditing ? '#fff' : isToday ? '#fff' : '#374151', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {isEditing ? '✓ OK' : menu ? '✏️ Éditer' : '+ Ajouter'}
                      </button>
                    </div>
                  </div>

                  {/* Formulaire édition */}
                  {isEditing && (
                    <div style={{ padding: '12px 14px', background: '#FFF7ED', borderBottom: '1px solid #FED7AA' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <input style={{ ...inp, fontSize: 13 }} placeholder="Titre du menu (ex: Menu Midi)" value={menuForm.title} onChange={e => setMenuForm(f => ({ ...f, title: e.target.value }))} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input type="number" min="0" step="0.5" style={{ ...inp, fontSize: 13, flex: 1 }} placeholder="Prix menu (MAD)" value={menuForm.price} onChange={e => setMenuForm(f => ({ ...f, price: e.target.value }))} />
                          <button type="button" onClick={saveMenuDay} style={{ padding: '8px 14px', background: 'var(--rb-orange,#FF8A00)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>Sauver</button>
                        </div>
                        <textarea style={{ ...inp, fontSize: 12, resize: 'none' }} rows={2} placeholder="Description (optionnel)" value={menuForm.description} onChange={e => setMenuForm(f => ({ ...f, description: e.target.value }))} />
                      </div>

                      {/* Ajout de plats */}
                      <div style={{ marginTop: 10 }}>
                        <input style={{ ...inp, fontSize: 12 }} placeholder="🔍 Rechercher un plat à ajouter…" value={menuSearch} onChange={e => setMenuSearch(e.target.value)} />
                        <div style={{ maxHeight: 160, overflowY: 'auto', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {filteredItems.filter(fi => !menu || !menu.items?.some(mi => mi.menu_item_id === fi.id)).slice(0, 20).map(item => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 10px', background: '#fff', borderRadius: 8, fontSize: 12 }}>
                              <span>{item.libelle} <span style={{ color: '#9CA3AF' }}>— {Number(item.prix || 0).toFixed(2)} MAD</span></span>
                              <button onClick={() => addItemToMenu(date, item.id)} style={{ padding: '3px 10px', background: 'var(--rb-orange,#FF8A00)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>+</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Contenu du menu */}
                  <div style={{ padding: '10px 14px' }}>
                    {menu ? (
                      <>
                        {menu.title && <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 4 }}>{menu.title}</div>}
                        {menu.price && <div style={{ fontSize: 13, color: 'var(--rb-orange,#FF8A00)', fontWeight: 800, marginBottom: 6 }}>{Number(menu.price).toFixed(2)} MAD</div>}
                        {(menu.items || []).length === 0
                          ? <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Aucun plat — cliquez Éditer pour en ajouter</p>
                          : (menu.items || []).map(dmi => (
                            <div key={dmi.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #F3F4F6', fontSize: 12 }}>
                              <span>{dmi.menu_item?.libelle || '—'}</span>
                              <button onClick={() => removeItemFromMenu(menu.id, dmi.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 14, lineHeight: 1, fontFamily: 'inherit' }}>×</button>
                            </div>
                          ))
                        }
                      </>
                    ) : (
                      <p style={{ fontSize: 12, color: '#D1D5DB', margin: 0, textAlign: 'center', padding: '10px 0' }}>Pas de menu ce jour</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`@keyframes rcp-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
