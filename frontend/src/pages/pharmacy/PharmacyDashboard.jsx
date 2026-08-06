import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API, ASSET } from '../../api';
import { HoursEditor } from '../../shared/components/ui/HoursEditor';
import { GeocodingPicker } from '../../shared/components/geo/GeocodingPicker';
import PharmacyCreditModule from './PharmacyCreditModule';
import { BarcodeInput } from '../../shared/components/ui/BarcodeInput';
import { ProductImageCapture } from '../../shared/components/ui/ProductImageCapture';
import { CatalogQuickAddModal } from '../../shared/components/catalog/CatalogQuickAddModal';
import { StoreHeroManagerTab } from '../../shared/components/storeHero/StoreHeroManagerTab';
import { useI18n } from '../../i18n/config';
import { translateOrderStatus, translatePharmacyPrescriptionStatus, translatePharmacyPurchaseOrderStatus } from '../../i18n/status';
import { DashboardIcon } from '../../shared/components/ui/DashboardIcon';
import { PremiumIcon, PremiumIconBadge } from '../../shared/components/ui/PremiumIcon';

/* ══ CONSTANTES ═══════════════════════════════════════════════════════════ */
const TABS = [
  { id:'dashboard',     labelKey:'business.pharmacy.tabs.dashboard', icon:'📊' },
  { id:'pos',           labelKey:'business.pharmacy.tabs.pos', icon:'🧾' },
  { id:'orders',        labelKey:'business.pharmacy.tabs.orders', icon:'🛒' },
  { id:'products',      labelKey:'business.pharmacy.tabs.products', icon:'💉' },
  { id:'lots',          labelKey:'business.pharmacy.tabs.lots', icon:'📦' },
  { id:'prescriptions', labelKey:'business.pharmacy.tabs.prescriptions', icon:'📋' },
  { id:'customers',     labelKey:'business.pharmacy.tabs.customers', icon:'👥' },
  { id:'credit',        labelKey:'business.pharmacy.tabs.credit', icon:'💳' },
  { id:'suppliers',     labelKey:'business.pharmacy.tabs.suppliers', icon:'🚚' },
  { id:'purchases',     labelKey:'business.pharmacy.tabs.purchases', icon:'📥' },
  { id:'requests',      labelKey:'business.pharmacy.tabs.requests', icon:'📨' },
  { id:'reports',       labelKey:'business.pharmacy.tabs.reports', icon:'📑' },
  { id:'profile',       labelKey:'business.pharmacy.tabs.profile', icon:'⚙️' },
  { id:'hero',          labelKey:'business.pharmacy.tabs.hero', icon:'🎠' },
];
const FORM_CODES = ['comprime', 'sirop', 'pommade', 'injectable', 'gouttes', 'autre'];
const METHOD_LABELS = { cash:'Espèces', card:'Carte', transfer:'Virement', mobile_money:'Mobile Money' };
const PO_STATUS = { draft:{c:'#9CA3AF'}, sent:{c:'#3B82F6'}, partially_received:{c:'#F59E0B'}, received:{c:'#10B981'}, cancelled:{c:'#EF4444'} };
const RX_STATUS = { received:{c:'#3B82F6'}, preparing:{c:'#F59E0B'}, served:{c:'#10B981'}, cancelled:{c:'#EF4444'} };
// Statuts des commandes clients en ligne (PharmacyOrder) — identiques à ceux
// du moteur hanout (HanoutOrder.status partage le même ENUM, voir backend
// models/pharmacyOrder.js).
const ORDER_STATUSES = [
  { v:'pending',    c:'#F59E0B' },
  { v:'confirmed',  c:'#3B82F6' },
  { v:'preparing',  c:'#8B5CF6' },
  { v:'ready',      c:'#10B981' },
  { v:'picked_up',  c:'#22C55E' },
  { v:'on_the_way', c:'#0EA5E9' },
  { v:'delivered',  c:'#22C55E' },
  { v:'cancelled',  c:'#EF4444' },
];
const orderStatusOf = v => ORDER_STATUSES.find(s => s.v === v) || { c:'#9CA3AF' };
function OrderBadge({ status }) {
  const { t } = useI18n();
  const s = orderStatusOf(status);
  return <span style={{ fontSize:11, fontWeight:700, color:s.c, background:`${s.c}20`, padding:'3px 10px', borderRadius:20, whiteSpace:'nowrap' }}>● {translateOrderStatus(t, status)}</span>;
}
// Colonnes kanban — mêmes 4 statuts "en cours" que la vue kanban resto
// (frontend/src/pages/OrdersPage.jsx KANBAN_COLS), palette sky-blue pharmacie.
const PHARMACY_KANBAN_COLS = [
  { key:'pending',   label:'En attente',    color:'#6B7280', bg:'#F8FAFC', dot:'#94A3B8' },
  { key:'confirmed', label:'Confirmée',     color:'#2563EB', bg:'#EFF6FF', dot:'#3B82F6' },
  { key:'preparing', label:'En préparation',color:'#0EA5E9', bg:'#F0F9FF', dot:'#0EA5E9' },
  { key:'ready',     label:'Prête ✓',       color:'#16A34A', bg:'#F0FDF4', dot:'#22C55E' },
];
// Progression à un seul bouton "prochaine étape" — même logique que
// getNextAction() côté resto (OrdersPage.jsx), adaptée au vocabulaire
// pharmacie (delivery_type au lieu de type/order_source).
function getPharmacyNextAction(order) {
  const s = order.status;
  if (s === 'pending')   return { next:'confirmed', label:'Confirmer' };
  if (s === 'confirmed') return { next:'preparing',  label:'Préparer' };
  if (s === 'preparing') return { next:'ready',      label:'Prête ✓' };
  if (s === 'ready') {
    if (order.delivery_type === 'delivery') return { next:'on_the_way', label:'Partir' };
    return { next:'picked_up', label:'Récupérée' };
  }
  if (s === 'on_the_way') return { next:'delivered', label:'✓ Livrée' };
  return null;
}

function fmt(n) { return Number(n||0).toLocaleString('fr-FR', { minimumFractionDigits:2, maximumFractionDigits:2 }); }
function fmtDate(d) { return d ? new Date(d + (String(d).length===10?'T00:00:00':'')).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '—'; }

function authFetch(path, opts = {}) {
  const token = localStorage.getItem('rb_token');
  return fetch(API(path), {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
  }).then(async r => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(data.error || data.message || `Erreur ${r.status}`); e.payload = data; throw e; }
    return data;
  });
}

/* ══ COMPOSANTS UTILITAIRES ═══════════════════════════════════════════════ */
function KpiCard({ icon, label, value, sub, color = '#0EA5E9' }) {
  return (
    <div style={{ background:'#fff', borderRadius:14, padding:'18px 20px', border:'1px solid #E5E7EB', display:'flex', alignItems:'center', gap:14 }}>
      <div style={{ width:46, height:46, borderRadius:12, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><DashboardIcon icon={icon} size={22} /></div>
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:20, fontWeight:800, color:'#0F172A', whiteSpace:'nowrap' }}>{value}</div>
        <div style={{ fontSize:12, fontWeight:600, color:'#64748B' }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:'#94A3B8' }}>{sub}</div>}
      </div>
    </div>
  );
}
function Field({ label, children, required }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'.04em', display:'block', marginBottom:5 }}>{label}{required && <span style={{ color:'#EF4444', marginLeft:3 }}>*</span>}</label>
      {children}
    </div>
  );
}
const inputStyle = { width:'100%', padding:'10px 12px', border:'1.5px solid #E2E8F0', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box', fontFamily:'inherit' };
function Modal({ open, title, onClose, children, width=520 }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.5)', zIndex:800, backdropFilter:'blur(4px)' }} />
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:801, background:'#fff', borderRadius:18, padding:'24px 26px', width:Math.min(width, window.innerWidth-32), maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,.25)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:'#0F172A' }}>{title}</h3>
          <button onClick={onClose} style={{ background:'#F1F5F9', border:'none', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:14, color:'#64748B' }}>✕</button>
        </div>
        {children}
      </div>
    </>
  );
}
function Toast({ msg, kind }) {
  if (!msg) return null;
  const c = kind==='error' ? '#EF4444' : '#10B981';
  return <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'#0F172A', color:'#fff', padding:'12px 20px', borderRadius:12, fontSize:13, fontWeight:600, zIndex:1000, boxShadow:'0 8px 24px rgba(0,0,0,.3)', borderLeft:`4px solid ${c}` }}>{msg}</div>;
}
function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, kind='ok') => { setToast({ msg, kind }); setTimeout(() => setToast(null), 3500); };
  return { toast, show };
}

/* ══ TABLEAU DE BORD ═══════════════════════════════════════════════════════ */
function DashboardTab() {
  const [data, setData] = useState(null);
  useEffect(() => { authFetch('/pharmacy-pro/dashboard').then(setData).catch(()=>{}); }, []);
  if (!data) return <div style={{ textAlign:'center', padding:60, color:'#94A3B8' }}>Chargement…</div>;
  const { kpis, top_medicines } = data;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14 }}>
        <KpiCard icon="💰" label="Chiffre d'affaires du jour" value={`${fmt(kpis.revenue_today)} MAD`} color="#0EA5E9" />
        <KpiCard icon="🧾" label="Ventes du jour" value={kpis.sales_today} color="#3B82F6" />
        <KpiCard icon="📈" label="CA du mois" value={`${fmt(kpis.revenue_month)} MAD`} color="#10B981" />
        <KpiCard icon="📋" label="Ordonnances servies (mois)" value={kpis.prescriptions_served_month} color="#8B5CF6" />
        <KpiCard icon="📉" label="Produits en rupture" value={kpis.low_stock_count} color="#EF4444" />
        <KpiCard icon="⏳" label="Proches péremption (90j)" value={kpis.expiring_soon_count} color="#F59E0B" />
        <KpiCard icon="📥" label="Commandes fourn. en attente" value={kpis.pending_purchase_orders} color="#6366F1" />
        <KpiCard icon="💳" label="Crédits clients impayés" value={`${fmt(kpis.unpaid_credit_total)} MAD`} color="#EC4899" />
      </div>
      <div style={{ background:'#fff', borderRadius:16, padding:20, border:'1px solid #E5E7EB' }}>
        <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:800, color:'#0F172A', display:'flex', alignItems:'center', gap:8 }}><PremiumIcon name="award" size={17} />Top médicaments vendus (mois)</h3>
        {top_medicines.length === 0 ? <div style={{ color:'#94A3B8', fontSize:13 }}>Aucune vente ce mois-ci.</div> : (
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            {top_medicines.map((m,i) => (
              <div key={m.name} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 4px', borderBottom: i<top_medicines.length-1 ? '1px solid #F1F5F9' : 'none' }}>
                <span style={{ width:22, fontSize:12, fontWeight:800, color:'#94A3B8' }}>#{i+1}</span>
                <span style={{ flex:1, fontSize:13, fontWeight:600, color:'#0F172A' }}>{m.name}</span>
                <span style={{ fontSize:13, fontWeight:800, color:'#0EA5E9' }}>{m.quantity} unités</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══ MÉDICAMENTS (catalogue) ═══════════════════════════════════════════════ */
function MedicineForm({ medicine, initialData, onSaved, onCancel }) {
  const { t } = useI18n();
  const [form, setForm] = useState(medicine || initialData || { name:'', dci:'', laboratory:'', category:'', form:'autre', dosage:'', barcode:'', purchase_price:0, sale_price:0, vat_rate:0, stock_min:5, requires_prescription:false, marketplace_visible:false, description:'', notice_url:'', image_url:'' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k,v) => setForm(p => ({ ...p, [k]:v }));

  async function uploadFile(file, field) {
    const fd = new FormData(); fd.append('image', file);
    const token = localStorage.getItem('rb_token');
    const res = await fetch(API('/pharmacy-pro/upload'), { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:fd });
    const d = await res.json();
    if (d.url) set(field, d.url);
  }

  async function uploadProductImage(file) {
    const fd = new FormData(); fd.append('image', file);
    const token = localStorage.getItem('rb_token');
    const res = await fetch(API('/pharmacy-pro/upload'), { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:fd });
    const d = await res.json();
    if (!res.ok || !d.url) throw new Error(d.error || "Échec de l'envoi de l'image");
    return d.url;
  }

  async function save() {
    if (!form.name.trim()) { setErr('Nom requis'); return; }
    setSaving(true); setErr('');
    try {
      const payload = { ...form, purchase_price:Number(form.purchase_price||0), sale_price:Number(form.sale_price||0), vat_rate:Number(form.vat_rate||0), stock_min:Number(form.stock_min||0) };
      const d = medicine ? await authFetch(`/pharmacy-pro/medicines/${medicine.id}`, { method:'PATCH', body:payload }) : await authFetch('/pharmacy-pro/medicines', { method:'POST', body:payload });
      onSaved(d.medicine);
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }

  return (
    <>
      {err && <div style={{ marginBottom:14, padding:'10px 14px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, color:'#DC2626', fontSize:13 }}>{err}</div>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="Nom commercial" required><input value={form.name} onChange={e=>set('name',e.target.value)} style={inputStyle} /></Field>
        <Field label="DCI / Générique"><input value={form.dci||''} onChange={e=>set('dci',e.target.value)} style={inputStyle} /></Field>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="Laboratoire"><input value={form.laboratory||''} onChange={e=>set('laboratory',e.target.value)} style={inputStyle} /></Field>
        <Field label="Catégorie thérapeutique"><input value={form.category||''} onChange={e=>set('category',e.target.value)} style={inputStyle} /></Field>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
        <Field label="Forme">
          <select value={form.form} onChange={e=>set('form',e.target.value)} style={inputStyle}>
            {FORM_CODES.map(v => <option key={v} value={v}>{t('pharmacy.form.' + v)}</option>)}
          </select>
        </Field>
        <Field label="Dosage"><input value={form.dosage||''} onChange={e=>set('dosage',e.target.value)} placeholder="500mg" style={inputStyle} /></Field>
        <Field label="Code-barres (OTC/parapharmacie, optionnel)">
          <div style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
            <div style={{ flex:1 }}>
              <BarcodeInput value={form.barcode||''} onChange={v=>set('barcode',v)} onDetected={v=>set('barcode',v)} style={inputStyle} />
            </div>
          </div>
        </Field>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
        <Field label="Prix d'achat (MAD)"><input type="number" min="0" step="0.01" value={form.purchase_price} onChange={e=>set('purchase_price',e.target.value)} style={inputStyle} /></Field>
        <Field label="Prix de vente (MAD)"><input type="number" min="0" step="0.01" value={form.sale_price} onChange={e=>set('sale_price',e.target.value)} style={inputStyle} /></Field>
        <Field label="TVA (%)"><input type="number" min="0" max="100" step="0.5" value={form.vat_rate} onChange={e=>set('vat_rate',e.target.value)} style={inputStyle} /></Field>
      </div>
      <Field label="Stock minimum (alerte rupture)"><input type="number" min="0" value={form.stock_min} onChange={e=>set('stock_min',e.target.value)} style={{...inputStyle,maxWidth:160}} /></Field>
      <div style={{ display:'flex', gap:16, marginBottom:14 }}>
        <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#374151', cursor:'pointer' }}>
          <input type="checkbox" checked={!!form.requires_prescription} onChange={e=>set('requires_prescription',e.target.checked)} style={{ accentColor:'#0EA5E9' }} /> Sous ordonnance
        </label>
        <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#374151', cursor:'pointer' }}>
          <input type="checkbox" checked={!!form.marketplace_visible} onChange={e=>set('marketplace_visible',e.target.checked)} style={{ accentColor:'#0EA5E9' }} /> Visible marketplace
        </label>
      </div>
      <Field label="Description courte"><textarea value={form.description||''} onChange={e=>set('description',e.target.value)} rows={2} style={{...inputStyle,resize:'vertical'}} /></Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="Image (optionnelle)">
          {form.image_url && <img src={ASSET(form.image_url)} alt="" style={{ marginBottom:8, width:60, height:60, objectFit:'cover', borderRadius:8 }} />}
          <ProductImageCapture accentColor="#0EA5E9" uploadFn={uploadProductImage} onImageReady={url => set('image_url', url)} />
        </Field>
        <Field label="Notice PDF (optionnelle)">
          <input type="file" accept="application/pdf" onChange={e=>{ const f=e.target.files[0]; if(f) uploadFile(f,'notice_url'); }} style={{ fontSize:12 }} />
          {form.notice_url && <a href={ASSET(form.notice_url)} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:'#0EA5E9' }}>📄 Voir la notice</a>}
        </Field>
      </div>
      <div style={{ display:'flex', gap:10, marginTop:18 }}>
        <button onClick={onCancel} style={{ flex:1, padding:'11px', border:'1.5px solid #E2E8F0', borderRadius:10, background:'#fff', cursor:'pointer', fontWeight:600, fontSize:13 }}>Annuler</button>
        <button onClick={save} disabled={saving} style={{ flex:2, padding:'11px', background:'#0EA5E9', border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:saving?'default':'pointer', opacity:saving?.7:1 }}>{saving?'Enregistrement…':'✓ Enregistrer'}</button>
      </div>
    </>
  );
}

function ProductsTab() {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null); // null | 'new' | medicine object
  const [catalogPrefill, setCatalogPrefill] = useState(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const { toast, show } = useToast();
  const debRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ limit:100 }); if (q.trim()) qs.set('q', q.trim());
    authFetch(`/pharmacy-pro/medicines?${qs}`).then(d => setMedicines(d.medicines||[])).catch(()=>{}).finally(()=>setLoading(false));
  }, [q]);
  useEffect(() => { clearTimeout(debRef.current); debRef.current = setTimeout(load, 250); return () => clearTimeout(debRef.current); }, [load]);

  async function remove(id) {
    if (!window.confirm('Désactiver ce médicament du catalogue ?')) return;
    try { await authFetch(`/pharmacy-pro/medicines/${id}`, { method:'DELETE' }); show('Médicament désactivé'); load(); } catch (e) { show(e.message, 'error'); }
  }

  return (
    <div>
      <Toast {...toast} />
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:240, display:'flex', alignItems:'center', gap:8, background:'#fff', borderRadius:10, padding:'9px 14px', border:'1.5px solid #E2E8F0' }}>
          <PremiumIcon name="search" size={16} style={{ color:'#94A3B8' }} />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Nom, DCI, laboratoire, code-barres…" style={{ flex:1, border:'none', outline:'none', fontSize:14, background:'transparent' }} />
        </div>
        <button onClick={()=>setModal('new')} style={{ padding:'9px 18px', background:'#0EA5E9', border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>+ Nouveau médicament</button>
        <button onClick={()=>setCatalogOpen(true)} style={{ padding:'9px 18px', background:'#fff', border:'1.5px solid #0EA5E9', borderRadius:10, color:'#0EA5E9', fontWeight:700, fontSize:13, cursor:'pointer' }}>Depuis le catalogue</button>
      </div>

      {catalogOpen && (
        <CatalogQuickAddModal
          target="pharmacy"
          onClose={() => setCatalogOpen(false)}
          onOpenManualForm={(prefill) => { setCatalogPrefill(prefill); setModal('new'); }}
        />
      )}
      {loading ? <div style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>Chargement…</div> : medicines.length===0 ? (
        <div style={{ textAlign:'center', padding:48, color:'#94A3B8', background:'#fff', borderRadius:16, border:'1px solid #E5E7EB' }}>Aucun médicament dans le catalogue.</div>
      ) : (
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E5E7EB', overflow:'hidden' }}>
          {medicines.map((m,i) => (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom: i<medicines.length-1?'1px solid #F1F5F9':'none' }}>
              {m.image_url ? <img src={ASSET(m.image_url)} alt="" style={{ width:40, height:40, borderRadius:8, objectFit:'cover', flexShrink:0 }} /> : <div style={{ width:40, height:40, borderRadius:8, background:'#F0F9FF', display:'grid', placeItems:'center', flexShrink:0 }}><PremiumIcon name="medicine" size={20} /></div>}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#0F172A' }}>{m.name} {m.dosage && <span style={{ color:'#94A3B8', fontWeight:500 }}>· {m.dosage}</span>}</div>
                <div style={{ fontSize:11, color:'#94A3B8' }}>{m.dci ? `DCI: ${m.dci} · ` : ''}{m.laboratory || ''} {m.requires_prescription && <span style={{ color:'#EF4444', fontWeight:700 }}>· Ordonnance requise</span>}</div>
              </div>
              <span style={{ fontSize:11, fontWeight:700, color: m.stock_quantity<=m.stock_min ? '#EF4444' : '#10B981', background: m.stock_quantity<=m.stock_min ? '#FEF2F2' : '#F0FDF4', padding:'3px 9px', borderRadius:20 }}>Stock: {m.stock_quantity}</span>
              <span style={{ fontSize:13, fontWeight:800, color:'#0EA5E9', minWidth:80, textAlign:'right' }}>{fmt(m.sale_price)} MAD</span>
              <button onClick={()=>setModal(m)} style={{ padding:'6px 10px', border:'1.5px solid #E2E8F0', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:12 }}><PremiumIcon name="edit" size={14} /></button>
              <button onClick={()=>remove(m.id)} style={{ padding:'6px 10px', border:'1.5px solid #FECACA', borderRadius:8, background:'#FEF2F2', color:'#EF4444', cursor:'pointer', fontSize:12 }}><PremiumIcon name="trash" size={14} /></button>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!modal} title={modal==='new' ? 'Nouveau médicament' : 'Modifier le médicament'} onClose={()=>{ setModal(null); setCatalogPrefill(null); }} width={620}>
        <MedicineForm
          medicine={modal!=='new' ? modal : null}
          initialData={modal==='new' ? catalogPrefill : null}
          onSaved={()=>{ setModal(null); setCatalogPrefill(null); show('Médicament enregistré'); load(); }}
          onCancel={()=>{ setModal(null); setCatalogPrefill(null); }}
        />
      </Modal>
    </div>
  );
}

/* ══ LOTS & PÉREMPTION ═══════════════════════════════════════════════════ */
function LotForm({ onSaved, onCancel }) {
  const [medicines, setMedicines] = useState([]);
  const [form, setForm] = useState({ medicine_id:'', lot_number:'', quantity_initial:'', entry_date:new Date().toISOString().slice(0,10), expiry_date:'', purchase_price:'' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { authFetch('/pharmacy-pro/medicines?limit=200').then(d=>setMedicines(d.medicines||[])).catch(()=>{}); }, []);
  const set = (k,v) => setForm(p=>({ ...p, [k]:v }));

  async function save() {
    if (!form.medicine_id || !form.lot_number || !form.quantity_initial || !form.expiry_date) { setErr('Médicament, numéro de lot, quantité et date de péremption requis'); return; }
    setSaving(true); setErr('');
    try {
      await authFetch('/pharmacy-pro/lots', { method:'POST', body:{ ...form, quantity_initial:Number(form.quantity_initial), purchase_price:Number(form.purchase_price||0) } });
      onSaved();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }
  return (
    <>
      {err && <div style={{ marginBottom:14, padding:'10px 14px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, color:'#DC2626', fontSize:13 }}>{err}</div>}
      <Field label="Médicament" required>
        <select value={form.medicine_id} onChange={e=>set('medicine_id',e.target.value)} style={inputStyle}>
          <option value="">— Choisir —</option>
          {medicines.map(m => <option key={m.id} value={m.id}>{m.name} {m.dosage}</option>)}
        </select>
      </Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="Numéro de lot" required><input value={form.lot_number} onChange={e=>set('lot_number',e.target.value)} style={inputStyle} /></Field>
        <Field label="Quantité" required><input type="number" min="1" value={form.quantity_initial} onChange={e=>set('quantity_initial',e.target.value)} style={inputStyle} /></Field>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="Date d'entrée"><input type="date" value={form.entry_date} onChange={e=>set('entry_date',e.target.value)} style={inputStyle} /></Field>
        <Field label="Date de péremption" required><input type="date" value={form.expiry_date} onChange={e=>set('expiry_date',e.target.value)} style={inputStyle} /></Field>
      </div>
      <Field label="Prix d'achat (MAD)"><input type="number" min="0" step="0.01" value={form.purchase_price} onChange={e=>set('purchase_price',e.target.value)} style={{...inputStyle,maxWidth:160}} /></Field>
      <div style={{ display:'flex', gap:10, marginTop:18 }}>
        <button onClick={onCancel} style={{ flex:1, padding:'11px', border:'1.5px solid #E2E8F0', borderRadius:10, background:'#fff', cursor:'pointer', fontWeight:600, fontSize:13 }}>Annuler</button>
        <button onClick={save} disabled={saving} style={{ flex:2, padding:'11px', background:'#0EA5E9', border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:saving?'default':'pointer', opacity:saving?.7:1 }}>{saving?'Enregistrement…':'Ajouter le lot'}</button>
      </div>
    </>
  );
}

function LotsTab() {
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [modal, setModal] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ limit:200 });
    if (filter === 'expiring') qs.set('expiring_within_days','90');
    else if (filter) qs.set('status', filter);
    authFetch(`/pharmacy-pro/lots?${qs}`).then(d=>setLots(d.lots||[])).catch(()=>{}).finally(()=>setLoading(false));
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  async function checkAlerts() {
    try { const d = await authFetch('/pharmacy-pro/alerts/check', { method:'POST' }); show(`Vérifié : ${d.expiring_soon} proches péremption, ${d.expired} expirés, ${d.low_stock} stock faible`); load(); } catch (e) { show(e.message,'error'); }
  }

  function daysLeft(expiry) { return Math.ceil((new Date(expiry) - new Date()) / 86400000); }

  return (
    <div>
      <Toast {...toast} />
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        {[['', 'Tous'], ['active','Actifs'], ['expiring','Proches péremption'], ['expired','Expirés'], ['recalled','Rappelés']].map(([v,l]) => (
          <button key={v} onClick={()=>setFilter(v)} style={{ padding:'8px 14px', borderRadius:9, border:`1.5px solid ${filter===v?'#0EA5E9':'#E2E8F0'}`, background:filter===v?'#F0F9FF':'#fff', cursor:'pointer', fontSize:12, fontWeight:700, color:filter===v?'#0369A1':'#374151' }}>{l}</button>
        ))}
        <button onClick={checkAlerts} style={{ marginLeft:'auto', padding:'8px 14px', borderRadius:9, border:'1.5px solid #E2E8F0', background:'#fff', cursor:'pointer', fontSize:12, fontWeight:700 }}>Vérifier les alertes</button>
        <button onClick={()=>setModal(true)} style={{ padding:'8px 16px', background:'#0EA5E9', border:'none', borderRadius:9, color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>+ Nouveau lot</button>
      </div>
      {loading ? <div style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>Chargement…</div> : lots.length===0 ? (
        <div style={{ textAlign:'center', padding:48, color:'#94A3B8', background:'#fff', borderRadius:16, border:'1px solid #E5E7EB' }}>Aucun lot.</div>
      ) : (
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E5E7EB', overflow:'hidden' }}>
          {lots.map((l,i) => {
            const days = daysLeft(l.expiry_date);
            const urgent = l.status==='active' && days <= 30;
            return (
              <div key={l.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:i<lots.length-1?'1px solid #F1F5F9':'none', background: urgent ? '#FFFBEB' : (l.status==='expired'?'#FEF2F2':'#fff') }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#0F172A' }}>{l.medicine?.name} <span style={{ color:'#94A3B8', fontWeight:500 }}>— Lot {l.lot_number}</span></div>
                  <div style={{ fontSize:11, color:'#94A3B8' }}>{l.supplier?.name ? `${l.supplier.name} · ` : ''}Entrée {fmtDate(l.entry_date)}</div>
                </div>
                <span style={{ fontSize:12, fontWeight:700, color: l.status==='expired'?'#EF4444':urgent?'#D97706':'#374151' }}>
                  Péremption {fmtDate(l.expiry_date)}{l.status==='active' && ` (${days}j)`}
                </span>
                <span style={{ fontSize:13, fontWeight:800, color:'#0F172A', minWidth:70, textAlign:'right' }}>{l.quantity_remaining}/{l.quantity_initial}</span>
                <span style={{ fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20, color: l.status==='active'?'#10B981':l.status==='expired'?'#EF4444':l.status==='recalled'?'#DC2626':'#9CA3AF', background: l.status==='active'?'#F0FDF4':l.status==='expired'?'#FEF2F2':l.status==='recalled'?'#FEE2E2':'#F1F5F9' }}>
                  {l.status==='active'?'Actif':l.status==='depleted'?'Épuisé':l.status==='expired'?'Expiré':'Rappelé'}
                </span>
                {l.status==='active' && (
                  <button onClick={async ()=>{ if(window.confirm('Marquer ce lot comme rappelé ?')) { await authFetch(`/pharmacy-pro/lots/${l.id}`,{method:'PATCH',body:{status:'recalled'}}); show('Lot marqué rappelé'); load(); } }}
                    style={{ padding:'5px 10px', border:'1.5px solid #FECACA', borderRadius:8, background:'#FEF2F2', color:'#DC2626', cursor:'pointer', fontSize:11, fontWeight:700 }}>⚠ Rappeler</button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Modal open={modal} title="Nouveau lot" onClose={()=>setModal(false)}>
        <LotForm onSaved={()=>{ setModal(false); show('Lot ajouté'); load(); }} onCancel={()=>setModal(false)} />
      </Modal>
    </div>
  );
}

/* ══ POS — VENTE ═══════════════════════════════════════════════════════════ */
function PosTab() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]); // [{ medicine, quantity, discount_percent }]
  const [customer, setCustomer] = useState(null);
  const [custQuery, setCustQuery] = useState('');
  const [custResults, setCustResults] = useState([]);
  const [hasPrescription, setHasPrescription] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amounts, setAmounts] = useState({ cash:'', card:'', credit:'' });
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null); // payload pending override confirmation
  const { toast, show } = useToast();
  const debRef = useRef(null), custDebRef = useRef(null);

  function search(text) {
    setQ(text);
    clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      if (!text.trim()) { setResults([]); return; }
      try { const d = await authFetch(`/pharmacy-pro/medicines?q=${encodeURIComponent(text)}&limit=10`); setResults(d.medicines||[]); } catch {}
    }, 200);
  }
  function searchCustomer(text) {
    setCustQuery(text);
    clearTimeout(custDebRef.current);
    custDebRef.current = setTimeout(async () => {
      if (!text.trim()) { setCustResults([]); return; }
      try { const d = await authFetch(`/pharmacy-pro/customers?q=${encodeURIComponent(text)}`); setCustResults(d.customers||[]); } catch {}
    }, 200);
  }

  function addToCart(m) {
    setCart(p => {
      const existing = p.find(i => i.medicine.id === m.id);
      if (existing) return p.map(i => i.medicine.id===m.id ? { ...i, quantity:i.quantity+1 } : i);
      return [...p, { medicine:m, quantity:1, discount_percent:0 }];
    });
    setQ(''); setResults([]);
  }
  function updateQty(id, qty) { setCart(p => qty<=0 ? p.filter(i=>i.medicine.id!==id) : p.map(i=>i.medicine.id===id?{...i,quantity:qty}:i)); }
  function removeItem(id) { setCart(p => p.filter(i=>i.medicine.id!==id)); }

  const subtotal = cart.reduce((s,i) => s + Number(i.medicine.sale_price)*i.quantity, 0);
  const discountTotal = cart.reduce((s,i) => s + Number(i.medicine.sale_price)*i.quantity*(i.discount_percent/100), 0);
  const vatTotal = cart.reduce((s,i) => { const net = Number(i.medicine.sale_price)*i.quantity*(1-i.discount_percent/100); return s + net*(Number(i.medicine.vat_rate)/100); }, 0);
  const total = Number((subtotal - discountTotal + vatTotal).toFixed(2));
  const rxNeeded = cart.some(i => i.medicine.requires_prescription);

  function resetSale() { setCart([]); setCustomer(null); setCustQuery(''); setHasPrescription(false); setPaymentMethod('cash'); setAmounts({cash:'',card:'',credit:''}); }

  async function submitSale(overrides = {}) {
    if (cart.length===0) { show('Panier vide','error'); return; }
    setSaving(true);
    try {
      const payload = {
        customer_id: customer?.id || null,
        has_prescription: hasPrescription,
        items: cart.map(i => ({ medicine_id:i.medicine.id, quantity:i.quantity, discount_percent:i.discount_percent })),
        payment_method: paymentMethod,
        amount_cash: paymentMethod==='cash' ? total : Number(amounts.cash||0),
        amount_card: paymentMethod==='card' ? total : Number(amounts.card||0),
        amount_credit: paymentMethod==='credit' ? total : Number(amounts.credit||0),
        ...overrides,
      };
      const d = await authFetch('/pharmacy-pro/sales', { method:'POST', body: payload });
      show(`Vente ${d.sale_number} enregistrée — ${fmt(d.total)} MAD`);
      resetSale(); setConfirm(null);
    } catch (e) {
      if (e.payload?.error === 'PRESCRIPTION_REQUIRED' || e.payload?.error === 'CREDIT_LIMIT_EXCEEDED') {
        setConfirm({ message: e.payload.message, overrideKey: e.payload.error==='PRESCRIPTION_REQUIRED' ? 'override_prescription_warning' : 'override_credit_limit' });
      } else show(e.message, 'error');
    }
    setSaving(false);
  }

  return (
    <div>
      <Toast {...toast} />
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:20, alignItems:'start' }} className="ph-pos-grid">
        {/* Recherche + résultats */}
        <div>
          <div style={{ position:'relative', marginBottom:14 }}>
            <input value={q} onChange={e=>search(e.target.value)} placeholder="Scanner ou rechercher un médicament (nom, code-barres)…" style={{ ...inputStyle, padding:'13px 16px', fontSize:15 }} autoFocus />
            {results.length>0 && (
              <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:50, background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,.12)', maxHeight:320, overflowY:'auto', marginTop:4 }}>
                {results.map(m => (
                  <button key={m.id} onClick={()=>addToCart(m)} style={{ width:'100%', textAlign:'left', border:'none', background:'none', padding:'10px 14px', cursor:'pointer', display:'flex', justifyContent:'space-between', gap:8, borderBottom:'1px solid #F1F5F9', fontFamily:'inherit' }}>
                    <span>
                      <div style={{ fontSize:13, fontWeight:700, color:'#0F172A' }}>{m.name} {m.dosage}{m.requires_prescription && <span style={{ color:'#EF4444' }}> ℞</span>}</div>
                      <div style={{ fontSize:11, color:'#94A3B8' }}>Stock: {m.stock_quantity}</div>
                    </span>
                    <span style={{ fontWeight:800, color:'#0EA5E9', fontSize:13 }}>{fmt(m.sale_price)} MAD</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {cart.length===0 ? (
            <div style={{ textAlign:'center', padding:48, color:'#94A3B8', background:'#fff', borderRadius:16, border:'1px solid #E5E7EB' }}><PremiumIconBadge name="cart" size={24} style={{ margin:'0 auto 10px' }} />Panier vide — recherchez un médicament ci-dessus.</div>
          ) : (
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E5E7EB', overflow:'hidden' }}>
              {cart.map((i,idx) => (
                <div key={i.medicine.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderBottom: idx<cart.length-1?'1px solid #F1F5F9':'none' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#0F172A' }}>{i.medicine.name} {i.medicine.requires_prescription && <span style={{ color:'#EF4444', fontSize:11 }}>℞</span>}</div>
                    <div style={{ fontSize:11, color:'#94A3B8' }}>{fmt(i.medicine.sale_price)} MAD/u · TVA {i.medicine.vat_rate}%</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <button onClick={()=>updateQty(i.medicine.id, i.quantity-1)} style={{ width:26, height:26, border:'1px solid #E2E8F0', borderRadius:7, background:'#fff', cursor:'pointer' }}>−</button>
                    <span style={{ minWidth:24, textAlign:'center', fontWeight:700, fontSize:13 }}>{i.quantity}</span>
                    <button onClick={()=>updateQty(i.medicine.id, i.quantity+1)} style={{ width:26, height:26, border:'1px solid #E2E8F0', borderRadius:7, background:'#fff', cursor:'pointer' }}>+</button>
                  </div>
                  <span style={{ fontSize:13, fontWeight:800, minWidth:75, textAlign:'right' }}>{fmt(i.medicine.sale_price*i.quantity)} MAD</span>
                  <button onClick={()=>removeItem(i.medicine.id)} style={{ background:'none', border:'none', color:'#CBD5E1', cursor:'pointer', fontSize:14 }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panneau client + paiement */}
        <div style={{ background:'#fff', borderRadius:16, padding:20, border:'1px solid #E5E7EB', position:'sticky', top:80 }}>
          <Field label="Client (optionnel)">
            {customer ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'#F0F9FF', borderRadius:10 }}>
                <span style={{ fontSize:13, fontWeight:700 }}>{customer.name}</span>
                <button onClick={()=>{setCustomer(null);setCustQuery('');}} style={{ background:'none', border:'none', color:'#0369A1', cursor:'pointer' }}>✕</button>
              </div>
            ) : (
              <div style={{ position:'relative' }}>
                <input value={custQuery} onChange={e=>searchCustomer(e.target.value)} placeholder="Nom ou téléphone…" style={inputStyle} />
                {custResults.length>0 && (
                  <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:50, background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,.12)', maxHeight:200, overflowY:'auto', marginTop:4 }}>
                    {custResults.map(c => (
                      <button key={c.id} onClick={()=>{setCustomer(c);setCustResults([]);}} style={{ width:'100%', textAlign:'left', border:'none', background:'none', padding:'9px 12px', cursor:'pointer', fontSize:12, borderBottom:'1px solid #F1F5F9' }}>{c.name} — {c.phone}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Field>

          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color: rxNeeded?'#DC2626':'#374151', cursor:'pointer', marginBottom:14, padding: rxNeeded ? '8px 10px' : 0, background: rxNeeded ? '#FEF2F2' : 'transparent', borderRadius:8 }}>
            <input type="checkbox" checked={hasPrescription} onChange={e=>setHasPrescription(e.target.checked)} style={{ accentColor:'#0EA5E9' }} />
            Vente avec ordonnance{rxNeeded && ' (requis pour un ou plusieurs articles ℞)'}
          </label>

          <Field label="Mode de paiement">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[['cash','Espèces','💵'],['card','Carte','💳'],['credit','Crédit','📒'],['mixed','Mixte','🔀']].map(([v,l,ic]) => (
                <button key={v} onClick={()=>setPaymentMethod(v)} style={{ padding:'9px 8px', border:`1.5px solid ${paymentMethod===v?'#0EA5E9':'#E2E8F0'}`, borderRadius:10, background:paymentMethod===v?'#F0F9FF':'#fff', cursor:'pointer', fontSize:12, fontWeight:600, color:paymentMethod===v?'#0369A1':'#374151', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6 }}><DashboardIcon icon={ic} size={14} />{l}</button>
              ))}
            </div>
          </Field>

          {paymentMethod==='mixed' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
              <Field label="Espèces"><input type="number" min="0" value={amounts.cash} onChange={e=>setAmounts(p=>({...p,cash:e.target.value}))} style={inputStyle} /></Field>
              <Field label="Carte"><input type="number" min="0" value={amounts.card} onChange={e=>setAmounts(p=>({...p,card:e.target.value}))} style={inputStyle} /></Field>
              <Field label="Crédit"><input type="number" min="0" value={amounts.credit} onChange={e=>setAmounts(p=>({...p,credit:e.target.value}))} style={inputStyle} /></Field>
            </div>
          )}
          {paymentMethod==='credit' && !customer && <div style={{ fontSize:12, color:'#DC2626', marginBottom:14 }}>Un client est requis pour une vente à crédit.</div>}

          <div style={{ borderTop:'1px solid #E2E8F0', paddingTop:12, marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#64748B', marginBottom:4 }}><span>Sous-total</span><span>{fmt(subtotal)} MAD</span></div>
            {discountTotal>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#64748B', marginBottom:4 }}><span>Remise</span><span>−{fmt(discountTotal)} MAD</span></div>}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#64748B', marginBottom:8 }}><span>TVA</span><span>{fmt(vatTotal)} MAD</span></div>
            <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:18, color:'#0F172A' }}><span>Total</span><span style={{ color:'#0EA5E9' }}>{fmt(total)} MAD</span></div>
          </div>

          <button onClick={()=>submitSale()} disabled={saving || cart.length===0} style={{ width:'100%', padding:'14px', background:'linear-gradient(135deg,#0EA5E9,#0369A1)', border:'none', borderRadius:12, color:'#fff', fontWeight:700, fontSize:15, cursor:saving?'default':'pointer', opacity:saving||cart.length===0?.6:1 }}>
            {saving ? 'Validation…' : '✓ Valider la vente'}
          </button>
        </div>
      </div>

      <Modal open={!!confirm} title="⚠️ Confirmation requise" onClose={()=>setConfirm(null)}>
        <p style={{ fontSize:14, color:'#374151', lineHeight:1.6 }}>{confirm?.message}</p>
        <p style={{ fontSize:12, color:'#94A3B8' }}>Cette confirmation sera journalisée. Ne valider qu'après vérification par le pharmacien.</p>
        <div style={{ display:'flex', gap:10, marginTop:14 }}>
          <button onClick={()=>setConfirm(null)} style={{ flex:1, padding:'11px', border:'1.5px solid #E2E8F0', borderRadius:10, background:'#fff', cursor:'pointer', fontWeight:600, fontSize:13 }}>Annuler</button>
          <button onClick={()=>submitSale({ [confirm.overrideKey]: true })} style={{ flex:2, padding:'11px', background:'#DC2626', border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>Confirmer quand même</button>
        </div>
      </Modal>
    </div>
  );
}

/* ══ ORDONNANCES ═══════════════════════════════════════════════════════════ */
function PrescriptionsTab() {
  const { t } = useI18n();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [modal, setModal] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams(); if (filter) qs.set('status', filter);
    authFetch(`/pharmacy-pro/prescriptions?${qs}`).then(d=>setPrescriptions(d.prescriptions||[])).catch(()=>{}).finally(()=>setLoading(false));
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  async function setStatus(id, status) {
    try { await authFetch(`/pharmacy-pro/prescriptions/${id}/status`, { method:'PATCH', body:{ status } }); load(); }
    catch (e) { show(e.message, 'error'); }
  }

  return (
    <div>
      <Toast {...toast} />
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {[['', 'Toutes'], ['received','Reçues'], ['preparing','En préparation'], ['served','Servies'], ['cancelled','Annulées']].map(([v,l]) => (
          <button key={v} onClick={()=>setFilter(v)} style={{ padding:'8px 14px', borderRadius:9, border:`1.5px solid ${filter===v?'#0EA5E9':'#E2E8F0'}`, background:filter===v?'#F0F9FF':'#fff', cursor:'pointer', fontSize:12, fontWeight:700, color:filter===v?'#0369A1':'#374151' }}>{l}</button>
        ))}
        <button onClick={()=>setModal(true)} style={{ marginLeft:'auto', padding:'8px 16px', background:'#0EA5E9', border:'none', borderRadius:9, color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>+ Nouvelle ordonnance</button>
      </div>
      {loading ? <div style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>Chargement…</div> : prescriptions.length===0 ? (
        <div style={{ textAlign:'center', padding:48, color:'#94A3B8', background:'#fff', borderRadius:16, border:'1px solid #E5E7EB' }}>Aucune ordonnance.</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
          {prescriptions.map(p => {
            const st = RX_STATUS[p.status] || { c:'#9CA3AF' };
            return (
              <div key={p.id} style={{ background:'#fff', borderRadius:14, border:'1px solid #E5E7EB', padding:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'#0F172A' }}>{p.customer?.name || 'Client non lié'}</span>
                  <span style={{ fontSize:10, fontWeight:700, color:st.c, background:`${st.c}18`, padding:'3px 8px', borderRadius:20 }}>{translatePharmacyPrescriptionStatus(t, p.status)}</span>
                </div>
                {p.doctor_name && <div style={{ fontSize:12, color:'#64748B', marginBottom:4 }}>Dr {p.doctor_name}</div>}
                <div style={{ fontSize:11, color:'#94A3B8', marginBottom:10 }}>{fmtDate(p.prescription_date || p.createdAt)}</div>
                <a href={ASSET(p.file_url)} target="_blank" rel="noopener noreferrer" style={{ display:'inline-block', fontSize:12, color:'#0EA5E9', marginBottom:10 }}>📎 Voir le fichier</a>
                {p.status !== 'served' && p.status !== 'cancelled' && (
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {p.status==='received' && <button onClick={()=>setStatus(p.id,'preparing')} style={{ padding:'5px 10px', fontSize:11, fontWeight:700, border:'1.5px solid #F59E0B', borderRadius:8, color:'#F59E0B', background:'#FFFBEB', cursor:'pointer' }}>→ Préparation</button>}
                    {p.status==='preparing' && <button onClick={()=>setStatus(p.id,'served')} style={{ padding:'5px 10px', fontSize:11, fontWeight:700, border:'1.5px solid #10B981', borderRadius:8, color:'#10B981', background:'#F0FDF4', cursor:'pointer' }}>→ Servie</button>}
                    <button onClick={()=>setStatus(p.id,'cancelled')} style={{ padding:'5px 10px', fontSize:11, fontWeight:700, border:'1.5px solid #EF4444', borderRadius:8, color:'#EF4444', background:'#FEF2F2', cursor:'pointer' }}>Annuler</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Modal open={modal} title="📋 Nouvelle ordonnance" onClose={()=>setModal(false)}>
        <NewPrescriptionForm onSaved={()=>{ setModal(false); show('Ordonnance enregistrée'); load(); }} onCancel={()=>setModal(false)} />
      </Modal>
    </div>
  );
}

function NewPrescriptionForm({ onSaved, onCancel }) {
  const [form, setForm] = useState({ doctor_name:'', prescription_date:'', file_url:'', notes:'' });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k,v) => setForm(p=>({ ...p, [k]:v }));

  async function uploadFile(file) {
    setUploading(true);
    const fd = new FormData(); fd.append('image', file);
    const token = localStorage.getItem('rb_token');
    const res = await fetch(API('/pharmacy-pro/upload'), { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:fd });
    const d = await res.json();
    if (d.url) set('file_url', d.url);
    setUploading(false);
  }
  async function save() {
    if (!form.file_url) { setErr('Photo ou PDF de l\'ordonnance requis'); return; }
    setSaving(true); setErr('');
    try { await authFetch('/pharmacy-pro/prescriptions', { method:'POST', body: form }); onSaved(); }
    catch (e) { setErr(e.message); }
    setSaving(false);
  }
  return (
    <>
      {err && <div style={{ marginBottom:14, padding:'10px 14px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, color:'#DC2626', fontSize:13 }}>{err}</div>}
      <Field label="Photo / PDF de l'ordonnance" required>
        <input type="file" accept="image/*,application/pdf" onChange={e=>{ const f=e.target.files[0]; if(f) uploadFile(f); }} style={{ fontSize:12 }} />
        {uploading && <span style={{ fontSize:12, color:'#94A3B8' }}>Envoi…</span>}
        {form.file_url && <div style={{ fontSize:12, color:'#10B981', marginTop:6 }}>✓ Fichier reçu</div>}
      </Field>
      <Field label="Médecin prescripteur"><input value={form.doctor_name} onChange={e=>set('doctor_name',e.target.value)} style={inputStyle} /></Field>
      <Field label="Date de l'ordonnance"><input type="date" value={form.prescription_date} onChange={e=>set('prescription_date',e.target.value)} style={inputStyle} /></Field>
      <Field label="Notes internes"><textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows={2} style={{...inputStyle,resize:'vertical'}} /></Field>
      <div style={{ display:'flex', gap:10, marginTop:18 }}>
        <button onClick={onCancel} style={{ flex:1, padding:'11px', border:'1.5px solid #E2E8F0', borderRadius:10, background:'#fff', cursor:'pointer', fontWeight:600, fontSize:13 }}>Annuler</button>
        <button onClick={save} disabled={saving||uploading} style={{ flex:2, padding:'11px', background:'#0EA5E9', border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', opacity:saving?.7:1 }}>{saving?'Enregistrement…':'✓ Enregistrer'}</button>
      </div>
    </>
  );
}

/* ══ CLIENTS / PATIENTS ═══════════════════════════════════════════════════ */
function CustomersTab() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(false);
  const { toast, show } = useToast();
  const debRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams(); if (q.trim()) qs.set('q', q.trim());
    authFetch(`/pharmacy-pro/customers?${qs}`).then(d=>setCustomers(d.customers||[])).catch(()=>{}).finally(()=>setLoading(false));
  }, [q]);
  useEffect(() => { clearTimeout(debRef.current); debRef.current = setTimeout(load, 250); return () => clearTimeout(debRef.current); }, [load]);

  if (selected) return <CustomerDetail id={selected} onBack={()=>{ setSelected(null); load(); }} />;

  return (
    <div>
      <Toast {...toast} />
      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:'#fff', borderRadius:10, padding:'9px 14px', border:'1.5px solid #E2E8F0' }}>
          <PremiumIcon name="search" size={16} style={{ color:'#94A3B8' }} />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Nom ou téléphone…" style={{ flex:1, border:'none', outline:'none', fontSize:14, background:'transparent' }} />
        </div>
        <button onClick={()=>setModal(true)} style={{ padding:'9px 18px', background:'#0EA5E9', border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>+ Nouveau client</button>
      </div>
      {loading ? <div style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>Chargement…</div> : customers.length===0 ? (
        <div style={{ textAlign:'center', padding:48, color:'#94A3B8', background:'#fff', borderRadius:16, border:'1px solid #E5E7EB' }}>Aucun client.</div>
      ) : (
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E5E7EB', overflow:'hidden' }}>
          {customers.map((c,i) => (
            <button key={c.id} onClick={()=>setSelected(c.id)} style={{ width:'100%', textAlign:'left', display:'flex', alignItems:'center', gap:12, padding:'12px 16px', border:'none', borderBottom:i<customers.length-1?'1px solid #F1F5F9':'none', background:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'#F0F9FF', display:'grid', placeItems:'center', fontWeight:800, color:'#0EA5E9' }}>{c.name[0]?.toUpperCase()}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#0F172A' }}>{c.name}</div>
                <div style={{ fontSize:11, color:'#94A3B8' }}>{c.phone}</div>
              </div>
              {Number(c.balance) > 0 && <span style={{ fontSize:12, fontWeight:700, color:'#EF4444' }}>{fmt(c.balance)} MAD dû</span>}
            </button>
          ))}
        </div>
      )}
      <Modal open={modal} title="➕ Nouveau client" onClose={()=>setModal(false)}>
        <CustomerForm onSaved={()=>{ setModal(false); show('Client enregistré'); load(); }} onCancel={()=>setModal(false)} />
      </Modal>
    </div>
  );
}

function CustomerForm({ customer, onSaved, onCancel }) {
  const [form, setForm] = useState(customer || { name:'', phone:'', birth_date:'', address:'', district:'', credit_limit:0, notes:'' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k,v) => setForm(p=>({ ...p, [k]:v }));
  async function save() {
    if (!form.name.trim() || !form.phone.trim()) { setErr('Nom et téléphone requis'); return; }
    setSaving(true); setErr('');
    try {
      const d = customer ? await authFetch(`/pharmacy-pro/customers/${customer.id}`, { method:'PATCH', body:form }) : await authFetch('/pharmacy-pro/customers', { method:'POST', body:form });
      onSaved(d.customer);
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }
  return (
    <>
      {err && <div style={{ marginBottom:14, padding:'10px 14px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, color:'#DC2626', fontSize:13 }}>{err}</div>}
      <Field label="Nom" required><input value={form.name} onChange={e=>set('name',e.target.value)} style={inputStyle} /></Field>
      <Field label="Téléphone" required><input value={form.phone} onChange={e=>set('phone',e.target.value)} style={inputStyle} /></Field>
      <Field label="Date de naissance (optionnelle)"><input type="date" value={form.birth_date||''} onChange={e=>set('birth_date',e.target.value)} style={inputStyle} /></Field>
      <Field label="Adresse"><input value={form.address||''} onChange={e=>set('address',e.target.value)} style={inputStyle} /></Field>
      <Field label="Quartier"><input value={form.district||''} onChange={e=>set('district',e.target.value)} style={inputStyle} /></Field>
      <Field label="Plafond de crédit (MAD)"><input type="number" min="0" value={form.credit_limit} onChange={e=>set('credit_limit',e.target.value)} style={inputStyle} /></Field>
      <Field label="Notes internes"><textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)} rows={2} style={{...inputStyle,resize:'vertical'}} /></Field>
      <div style={{ display:'flex', gap:10, marginTop:18 }}>
        <button onClick={onCancel} style={{ flex:1, padding:'11px', border:'1.5px solid #E2E8F0', borderRadius:10, background:'#fff', cursor:'pointer', fontWeight:600, fontSize:13 }}>Annuler</button>
        <button onClick={save} disabled={saving} style={{ flex:2, padding:'11px', background:'#0EA5E9', border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', opacity:saving?.7:1 }}>{saving?'Enregistrement…':'✓ Enregistrer'}</button>
      </div>
    </>
  );
}

function CustomerDetail({ id, onBack }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  useEffect(() => { authFetch(`/pharmacy-pro/customers/${id}`).then(setData).catch(()=>{}); }, [id]);
  if (!data) return <div style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>Chargement…</div>;
  const { customer:c, sales, prescriptions, sensitive_access } = data;
  return (
    <div>
      <button onClick={onBack} style={{ background:'none', border:'none', color:'#64748B', cursor:'pointer', fontSize:13, fontWeight:600, marginBottom:14 }}>← Retour</button>
      <div style={{ background:'#fff', borderRadius:16, padding:22, border:'1px solid #E5E7EB', marginBottom:16 }}>
        <h2 style={{ margin:'0 0 4px', fontSize:18, fontWeight:800, color:'#0F172A' }}>{c.name}</h2>
        <div style={{ fontSize:13, color:'#64748B' }}>{c.phone}{c.birth_date ? ` · né(e) le ${fmtDate(c.birth_date)}` : ''}{c.district ? ` · ${c.district}` : ''}</div>
        {Number(c.balance) > 0 && <div style={{ marginTop:8, fontSize:14, fontWeight:800, color:'#EF4444' }}>Solde dû : {fmt(c.balance)} MAD (plafond {fmt(c.credit_limit)})</div>}
        {c.notes && <div style={{ marginTop:10, padding:'10px 14px', background:'#FFFBEB', borderRadius:10, fontSize:13, color:'#92400E' }}>💬 {c.notes}</div>}
        {!sensitive_access && <div style={{ marginTop:10, fontSize:11, color:'#94A3B8' }}>🔒 Historique détaillé masqué (permission requise)</div>}
      </div>
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E5E7EB', padding:16, marginBottom:16 }}>
        <h3 style={{ margin:'0 0 12px', fontSize:14, fontWeight:800 }}>🧾 Historique des ventes</h3>
        {sales.length===0 ? <div style={{ fontSize:13, color:'#94A3B8' }}>Aucune vente.</div> : sales.map(s => (
          <div key={s.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #F1F5F9', fontSize:13 }}>
            <span>{s.sale_number} — {fmtDate(s.createdAt)}</span>
            <span style={{ fontWeight:700 }}>{fmt(s.total)} MAD</span>
          </div>
        ))}
      </div>
      {sensitive_access && (
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E5E7EB', padding:16 }}>
          <h3 style={{ margin:'0 0 12px', fontSize:14, fontWeight:800 }}>📋 Historique des ordonnances</h3>
          {prescriptions.length===0 ? <div style={{ fontSize:13, color:'#94A3B8' }}>Aucune ordonnance.</div> : prescriptions.map(p => (
            <div key={p.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #F1F5F9', fontSize:13 }}>
              <span>{fmtDate(p.createdAt)}{p.doctor_name ? ` — Dr ${p.doctor_name}` : ''}</span>
              <span>{translatePharmacyPrescriptionStatus(t, p.status)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══ FOURNISSEURS ═══════════════════════════════════════════════════════════ */
function SuppliersTab() {
  const [suppliers, setSuppliers] = useState([]);
  const [modal, setModal] = useState(null);
  const { toast, show } = useToast();
  const load = useCallback(() => { authFetch('/pharmacy-pro/suppliers').then(d=>setSuppliers(d.suppliers||[])).catch(()=>{}); }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <Toast {...toast} />
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
        <button onClick={()=>setModal('new')} style={{ padding:'9px 18px', background:'#0EA5E9', border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>+ Nouveau fournisseur</button>
      </div>
      {suppliers.length===0 ? <div style={{ textAlign:'center', padding:48, color:'#94A3B8', background:'#fff', borderRadius:16, border:'1px solid #E5E7EB' }}>Aucun fournisseur.</div> : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
          {suppliers.map(s => (
            <div key={s.id} style={{ background:'#fff', borderRadius:14, border:'1px solid #E5E7EB', padding:16 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#0F172A', marginBottom:4 }}>{s.name}</div>
              {s.laboratory && <div style={{ fontSize:12, color:'#64748B', marginBottom:6 }}>{s.laboratory}</div>}
              <div style={{ fontSize:12, color:'#94A3B8' }}>{s.phone}{s.email ? ` · ${s.email}` : ''}</div>
              <button onClick={()=>setModal(s)} style={{ marginTop:10, padding:'6px 12px', border:'1.5px solid #E2E8F0', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:11 }}>✏️ Modifier</button>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!modal} title={modal==='new'?'+ Nouveau fournisseur':'✏️ Modifier'} onClose={()=>setModal(null)}>
        <SupplierForm supplier={modal!=='new'?modal:null} onSaved={()=>{ setModal(null); show('Fournisseur enregistré'); load(); }} onCancel={()=>setModal(null)} />
      </Modal>
    </div>
  );
}
function SupplierForm({ supplier, onSaved, onCancel }) {
  const [form, setForm] = useState(supplier || { name:'', phone:'', email:'', address:'', laboratory:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k,v) => setForm(p=>({ ...p, [k]:v }));
  async function save() {
    if (!form.name.trim()) { setErr('Nom requis'); return; }
    setSaving(true); setErr('');
    try {
      const d = supplier ? await authFetch(`/pharmacy-pro/suppliers/${supplier.id}`, { method:'PATCH', body:form }) : await authFetch('/pharmacy-pro/suppliers', { method:'POST', body:form });
      onSaved(d.supplier);
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }
  return (
    <>
      {err && <div style={{ marginBottom:14, padding:'10px 14px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, color:'#DC2626', fontSize:13 }}>{err}</div>}
      <Field label="Nom" required><input value={form.name} onChange={e=>set('name',e.target.value)} style={inputStyle} /></Field>
      <Field label="Laboratoire / Distributeur"><input value={form.laboratory||''} onChange={e=>set('laboratory',e.target.value)} style={inputStyle} /></Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="Téléphone"><input value={form.phone||''} onChange={e=>set('phone',e.target.value)} style={inputStyle} /></Field>
        <Field label="Email"><input type="email" value={form.email||''} onChange={e=>set('email',e.target.value)} style={inputStyle} /></Field>
      </div>
      <Field label="Adresse"><input value={form.address||''} onChange={e=>set('address',e.target.value)} style={inputStyle} /></Field>
      <div style={{ display:'flex', gap:10, marginTop:18 }}>
        <button onClick={onCancel} style={{ flex:1, padding:'11px', border:'1.5px solid #E2E8F0', borderRadius:10, background:'#fff', cursor:'pointer', fontWeight:600, fontSize:13 }}>Annuler</button>
        <button onClick={save} disabled={saving} style={{ flex:2, padding:'11px', background:'#0EA5E9', border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', opacity:saving?.7:1 }}>{saving?'Enregistrement…':'✓ Enregistrer'}</button>
      </div>
    </>
  );
}

/* ══ COMMANDES FOURNISSEURS ══════════════════════════════════════════════════ */
function PurchaseOrdersTab() {
  const { t } = useI18n();
  const [orders, setOrders] = useState([]);
  const [modal, setModal] = useState(false);
  const [receiveOrder, setReceiveOrder] = useState(null);
  const { toast, show } = useToast();
  const load = useCallback(() => { authFetch('/pharmacy-pro/purchase-orders').then(d=>setOrders(d.orders||[])).catch(()=>{}); }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <Toast {...toast} />
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
        <button onClick={()=>setModal(true)} style={{ padding:'9px 18px', background:'#0EA5E9', border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>+ Nouvelle commande</button>
      </div>
      {orders.length===0 ? <div style={{ textAlign:'center', padding:48, color:'#94A3B8', background:'#fff', borderRadius:16, border:'1px solid #E5E7EB' }}>Aucune commande fournisseur.</div> : (
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E5E7EB', overflow:'hidden' }}>
          {orders.map((o,i) => {
            const st = PO_STATUS[o.status] || { c:'#9CA3AF' };
            return (
              <div key={o.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:i<orders.length-1?'1px solid #F1F5F9':'none' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#0F172A' }}>{o.order_number} — {o.supplier?.name}</div>
                  <div style={{ fontSize:11, color:'#94A3B8' }}>{fmtDate(o.order_date)}{o.expected_date ? ` · prévue ${fmtDate(o.expected_date)}` : ''}</div>
                </div>
                <span style={{ fontSize:10, fontWeight:700, color:st.c, background:`${st.c}18`, padding:'3px 9px', borderRadius:20 }}>{translatePharmacyPurchaseOrderStatus(t, o.status)}</span>
                <span style={{ fontWeight:800, fontSize:13, minWidth:80, textAlign:'right' }}>{fmt(o.total_amount)} MAD</span>
                {['draft','sent','partially_received'].includes(o.status) && (
                  <button onClick={()=>setReceiveOrder(o)} style={{ padding:'6px 12px', border:'1.5px solid #10B981', borderRadius:8, background:'#F0FDF4', color:'#10B981', cursor:'pointer', fontSize:11, fontWeight:700 }}>📥 Réceptionner</button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Modal open={modal} title="+ Nouvelle commande fournisseur" onClose={()=>setModal(false)} width={640}>
        <PurchaseOrderForm onSaved={()=>{ setModal(false); show('Commande créée'); load(); }} onCancel={()=>setModal(false)} />
      </Modal>
      <Modal open={!!receiveOrder} title={`📥 Réceptionner ${receiveOrder?.order_number||''}`} onClose={()=>setReceiveOrder(null)} width={640}>
        {receiveOrder && <ReceiveOrderForm order={receiveOrder} onSaved={()=>{ setReceiveOrder(null); show('Réception enregistrée — lots créés'); load(); }} onCancel={()=>setReceiveOrder(null)} />}
      </Modal>
    </div>
  );
}
function PurchaseOrderForm({ onSaved, onCancel }) {
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [items, setItems] = useState([{ medicine_id:'', quantity_ordered:1, unit_price:0 }]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { authFetch('/pharmacy-pro/suppliers').then(d=>setSuppliers(d.suppliers||[])); authFetch('/pharmacy-pro/medicines?limit=200').then(d=>setMedicines(d.medicines||[])); }, []);

  function setItem(i, field, val) { setItems(p => p.map((it,idx) => idx===i ? { ...it, [field]:val } : it)); }
  function addItem() { setItems(p => [...p, { medicine_id:'', quantity_ordered:1, unit_price:0 }]); }
  function removeItem(i) { setItems(p => p.filter((_,idx)=>idx!==i)); }

  async function save() {
    if (!supplierId) { setErr('Fournisseur requis'); return; }
    const valid = items.filter(i => i.medicine_id && i.quantity_ordered > 0);
    if (valid.length===0) { setErr('Au moins une ligne valide requise'); return; }
    setSaving(true); setErr('');
    try {
      await authFetch('/pharmacy-pro/purchase-orders', { method:'POST', body:{ supplier_id:Number(supplierId), expected_date:expectedDate||null, items: valid.map(i=>({ medicine_id:Number(i.medicine_id), quantity_ordered:Number(i.quantity_ordered), unit_price:Number(i.unit_price) })) } });
      onSaved();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }
  return (
    <>
      {err && <div style={{ marginBottom:14, padding:'10px 14px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, color:'#DC2626', fontSize:13 }}>{err}</div>}
      <Field label="Fournisseur" required>
        <select value={supplierId} onChange={e=>setSupplierId(e.target.value)} style={inputStyle}>
          <option value="">— Choisir —</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Date de réception prévue"><input type="date" value={expectedDate} onChange={e=>setExpectedDate(e.target.value)} style={{...inputStyle,maxWidth:200}} /></Field>
      <Field label="Lignes de commande">
        {items.map((it,i) => (
          <div key={i} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center' }}>
            <select value={it.medicine_id} onChange={e=>setItem(i,'medicine_id',e.target.value)} style={{ ...inputStyle, flex:2 }}>
              <option value="">— Médicament —</option>
              {medicines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <input type="number" min="1" value={it.quantity_ordered} onChange={e=>setItem(i,'quantity_ordered',e.target.value)} placeholder="Qté" style={{ ...inputStyle, width:80 }} />
            <input type="number" min="0" step="0.01" value={it.unit_price} onChange={e=>setItem(i,'unit_price',e.target.value)} placeholder="Prix u." style={{ ...inputStyle, width:100 }} />
            <button onClick={()=>removeItem(i)} style={{ background:'none', border:'none', color:'#EF4444', cursor:'pointer' }}>✕</button>
          </div>
        ))}
        <button onClick={addItem} style={{ fontSize:12, color:'#0EA5E9', background:'none', border:'none', cursor:'pointer', fontWeight:700 }}>+ Ajouter une ligne</button>
      </Field>
      <div style={{ display:'flex', gap:10, marginTop:18 }}>
        <button onClick={onCancel} style={{ flex:1, padding:'11px', border:'1.5px solid #E2E8F0', borderRadius:10, background:'#fff', cursor:'pointer', fontWeight:600, fontSize:13 }}>Annuler</button>
        <button onClick={save} disabled={saving} style={{ flex:2, padding:'11px', background:'#0EA5E9', border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', opacity:saving?.7:1 }}>{saving?'Enregistrement…':'✓ Créer la commande'}</button>
      </div>
    </>
  );
}
function ReceiveOrderForm({ order, onSaved, onCancel }) {
  const [rows, setRows] = useState((order.items||[]).filter(i=>i.quantity_received < i.quantity_ordered).map(i => ({ item_id:i.id, medicine_id:i.medicine_id, label:`Article #${i.medicine_id}`, quantity_received: i.quantity_ordered - i.quantity_received, lot_number:'', expiry_date:'' })));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  function setRow(i, field, val) { setRows(p => p.map((r,idx) => idx===i ? { ...r, [field]:val } : r)); }
  async function save() {
    const valid = rows.filter(r => r.quantity_received > 0 && r.lot_number && r.expiry_date);
    if (valid.length===0) { setErr('Renseignez numéro de lot, date de péremption et quantité pour au moins une ligne'); return; }
    setSaving(true); setErr('');
    try {
      await authFetch(`/pharmacy-pro/purchase-orders/${order.id}/receive`, { method:'POST', body:{ items: valid.map(r=>({ item_id:r.item_id, quantity_received:Number(r.quantity_received), lot_number:r.lot_number, expiry_date:r.expiry_date })) } });
      onSaved();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }
  return (
    <>
      {err && <div style={{ marginBottom:14, padding:'10px 14px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, color:'#DC2626', fontSize:13 }}>{err}</div>}
      {rows.length===0 ? <div style={{ fontSize:13, color:'#94A3B8' }}>Tous les articles ont déjà été réceptionnés.</div> : rows.map((r,i) => (
        <div key={r.item_id} style={{ border:'1px solid #E2E8F0', borderRadius:10, padding:12, marginBottom:10 }}>
          <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>Article #{r.medicine_id}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            <input type="number" min="0" value={r.quantity_received} onChange={e=>setRow(i,'quantity_received',e.target.value)} placeholder="Qté reçue" style={inputStyle} />
            <input value={r.lot_number} onChange={e=>setRow(i,'lot_number',e.target.value)} placeholder="N° de lot" style={inputStyle} />
            <input type="date" value={r.expiry_date} onChange={e=>setRow(i,'expiry_date',e.target.value)} style={inputStyle} />
          </div>
        </div>
      ))}
      <div style={{ display:'flex', gap:10, marginTop:18 }}>
        <button onClick={onCancel} style={{ flex:1, padding:'11px', border:'1.5px solid #E2E8F0', borderRadius:10, background:'#fff', cursor:'pointer', fontWeight:600, fontSize:13 }}>Annuler</button>
        <button onClick={save} disabled={saving||rows.length===0} style={{ flex:2, padding:'11px', background:'#10B981', border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', opacity:saving?.7:1 }}>{saving?'Enregistrement…':'✓ Confirmer la réception'}</button>
      </div>
    </>
  );
}

/* ══ DEMANDES (marketplace) ═══════════════════════════════════════════════ */
function RequestsTab() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('');
  const { toast, show } = useToast();
  const TYPE_LABELS = { prescription:'📋 Ordonnance', availability:'🔎 Disponibilité', delivery:'🚚 Livraison', reservation:'📦 Réservation' };
  const load = useCallback(() => { const qs=new URLSearchParams(); if(filter) qs.set('status',filter); authFetch(`/pharmacy-pro/requests?${qs}`).then(d=>setRequests(d.requests||[])).catch(()=>{}); }, [filter]);
  useEffect(() => { load(); }, [load]);
  async function setStatus(id, status) { try { await authFetch(`/pharmacy-pro/requests/${id}`, { method:'PATCH', body:{ status } }); load(); } catch(e){ show(e.message,'error'); } }

  return (
    <div>
      <Toast {...toast} />
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {[['', 'Toutes'], ['new','Nouvelles'], ['in_progress','En cours'], ['done','Traitées'], ['rejected','Rejetées']].map(([v,l]) => (
          <button key={v} onClick={()=>setFilter(v)} style={{ padding:'8px 14px', borderRadius:9, border:`1.5px solid ${filter===v?'#0EA5E9':'#E2E8F0'}`, background:filter===v?'#F0F9FF':'#fff', cursor:'pointer', fontSize:12, fontWeight:700, color:filter===v?'#0369A1':'#374151' }}>{l}</button>
        ))}
      </div>
      {requests.length===0 ? <div style={{ textAlign:'center', padding:48, color:'#94A3B8', background:'#fff', borderRadius:16, border:'1px solid #E5E7EB' }}>Aucune demande.</div> : (
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E5E7EB', overflow:'hidden' }}>
          {requests.map((r,i) => (
            <div key={r.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:i<requests.length-1?'1px solid #F1F5F9':'none' }}>
              <span style={{ fontSize:11, fontWeight:700, color:'#0369A1', background:'#F0F9FF', padding:'3px 8px', borderRadius:20, whiteSpace:'nowrap' }}>{TYPE_LABELS[r.type]}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#0F172A' }}>{r.customer_name} — {r.customer_phone}</div>
                <div style={{ fontSize:11, color:'#94A3B8' }}>{r.product_name || r.message || r.address || ''}</div>
              </div>
              {r.file_url && <a href={ASSET(r.file_url)} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:'#0EA5E9' }}>📎</a>}
              <select value={r.status} onChange={e=>setStatus(r.id, e.target.value)} style={{ fontSize:11, padding:'5px 8px', borderRadius:8, border:'1.5px solid #E2E8F0' }}>
                <option value="new">Nouvelle</option><option value="in_progress">En cours</option><option value="done">Traitée</option><option value="rejected">Rejetée</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══ RAPPORTS ═══════════════════════════════════════════════════════════ */
function ReportsTab() {
  const [busy, setBusy] = useState('');
  function toCsv(rows, headers) { const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`; return [headers.map(esc).join(';'), ...rows.map(r=>r.map(esc).join(';'))].join('\n'); }
  function downloadCsv(content, filename) { const blob=new Blob(['﻿'+content],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url); }

  async function exportSalesPdf() {
    setBusy('pdf-sales');
    try {
      const d = await authFetch('/pharmacy-pro/reports/sales-by-day');
      const doc = new jsPDF(); doc.setFontSize(16); doc.text('Ventes par jour (30 derniers jours)', 14, 18);
      autoTable(doc, { startY:26, head:[['Jour','Ventes','Total (MAD)']], headStyles:{fillColor:[14,165,233]}, body: d.rows.map(r=>[r.day, r.count, fmt(r.total)]) });
      doc.save('ventes-par-jour.pdf');
    } catch {} setBusy('');
  }
  async function exportMedicinesCsv() {
    setBusy('csv-meds');
    try { const d = await authFetch('/pharmacy-pro/reports/sales-by-medicine'); downloadCsv(toCsv(d.rows.map(r=>[r.product_name, r.quantity, fmt(r.revenue)]), ['Médicament','Quantité','CA (MAD)']), 'ventes-par-medicament.csv'); } catch {} setBusy('');
  }
  async function exportExpiringPdf() {
    setBusy('pdf-exp');
    try {
      const d = await authFetch('/pharmacy-pro/reports/expiring');
      const doc = new jsPDF(); doc.setFontSize(16); doc.text('Produits proches de péremption', 14, 18);
      autoTable(doc, { startY:26, head:[['Médicament','Lot','Péremption','Restant']], headStyles:{fillColor:[245,158,11]}, body: d.rows.map(r=>[r.medicine?.name, r.lot_number, fmtDate(r.expiry_date), r.quantity_remaining]) });
      doc.save('peremptions.pdf');
    } catch {} setBusy('');
  }
  async function exportMargin() {
    setBusy('margin');
    try { const d = await authFetch('/pharmacy-pro/reports/margin'); alert(`Revenu: ${fmt(d.revenue)} MAD · Coût: ${fmt(d.cost)} MAD · Marge brute: ${fmt(d.margin)} MAD`); } catch {} setBusy('');
  }
  async function exportCreditsCsv() {
    setBusy('csv-credit');
    try { const d = await authFetch('/pharmacy-pro/credit/customers?limit=500'); downloadCsv(toCsv(d.customers.map(c=>[c.name,c.phone,fmt(c.credit_limit),fmt(c.balance),c.status_label]), ['Nom','Téléphone','Plafond','Solde','Statut']), 'credits-clients.csv'); } catch {} setBusy('');
  }

  const Card = ({ icon, title, desc, onClick, k }) => (
    <div style={{ background:'#fff', borderRadius:16, padding:20, border:'1px solid #E5E7EB', display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ fontSize:24 }}>{icon}</div>
      <div style={{ fontSize:14, fontWeight:700, color:'#0F172A' }}>{title}</div>
      <div style={{ fontSize:12, color:'#64748B', flex:1 }}>{desc}</div>
      <button onClick={onClick} disabled={busy===k} style={{ padding:'9px 14px', background:'#0EA5E9', border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', opacity:busy===k?.7:1 }}>{busy===k?'Génération…':'Télécharger'}</button>
    </div>
  );
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:16 }}>
      <Card icon="📄" title="Ventes par jour (PDF)" desc="Récapitulatif des ventes sur 30 jours." onClick={exportSalesPdf} k="pdf-sales" />
      <Card icon="📊" title="Ventes par médicament (Excel)" desc="Quantités et chiffre d'affaires par produit." onClick={exportMedicinesCsv} k="csv-meds" />
      <Card icon="📄" title="Produits proches péremption (PDF)" desc="Liste des lots à écouler en priorité." onClick={exportExpiringPdf} k="pdf-exp" />
      <Card icon="📈" title="Marge brute (30 jours)" desc="Revenu, coût d'achat et marge sur la période." onClick={exportMargin} k="margin" />
      <Card icon="📊" title="Crédits clients (Excel)" desc="Export de tous les comptes clients avec solde." onClick={exportCreditsCsv} k="csv-credit" />
    </div>
  );
}

/* ══ PROFIL PHARMACIE ═══════════════════════════════════════════════════ */
function ProfileTab() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast, show } = useToast();
  const set = (k,v) => setForm(p=>({ ...p, [k]:v }));
  useEffect(() => { authFetch('/pharmacy-pro/profile').then(d=>setForm(d.profile)).catch(()=>{}); }, []);

  async function uploadImg(file, field) {
    const fd = new FormData(); fd.append('image', file);
    const token = localStorage.getItem('rb_token');
    const res = await fetch(API('/pharmacy-pro/upload'), { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:fd });
    const d = await res.json();
    if (d.url) set(field, d.url);
  }
  async function save() {
    setSaving(true);
    try { await authFetch('/pharmacy-pro/profile', { method:'PATCH', body:form }); show('Profil enregistré'); } catch (e) { show(e.message,'error'); }
    setSaving(false);
  }
  function toggleService(s) { setForm(p => ({ ...p, services: (p.services||[]).includes(s) ? p.services.filter(x=>x!==s) : [...(p.services||[]), s] })); }

  if (!form) return <div style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>Chargement…</div>;
  const SERVICES = ['Livraison','Vaccination','Mesure tension artérielle','Conseil pharmaceutique','Garde de nuit','Matériel médical'];

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }} className="ph-profile-grid">
      <Toast {...toast} />
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <div style={{ background:'#fff', borderRadius:16, padding:22, border:'1px solid #E5E7EB' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:800 }}>🏥 Informations générales</h3>
          <Field label="Nom de la pharmacie" required><input value={form.name||''} onChange={e=>set('name',e.target.value)} style={inputStyle} /></Field>
          <Field label="Pharmacien responsable"><input value={form.pharmacien_responsable||''} onChange={e=>set('pharmacien_responsable',e.target.value)} style={inputStyle} /></Field>
          <Field label="N° d'agrément (optionnel)"><input value={form.license_number||''} onChange={e=>set('license_number',e.target.value)} style={inputStyle} /></Field>
          <Field label="Description"><textarea value={form.description||''} onChange={e=>set('description',e.target.value)} rows={3} style={{...inputStyle,resize:'vertical'}} /></Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Téléphone"><input value={form.phone||''} onChange={e=>set('phone',e.target.value)} style={inputStyle} /></Field>
            <Field label="WhatsApp"><input value={form.whatsapp||''} onChange={e=>set('whatsapp',e.target.value)} style={inputStyle} /></Field>
          </div>
          <Field label="Adresse"><input value={form.address||''} onChange={e=>set('address',e.target.value)} style={inputStyle} /></Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Ville"><input value={form.city||''} onChange={e=>set('city',e.target.value)} style={inputStyle} /></Field>
            <Field label="Quartier"><input value={form.district||''} onChange={e=>set('district',e.target.value)} style={inputStyle} /></Field>
          </div>
        </div>

        <div style={{ background:'#fff', borderRadius:16, padding:22, border:'1px solid #E5E7EB' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:800 }}>🕐 Horaires d'ouverture</h3>
          <HoursEditor value={form.opening_hours} onChange={v=>set('opening_hours',v)} />
        </div>

        <div style={{ background:'#fff', borderRadius:16, padding:22, border:'1px solid #E5E7EB' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:800 }}>🚑 Services</h3>
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#374151', cursor:'pointer', marginBottom:12 }}>
            <input type="checkbox" checked={!!form.accepts_delivery} onChange={e=>{ set('accepts_delivery',e.target.checked); set('delivery_available',e.target.checked); }} style={{ accentColor:'#0EA5E9' }} /> Livraison disponible
          </label>
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#374151', cursor:'pointer', marginBottom:12 }}>
            <input type="checkbox" checked={!!form.is_open_24h} onChange={e=>set('is_open_24h',e.target.checked)} style={{ accentColor:'#0EA5E9' }} /> Ouvert 24h/24
          </label>
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#374151', cursor:'pointer', marginBottom:12 }}>
            <input type="checkbox" checked={form.accepts_prescription_upload !== false} onChange={e=>set('accepts_prescription_upload',e.target.checked)} style={{ accentColor:'#0EA5E9' }} /> Accepter l'envoi d'ordonnances en ligne
          </label>
          <div style={{ fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:8 }}>Services proposés</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {SERVICES.map(s => (
              <button key={s} type="button" onClick={()=>toggleService(s)} style={{ padding:'7px 12px', borderRadius:20, border:`1.5px solid ${(form.services||[]).includes(s)?'#0EA5E9':'#E2E8F0'}`, background:(form.services||[]).includes(s)?'#F0F9FF':'#fff', color:(form.services||[]).includes(s)?'#0369A1':'#374151', cursor:'pointer', fontSize:12, fontWeight:600 }}>{s}</button>
            ))}
          </div>
        </div>

        <div style={{ background:'#fff', borderRadius:16, padding:22, border:`1.5px solid ${form.is_pharmacy_guard?'#16A34A':'#E5E7EB'}` }}>
          <h3 style={{ margin:'0 0 6px', fontSize:15, fontWeight:800 }}>⛑️ Pharmacie de garde</h3>
          <p style={{ margin:'0 0 16px', fontSize:12, color:'#94A3B8' }}>Apparaît dans "Pharmacies de garde" du marketplace uniquement pendant la plage horaire programmée.</p>
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#374151', cursor:'pointer', marginBottom:14, padding:'10px 12px', background: form.is_pharmacy_guard ? '#F0FDF4' : '#F9FAFB', borderRadius:10 }}>
            <input type="checkbox" checked={!!form.is_pharmacy_guard} onChange={e=>set('is_pharmacy_guard',e.target.checked)} style={{ accentColor:'#16A34A' }} />
            <span style={{ fontWeight:700 }}>Programmer un tour de garde</span>
          </label>
          {form.is_pharmacy_guard && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Field label="Début de garde" required><input type="datetime-local" value={form.guard_start_at ? form.guard_start_at.slice(0,16) : ''} onChange={e=>set('guard_start_at', e.target.value)} style={inputStyle} /></Field>
                <Field label="Fin de garde" required><input type="datetime-local" value={form.guard_end_at ? form.guard_end_at.slice(0,16) : ''} onChange={e=>set('guard_end_at', e.target.value)} style={inputStyle} /></Field>
              </div>
              <Field label="Secteur de garde"><input value={form.guard_area||''} onChange={e=>set('guard_area',e.target.value)} placeholder="Ex: Agdal - Hassan" style={inputStyle} /></Field>
              <Field label="Téléphone de garde (si différent)"><input value={form.guard_phone||''} onChange={e=>set('guard_phone',e.target.value)} style={inputStyle} /></Field>
            </>
          )}
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <div style={{ background:'#fff', borderRadius:16, padding:22, border:'1px solid #E5E7EB' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:800 }}>🖼️ Logo & couverture</h3>
          <Field label="Logo">
            <input type="file" accept="image/*" onChange={e=>{ const f=e.target.files[0]; if(f) uploadImg(f,'logo_url'); }} style={{ fontSize:12 }} />
            {form.logo_url && <img src={ASSET(form.logo_url)} alt="" style={{ marginTop:8, width:70, height:70, borderRadius:12, objectFit:'cover' }} />}
          </Field>
          <Field label="Photo de couverture">
            <input type="file" accept="image/*" onChange={e=>{ const f=e.target.files[0]; if(f) uploadImg(f,'cover_url'); }} style={{ fontSize:12 }} />
            {form.cover_url && <img src={ASSET(form.cover_url)} alt="" style={{ marginTop:8, width:'100%', maxWidth:240, height:90, borderRadius:12, objectFit:'cover' }} />}
          </Field>
        </div>

        <div style={{ background:'#fff', borderRadius:16, padding:22, border:'1px solid #E5E7EB' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:800 }}>📍 Localisation précise</h3>
          <GeocodingPicker
            lat={form.latitude ? parseFloat(form.latitude) : null} lng={form.longitude ? parseFloat(form.longitude) : null}
            address={form.address||''} city={form.city||''} district={form.district||''}
            formattedAddress={form.formatted_address||''} geocodingSource={form.geocoding_source||null} compact
            onUpdate={data => setForm(p => ({ ...p, latitude:data.lat, longitude:data.lng, address:data.address||p.address, city:data.city||p.city, district:data.district||p.district, formatted_address:data.formatted_address, geocoding_source:data.geocoding_source, location_verified:true }))}
          />
        </div>

        <button onClick={save} disabled={saving} style={{ padding:'14px', background:'linear-gradient(135deg,#0EA5E9,#0369A1)', border:'none', borderRadius:12, color:'#fff', fontWeight:700, fontSize:15, cursor:'pointer', opacity:saving?.7:1 }}>{saving?'Enregistrement…':'💾 Enregistrer le profil'}</button>
      </div>
    </div>
  );
}

/* ══ ONGLET COMMANDES EN LIGNE (PharmacyOrder — OTC/parapharmacie) ═══════════ */
function PharmacyOrdersTab({ socket }) {
  const { t } = useI18n();
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'list' — comme OrdersPage.jsx (resto)
  const [statusFilter, setStatusFilter] = useState('');
  const [q, setQ]               = useState('');
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const [bell, setBell]         = useState(false);
  const [updating, setUpdating] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Kanban répartit les commandes sur 4 colonnes — on récupère un lot
      // large (comme OrdersPage.jsx resto, limit:100) plutôt que la page de
      // 20 utilisée par la vue liste, sans quoi certaines colonnes
      // paraîtraient vides alors que des commandes existent page 2+.
      const qs = new URLSearchParams({ page, limit: viewMode === 'kanban' ? 100 : 20 });
      if (statusFilter) qs.set('status', statusFilter);
      if (q.trim()) qs.set('q', q.trim());
      const data = await authFetch(`/pharmacy-pro/orders?${qs}`);
      setOrders(data.orders || []);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  }, [statusFilter, q, page, viewMode]);

  useEffect(() => { load(); }, [load]);

  // Socket.IO — nouvelle commande (voir backend publicRoutes.js POST /orders
  // qui émet 'pharmacy:new_order' sur la room de l'organisation)
  useEffect(() => {
    if (!socket) return;
    const handler = () => { setBell(true); setTimeout(() => setBell(false), 4000); load(); };
    socket.on('pharmacy:new_order', handler);
    return () => socket.off('pharmacy:new_order', handler);
  }, [socket, load]);

  async function changeStatus(orderId, status) {
    setUpdating(orderId);
    try { await authFetch(`/pharmacy-pro/orders/${orderId}/status`, { method:'PATCH', body:{ status } }); load(); }
    catch (e) { alert(e.message || 'Erreur lors du changement de statut'); }
    finally { setUpdating(null); }
  }

  async function deleteOrder(orderId, orderNumber) {
    if (!window.confirm(`Supprimer définitivement la commande ${orderNumber} ? Cette action est irréversible.`)) return;
    try { await authFetch(`/pharmacy-pro/orders/${orderId}`, { method:'DELETE' }); load(); }
    catch (e) { alert(e.message || 'Erreur lors de la suppression'); }
  }

  // Carte compacte pour la vue kanban — un seul bouton "prochaine étape"
  // (getPharmacyNextAction) plutôt que le choix libre de statut de la vue
  // liste, pour rester lisible dans une colonne étroite (même compromis que
  // OrderCard dans OrdersPage.jsx côté resto).
  function KanbanCard({ o }) {
    const action = getPharmacyNextAction(o);
    return (
      <div style={{ background:'#fff', borderRadius:10, marginBottom:8, border:'1px solid #E2E8F0', boxShadow:'0 1px 4px rgba(0,0,0,.06)', overflow:'hidden' }}>
        <div style={{ height:3, background: o.delivery_type==='delivery' ? 'linear-gradient(90deg,#8B5CF6,#7C3AED)' : 'linear-gradient(90deg,#0EA5E9,#0369A1)' }} />
        <div style={{ padding:'10px 12px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:4 }}>
            <code style={{ fontSize:10, background:'#F8FAFC', padding:'1px 5px', borderRadius:4, fontWeight:700 }}>{o.order_number}</code>
            <span style={{ fontSize:10, fontWeight:700, color: o.delivery_type==='delivery' ? '#7C3AED' : '#0369A1' }}>{o.delivery_type==='delivery' ? '🛵 Livraison' : '🏪 Retrait'}</span>
          </div>
          <div style={{ fontSize:12, fontWeight:700, color:'#0F172A' }}>{o.customer_name}</div>
          <div style={{ fontSize:11, color:'#64748B', marginBottom:6 }}>{o.customer_phone}</div>
          {o.items?.length > 0 && (
            <div style={{ fontSize:11, color:'#64748B', marginBottom:8 }}>
              {o.items.map((it,i) => <span key={i}>{it.quantity}× {it.product_name}{i < o.items.length-1 ? ', ' : ''}</span>)}
            </div>
          )}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
            <span style={{ fontWeight:800, fontSize:13, color:'#0EA5E9' }}>{fmt(o.total)} MAD</span>
            <div style={{ display:'flex', gap:4 }}>
              {action && (
                <button onClick={() => changeStatus(o.id, action.next)} disabled={updating===o.id} style={{ border:'none', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer', background:'#0EA5E9', color:'#fff', opacity: updating===o.id?.6:1 }}>
                  {updating===o.id ? '…' : action.label}
                </button>
              )}
              <button onClick={() => changeStatus(o.id, 'cancelled')} disabled={updating===o.id} title="Annuler" style={{ border:'1px solid #FCA5A5', borderRadius:6, padding:'5px 8px', fontSize:11, cursor:'pointer', background:'#fff', color:'#DC2626' }}>✕</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {bell && (
        <div style={{ background:'#0EA5E9', color:'#fff', borderRadius:12, padding:'12px 18px', marginBottom:16, fontWeight:700, fontSize:14, display:'flex', alignItems:'center', gap:8 }}>
          🔔 Nouvelle commande reçue !
        </div>
      )}

      <p style={{ fontSize:12, color:'#94A3B8', marginTop:0, marginBottom:16 }}>
        Commandes passées en ligne pour des produits OTC/parapharmacie (sans ordonnance) — les demandes d'ordonnance restent dans l'onglet « Demandes ».
      </p>

      {/* Filtres + bascule Kanban/Liste */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:18 }}>
        <div style={{ display:'flex', background:'#F1F5F9', borderRadius:8, padding:3, gap:2 }}>
          {[['kanban','⬜ Kanban'],['list','☰ Liste']].map(([v,l]) => (
            <button key={v} onClick={() => setViewMode(v)} style={{ border:'none', borderRadius:6, padding:'5px 12px', fontSize:12, fontWeight:600, cursor:'pointer', background: viewMode===v ? '#fff' : 'transparent', color: viewMode===v ? '#0F172A' : '#94A3B8', boxShadow: viewMode===v ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>{l}</button>
          ))}
        </div>
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Chercher client / N° commande…" style={{ ...inputStyle, width:240 }} />
        {viewMode === 'list' && (
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ ...inputStyle, width:'auto', cursor:'pointer' }}>
            <option value="">Tous les statuts</option>
            {ORDER_STATUSES.map(s => <option key={s.v} value={s.v}>{translateOrderStatus(t, s.v)}</option>)}
          </select>
        )}
        <button onClick={load} style={{ padding:'10px 16px', border:'1.5px solid #E2E8F0', borderRadius:10, background:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>↻ Actualiser</button>
      </div>

      {loading ? <div style={{ textAlign:'center', padding:32, color:'#94A3B8' }}>Chargement…</div> : viewMode === 'kanban' ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12, alignItems:'start' }}>
          {PHARMACY_KANBAN_COLS.map(col => {
            const colOrders = orders.filter(o => o.status === col.key);
            return (
              <div key={col.key} style={{ background:col.bg, borderRadius:12, padding:'12px 10px', minHeight:120 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, paddingBottom:8, borderBottom:`2px solid ${col.dot}22` }}>
                  <span style={{ fontWeight:700, fontSize:13, color:col.color }}>{translateOrderStatus(t, col.key)}{col.key === 'ready' ? ' ✓' : ''}</span>
                  <span style={{ background:col.dot, color:'#fff', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:10 }}>{colOrders.length}</span>
                </div>
                {colOrders.length === 0
                  ? <div style={{ textAlign:'center', padding:'20px 0', color:'#CBD5E1', fontSize:12 }}>Aucune commande</div>
                  : colOrders.map(o => <KanbanCard key={o.id} o={o} />)
                }
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {orders.length === 0 && <div style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>Aucune commande</div>}
          {orders.map(o => (
            <div key={o.id} style={{ background:'#fff', borderRadius:14, border:'1px solid #E2E8F0', padding:'14px 18px', display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                <span style={{ fontWeight:800, fontSize:14, color:'#0F172A', fontFamily:'monospace' }}>{o.order_number}</span>
                <OrderBadge status={o.status} />
                <span style={{ fontSize:12, color:'#64748B', marginLeft:'auto' }}>{new Date(o.createdAt).toLocaleString('fr-FR')}</span>
              </div>
              <div style={{ fontSize:13, color:'#374151' }}>
                <strong>{o.customer_name}</strong> · {o.customer_phone}
                {o.delivery_type === 'delivery' && <span style={{ marginLeft:8, color:'#8B5CF6', fontWeight:600 }}>🛵 {o.delivery_district} {o.delivery_address}</span>}
                {o.delivery_type === 'pickup' && <span style={{ marginLeft:8, color:'#10B981', fontWeight:600 }}>🏪 Retrait</span>}
              </div>
              {o.items?.length > 0 && (
                <div style={{ fontSize:12, color:'#64748B', padding:'8px 12px', background:'#F8FAFC', borderRadius:8 }}>
                  {o.items.map((it,i) => <span key={i}>{it.quantity}× {it.product_name}{i < o.items.length-1 ? ', ' : ''}</span>)}
                </div>
              )}
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontWeight:800, fontSize:15, color:'#0EA5E9' }}>{fmt(o.total)} MAD</span>
                {o.notes && <span style={{ fontSize:11, color:'#64748B' }}>📝 {o.notes}</span>}
                <div style={{ marginLeft:'auto', display:'flex', gap:6, flexWrap:'wrap' }}>
                  {ORDER_STATUSES.filter(s => s.v !== o.status && s.v !== 'cancelled').map(s => (
                    <button key={s.v} onClick={() => changeStatus(o.id, s.v)} style={{ padding:'5px 12px', fontSize:11, fontWeight:700, border:`1.5px solid ${s.c}`, borderRadius:8, color:s.c, background:`${s.c}10`, cursor:'pointer' }}>
                      → {translateOrderStatus(t, s.v)}
                    </button>
                  ))}
                  {o.status !== 'cancelled' && <button onClick={() => changeStatus(o.id, 'cancelled')} style={{ padding:'5px 12px', fontSize:11, fontWeight:700, border:'1.5px solid #EF4444', borderRadius:8, color:'#EF4444', background:'#FEF2F2', cursor:'pointer' }}>Annuler</button>}
                  <button onClick={() => deleteOrder(o.id, o.order_number)} title="Supprimer définitivement" style={{ padding:'5px 10px', fontSize:11, fontWeight:700, border:'1.5px solid #94A3AF', borderRadius:8, color:'#64748B', background:'#F8FAFC', cursor:'pointer' }}><PremiumIcon name="trash" size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'list' && total > 20 && (
        <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:20 }}>
          {page > 1 && <button onClick={() => setPage(p=>p-1)} style={{ padding:'8px 16px', border:'1.5px solid #E2E8F0', borderRadius:8, cursor:'pointer', background:'#fff', fontWeight:600 }}>← Précédent</button>}
          <span style={{ padding:'8px 12px', fontSize:13, color:'#64748B' }}>Page {page} · {total} commande{total>1?'s':''}</span>
          {page * 20 < total && <button onClick={() => setPage(p=>p+1)} style={{ padding:'8px 16px', border:'1.5px solid #E2E8F0', borderRadius:8, cursor:'pointer', background:'#fff', fontWeight:600 }}>Suivant →</button>}
        </div>
      )}
    </div>
  );
}

export default function PharmacyDashboard() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';
  const [user, setUser] = useState(null);

  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem('rb_user') || 'null')); } catch {}
  }, []);

  // Socket.IO — récupérer l'instance globale (même pattern que HanoutDashboard)
  const [socket, setSocket] = useState(null);
  useEffect(() => {
    if (window.__socket) { setSocket(window.__socket); return; }
    const interval = setInterval(() => {
      if (window.__socket) { setSocket(window.__socket); clearInterval(interval); }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  function setTab(tab) { setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('tab', tab); return p; }); }
  const orgSlug = user?.org_slug;

  return (
    <>
      <style>{`@keyframes ph-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ minHeight:'100vh', background:'#F8FAFC' }}>
        <div style={{ background:'#fff', borderBottom:'1px solid #E2E8F0', padding:'0 clamp(12px,4vw,32px)', display:'flex', alignItems:'center', gap:12, height:60 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#0EA5E9,#0369A1)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}><PremiumIcon name="medicine" size={19} /></div>
          <div>
            <div style={{ fontWeight:800, fontSize:15, color:'#0F172A' }}>{t('business.pharmacy.dashboard_title')}</div>
            {orgSlug && <div style={{ fontSize:11, color:'#94A3B8' }}>{t('business.pharmacy.public_profile', { slug: orgSlug })}</div>}
          </div>
          {orgSlug && (
            <a href={`${window.location.origin}/ph/${orgSlug}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft:'auto', padding:'7px 14px', background:'#F0F9FF', border:'1.5px solid #BAE6FD', borderRadius:10, color:'#0369A1', textDecoration:'none', fontWeight:700, fontSize:12, flexShrink:0 }}><PremiumIcon name="eye" size={14} /> {t('business.pharmacy.view_profile')}</a>
          )}
        </div>

        <div style={{ background:'#fff', borderBottom:'1px solid #E2E8F0', padding:'0 clamp(12px,4vw,32px)', display:'flex', gap:2, overflowX:'auto' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={()=>setTab(tab.id)} style={{ padding:'10px 14px', border:'none', background:'transparent', cursor:'pointer', fontSize:12, fontWeight:700, whiteSpace:'nowrap', color: activeTab===tab.id?'#0369A1':'#64748B', borderBottom: activeTab===tab.id?'2.5px solid #0EA5E9':'2.5px solid transparent' }}>
              <DashboardIcon icon={tab.icon} size={15} /> {t(tab.labelKey)}
            </button>
          ))}
        </div>

        <div style={{ maxWidth:1300, margin:'0 auto', padding:'24px clamp(12px,4vw,32px) 60px' }}>
          {activeTab === 'dashboard'     && <DashboardTab />}
          {activeTab === 'orders'        && <PharmacyOrdersTab socket={socket} />}
          {activeTab === 'products'      && <ProductsTab />}
          {activeTab === 'lots'          && <LotsTab />}
          {activeTab === 'pos'           && <PosTab />}
          {activeTab === 'prescriptions' && <PrescriptionsTab />}
          {activeTab === 'customers'     && <CustomersTab />}
          {activeTab === 'credit'        && <PharmacyCreditModule />}
          {activeTab === 'suppliers'     && <SuppliersTab />}
          {activeTab === 'purchases'     && <PurchaseOrdersTab />}
          {activeTab === 'requests'      && <RequestsTab />}
          {activeTab === 'reports'       && <ReportsTab />}
          {activeTab === 'profile'       && <ProfileTab />}
          {activeTab === 'hero'          && <StoreHeroManagerTab />}
        </div>
      </div>
    </>
  );
}
