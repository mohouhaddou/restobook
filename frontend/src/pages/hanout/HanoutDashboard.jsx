import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../modules/auth/AuthContext';
import { API, ASSET } from '../../api';
import { HoursEditor } from '../../shared/components/ui/HoursEditor';
import { DeliveryModePicker } from '../../shared/components/ui/DeliveryModePicker';
import { GeocodingPicker } from '../../shared/components/geo/GeocodingPicker';
import CreditModule from './CreditModule';
import ProductOptionsManager from './ProductOptionsManager';
import { BarcodeInput } from '../../shared/components/ui/BarcodeInput';
import { ProductImageCapture } from '../../shared/components/ui/ProductImageCapture';
import { CatalogQuickAddModal } from '../../shared/components/catalog/CatalogQuickAddModal';
import { PERMISSIONS } from '../../modules/core/permissions';
import { StoreHeroManagerTab } from '../../shared/components/storeHero/StoreHeroManagerTab';
import { useI18n } from '../../i18n/config';
import { translateOrderStatus, translateUnit } from '../../i18n/status';
import { DashboardIcon } from '../../shared/components/ui/DashboardIcon';
import { PremiumIcon, PremiumIconBadge } from '../../shared/components/ui/PremiumIcon';

/* ══ CONSTANTES ═══════════════════════════════════════════════════════════ */
const TABS = [
  { id:'orders',    labelKey:'business.hanout.tabs.orders', icon:'🛒' },
  { id:'products',  labelKey:'business.hanout.tabs.products', icon:'📦' },
  { id:'cats',      labelKey:'business.hanout.tabs.categories',icon:'🗂️' },
  { id:'customers', labelKey:'business.hanout.tabs.customers', icon:'👥' },
  { id:'credit',    labelKey:'business.hanout.tabs.credit', icon:'💳' },
  { id:'stats',     labelKey:'business.hanout.tabs.stats', icon:'📊' },
  { id:'profile',   labelKey:'business.hanout.tabs.profile', icon:'⚙️' },
  { id:'hero',      labelKey:'business.hanout.tabs.hero', icon:'🎠' },
];

// Raccourcis vers des pages HORS de ce tableau de bord (POS physique, caisse…)
// — les vues internes (Commandes, Produits…) sont déjà à un clic via les
// onglets juste en dessous, inutile de les dupliquer ici.
const QUICK_ACCESS_ITEMS = [
  { to: '/pos',              labelKey: 'business.quick.pos',           icon: '🧾', perm: PERMISSIONS.POS_SELL },
  { to: '/pos/session',      labelKey: 'business.quick.cash_register', icon: '💰', perm: [PERMISSIONS.POS_SESSION_OPEN, PERMISSIONS.POS_SESSION_CLOSE] },
  { to: '/pos/history',      labelKey: 'business.quick.pos_history',   icon: '📜', perm: PERMISSIONS.POS_HISTORY_VIEW },
  { to: '/loyalty/settings', labelKey: 'business.quick.loyalty',       icon: '🎁', perm: [PERMISSIONS.LOYALTY_MANAGE, PERMISSIONS.HANOUT_STATS_VIEW] },
];

function QuickAccessBar({ hasPermission, hasAnyPermission }) {
  const { t } = useI18n();
  const items = QUICK_ACCESS_ITEMS.filter(item =>
    Array.isArray(item.perm) ? hasAnyPermission(item.perm) : hasPermission(item.perm)
  );
  if (items.length === 0) return null;

  return (
    <div style={{ background:'#fff', borderBottom:'1px solid #E5E7EB', padding:'14px clamp(12px,4vw,32px)' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>{t('business.quick_access')}</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
        {items.map(item => (
          <Link key={item.to} to={item.to} className="hn-quick-tile" style={{
            display:'flex', alignItems:'center', gap:8, padding:'10px 16px', borderRadius:12,
            border:'1.5px solid #E5E7EB', background:'#F9FAFB', textDecoration:'none',
            color:'#111827', fontSize:13, fontWeight:700, transition:'all .15s',
          }}>
            <DashboardIcon icon={item.icon} size={18} />{t(item.labelKey)}
          </Link>
        ))}
      </div>
    </div>
  );
}

const ORDER_STATUSES = [
  { v:'pending',   c:'#F59E0B' },
  { v:'confirmed', c:'#3B82F6' },
  { v:'preparing', c:'#8B5CF6' },
  { v:'ready',     c:'#10B981' },
  { v:'delivered', c:'#22C55E' },
  { v:'cancelled', c:'#EF4444' },
];
const statusOf = v => ORDER_STATUSES.find(s => s.v === v) || { c:'#9CA3AF' };

const UNITS = ['pièce','kg','g','l','ml','paquet','boîte','bouteille','sac'];

/* ══ UTILITAIRES ══════════════════════════════════════════════════════════ */
function authFetch(path, opts = {}) {
  const token = localStorage.getItem('rb_token');
  return fetch(API(path), {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
  });
}

function KpiCard({ icon, label, value, sub, color = '#10B981' }) {
  return (
    <div style={{ background:'#fff', borderRadius:14, padding:'18px 20px', border:'1px solid #E5E7EB', display:'flex', alignItems:'center', gap:14 }}>
      <div style={{ width:46, height:46, borderRadius:12, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><DashboardIcon icon={icon} size={22} /></div>
      <div>
        <div style={{ fontSize:22, fontWeight:800, color:'#111827' }}>{value}</div>
        <div style={{ fontSize:12, fontWeight:600, color:'#6B7280' }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:'#9CA3AF' }}>{sub}</div>}
      </div>
    </div>
  );
}

function Badge({ status }) {
  const { t } = useI18n();
  const s = statusOf(status);
  return <span style={{ fontSize:11, fontWeight:700, color:s.c, background:`${s.c}20`, padding:'3px 10px', borderRadius:20, whiteSpace:'nowrap' }}>● {translateOrderStatus(t, status)}</span>;
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:800, backdropFilter:'blur(4px)' }} />
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:801, background:'#fff', borderRadius:18, padding:'24px 26px', width:Math.min(500, window.innerWidth - 32), maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,.25)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:17, fontWeight:800 }}>{title}</h3>
          <button onClick={onClose} style={{ background:'#F3F4F6', border:'none', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:14, color:'#6B7280' }}>✕</button>
        </div>
        {children}
      </div>
    </>
  );
}

function Field({ label, children, required }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:4 }}>{label}{required && ' *'}</label>
      {children}
    </div>
  );
}

const inputStyle = { width:'100%', padding:'10px 12px', border:'1.5px solid #E5E7EB', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box' };

/* ══ ONGLET COMMANDES ═════════════════════════════════════════════════════ */
function OrdersTab({ socket }) {
  const { t } = useI18n();
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [q, setQ]               = useState('');
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const [bell, setBell]         = useState(false);
  const audioRef                = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page, limit:20 });
    if (statusFilter) qs.set('status', statusFilter);
    if (q.trim()) qs.set('q', q.trim());
    const res  = await authFetch(`/hanout-pro/orders?${qs}`);
    const data = await res.json();
    setOrders(data.orders || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [statusFilter, q, page]);

  useEffect(() => { load(); }, [load]);

  // Socket.IO — nouvelle commande
  useEffect(() => {
    if (!socket) return;
    const handler = () => { setBell(true); setTimeout(() => setBell(false), 4000); load(); };
    socket.on('hanout:new_order', handler);
    return () => socket.off('hanout:new_order', handler);
  }, [socket, load]);

  async function changeStatus(orderId, status) {
    await authFetch(`/hanout-pro/orders/${orderId}/status`, { method:'PATCH', body:{ status } });
    load();
  }

  async function deleteOrder(orderId, orderNumber) {
    if (!window.confirm(`Supprimer définitivement la commande ${orderNumber} ? Cette action est irréversible.`)) return;
    await authFetch(`/hanout-pro/orders/${orderId}`, { method:'DELETE' });
    load();
  }

  return (
    <div>
      {bell && (
        <div style={{ background:'#10B981', color:'#fff', borderRadius:12, padding:'12px 18px', marginBottom:16, fontWeight:700, fontSize:14, display:'flex', alignItems:'center', gap:8, animation:'hn-pulse 1s infinite' }}>
          Nouvelle commande reçue !
        </div>
      )}

      {/* Filtres */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:18 }}>
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Chercher client / N° commande…" style={{ ...inputStyle, width:240 }} />
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ ...inputStyle, width:'auto', cursor:'pointer' }}>
          <option value="">Tous les statuts</option>
          {ORDER_STATUSES.map(s => <option key={s.v} value={s.v}>{translateOrderStatus(t, s.v)}</option>)}
        </select>
        <button onClick={load} style={{ padding:'10px 16px', border:'1.5px solid #E5E7EB', borderRadius:10, background:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, display:'inline-flex', alignItems:'center', gap:6 }}><PremiumIcon name="refresh" size={15} />Actualiser</button>
      </div>

      {loading ? <div style={{ textAlign:'center', padding:32, color:'#9CA3AF' }}>Chargement…</div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {orders.length === 0 && <div style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>Aucune commande</div>}
          {orders.map(o => (
            <div key={o.id} style={{ background:'#fff', borderRadius:14, border:'1px solid #E5E7EB', padding:'14px 18px', display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                <span style={{ fontWeight:800, fontSize:14, color:'#111827', fontFamily:'monospace' }}>{o.order_number}</span>
                <Badge status={o.status} />
                <span style={{ fontSize:12, color:'#6B7280', marginLeft:'auto' }}>{new Date(o.createdAt).toLocaleString('fr-FR')}</span>
              </div>
              <div style={{ fontSize:13, color:'#374151' }}>
                <strong>{o.customer_name}</strong> · {o.customer_phone}
                {o.delivery_type === 'delivery' && <span style={{ marginLeft:8, color:'#8B5CF6', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}><DashboardIcon icon="🛵" size={14} />{o.delivery_district} {o.delivery_address}</span>}
                {o.delivery_type === 'pickup' && <span style={{ marginLeft:8, color:'#10B981', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}><DashboardIcon icon="🏪" size={14} />Retrait</span>}
              </div>
              {o.items?.length > 0 && (
                <div style={{ fontSize:12, color:'#6B7280', padding:'8px 12px', background:'#F9FAFB', borderRadius:8 }}>
                  {o.items.map((it,i) => <span key={i}>{it.quantity}× {it.product_name}{i < o.items.length-1 ? ', ' : ''}</span>)}
                </div>
              )}
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontWeight:800, fontSize:15, color:'#10B981' }}>{Number(o.total).toFixed(2)} MAD</span>
                {o.notes && <span style={{ fontSize:11, color:'#6B7280', display:'inline-flex', alignItems:'center', gap:4 }}><PremiumIcon name="note" size={13} />{o.notes}</span>}
                <div style={{ marginLeft:'auto', display:'flex', gap:6, flexWrap:'wrap' }}>
                  {ORDER_STATUSES.filter(s => s.v !== o.status && s.v !== 'cancelled').map(s => (
                    <button key={s.v} onClick={() => changeStatus(o.id, s.v)} style={{ padding:'5px 12px', fontSize:11, fontWeight:700, border:`1.5px solid ${s.c}`, borderRadius:8, color:s.c, background:`${s.c}10`, cursor:'pointer' }}>
                      → {translateOrderStatus(t, s.v)}
                    </button>
                  ))}
                  {o.status !== 'cancelled' && <button onClick={() => changeStatus(o.id, 'cancelled')} style={{ padding:'5px 12px', fontSize:11, fontWeight:700, border:'1.5px solid #EF4444', borderRadius:8, color:'#EF4444', background:'#FEF2F2', cursor:'pointer' }}>Annuler</button>}
                  <button onClick={() => deleteOrder(o.id, o.order_number)} title="Supprimer définitivement" style={{ padding:'5px 10px', fontSize:11, fontWeight:700, border:'1.5px solid #9CA3AF', borderRadius:8, color:'#6B7280', background:'#F9FAFB', cursor:'pointer' }}><PremiumIcon name="trash" size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 20 && (
        <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:20 }}>
          {page > 1 && <button onClick={() => setPage(p=>p-1)} style={{ padding:'8px 16px', border:'1.5px solid #E5E7EB', borderRadius:8, cursor:'pointer', background:'#fff', fontWeight:600 }}>← Précédent</button>}
          <span style={{ padding:'8px 12px', fontSize:13, color:'#6B7280' }}>Page {page} · {total} commande{total>1?'s':''}</span>
          {page * 20 < total && <button onClick={() => setPage(p=>p+1)} style={{ padding:'8px 16px', border:'1.5px solid #E5E7EB', borderRadius:8, cursor:'pointer', background:'#fff', fontWeight:600 }}>Suivant →</button>}
        </div>
      )}
    </div>
  );
}

/* ══ ONGLET PRODUITS ══════════════════════════════════════════════════════ */
function ProductsTab() {
  const { t } = useI18n();
  const [products, setProducts] = useState([]);
  const [cats, setCats]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [q, setQ]               = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');
  const [optionsProduct, setOptionsProduct] = useState(null);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const EMPTY = { name:'', price:'', compare_price:'', description:'', category_id:'', unit:'pièce', sku:'', barcode:'', stock_quantity:'', track_stock:false, available:true, images:[] };
  const [form, setForm]       = useState(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ limit:200 });
    if (q.trim()) qs.set('q', q.trim());
    const [pRes, cRes] = await Promise.all([authFetch(`/hanout-pro/products?${qs}`), authFetch('/hanout-pro/categories')]);
    const pData = await pRes.json();
    const cData = await cRes.json();
    setProducts(pData.products || []);
    setCats(cData.categories || []);
    setLoading(false);
  }, [q]);

  useEffect(() => { load(); }, [load]);

  function openNew() { setForm(EMPTY); setEditing(null); setErr(''); setModalOpen(true); }
  function openFromCatalog(prefill) { setForm({ ...EMPTY, ...prefill }); setEditing(null); setErr(''); setModalOpen(true); }
  function openEdit(p) {
    setForm({ ...p, price: p.price, compare_price: p.compare_price || '', category_id: p.category_id || '', stock_quantity: p.stock_quantity ?? '', images: p.images || [], barcode: p.barcode || '' });
    setEditing(p);
    setErr('');
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.price) { setErr('Nom et prix requis'); return; }
    setSaving(true); setErr('');
    const body = {
      ...form,
      price:          Number(form.price),
      compare_price:  form.compare_price ? Number(form.compare_price) : null,
      category_id:    form.category_id ? Number(form.category_id) : null,
      stock_quantity: form.stock_quantity !== '' ? Number(form.stock_quantity) : null,
    };
    const path   = editing ? `/hanout-pro/products/${editing.id}` : '/hanout-pro/products';
    const method = editing ? 'PUT' : 'POST';
    const res    = await authFetch(path, { method, body });
    const data   = await res.json();
    if (!res.ok) { setErr(data.error || 'Erreur'); setSaving(false); return; }
    setModalOpen(false);
    load();
    setSaving(false);
  }

  async function uploadProductImage(file) {
    const fd = new FormData();
    fd.append('image', file);
    const token = localStorage.getItem('rb_token');
    const res = await fetch(API('/hanout-pro/upload'), { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: fd });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error || "Échec de l'envoi de l'image");
    return data.url;
  }

  async function toggleAvail(p) {
    await authFetch(`/hanout-pro/products/${p.id}/toggle`, { method:'PATCH' });
    load();
  }

  async function del(p) {
    if (!confirm(`Supprimer "${p.name}" ?`)) return;
    await authFetch(`/hanout-pro/products/${p.id}`, { method:'DELETE' });
    load();
  }

  return (
    <div>
      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…" style={{ ...inputStyle, width:220 }} />
        <button onClick={openNew} style={{ padding:'10px 18px', background:'#10B981', border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer', fontSize:13 }}>+ Nouveau produit</button>
        <button onClick={() => setCatalogOpen(true)} style={{ padding:'10px 18px', background:'#fff', border:'1.5px solid #10B981', borderRadius:10, color:'#10B981', fontWeight:700, cursor:'pointer', fontSize:13 }}>📚 Depuis le catalogue</button>
      </div>

      {catalogOpen && (
        <CatalogQuickAddModal
          target="hanout"
          onClose={() => setCatalogOpen(false)}
          onOpenManualForm={openFromCatalog}
        />
      )}

      {loading ? <div style={{ textAlign:'center', padding:32, color:'#9CA3AF' }}>Chargement…</div> : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
          {products.map(p => {
            const cat = cats.find(c => c.id === p.category_id);
            return (
              <div key={p.id} style={{ background:'#fff', borderRadius:14, border:'1px solid #E5E7EB', overflow:'hidden', display:'flex', flexDirection:'column' }}>
                {/* Thumbnail */}
                <div style={{ height:110, background:'#F9FAFB', flexShrink:0, position:'relative' }}>
                  {Array.isArray(p.images) && p.images[0]
                    ? <img src={ASSET(p.images[0])} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}><PremiumIconBadge name="cart" size={24} /></div>
                  }
                  <span style={{ position:'absolute', top:6, right:6, fontSize:11, fontWeight:700, color: p.available ? '#10B981' : '#EF4444', background: p.available ? '#F0FDF4' : '#FEF2F2', padding:'2px 7px', borderRadius:8, border:`1px solid ${p.available?'#A7F3D0':'#FECACA'}` }}>{p.available ? 'Disponible' : 'Indisponible'}</span>
                </div>
                <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:14, color:'#111827' }}>{p.name}</div>
                    {cat && <div style={{ fontSize:11, color:'#6B7280', display:'flex', alignItems:'center', gap:4 }}><DashboardIcon icon={cat.icon || '📦'} size={13} />{cat.name}</div>}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontWeight:800, color:'#10B981' }}>{Number(p.price).toFixed(2)} MAD</span>
                  <span style={{ fontSize:11, color:'#9CA3AF' }}>/{translateUnit(t, p.unit)}</span>
                  {p.track_stock && <span style={{ fontSize:11, color:'#F59E0B', marginLeft:'auto' }}>Stock : {p.stock_quantity ?? '∞'}</span>}
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <button onClick={() => openEdit(p)} style={{ flex:1, padding:'6px', border:'1.5px solid #E5E7EB', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:12, fontWeight:600 }}><PremiumIcon name="edit" size={13} /> Modifier</button>
                  <button onClick={() => setOptionsProduct(p)} style={{ flex:1, padding:'6px', border:'1.5px solid #6366F1', borderRadius:8, background:'#EEF2FF', cursor:'pointer', fontSize:12, fontWeight:600, color:'#6366F1' }}><PremiumIcon name="settings" size={13} /> Options</button>
                  <button onClick={() => toggleAvail(p)} style={{ padding:'6px 10px', border:`1.5px solid ${p.available?'#EF4444':'#10B981'}`, borderRadius:8, background:'#fff', cursor:'pointer', fontSize:12, fontWeight:600, color: p.available?'#EF4444':'#10B981' }}>{p.available?'⏸':'▶'}</button>
                  <button onClick={() => del(p)} style={{ padding:'6px 10px', border:'1.5px solid #FCA5A5', borderRadius:8, background:'#FEF2F2', cursor:'pointer', fontSize:12, color:'#EF4444' }}><PremiumIcon name="trash" size={14} /></button>
                </div>
                {optionsProduct?.id === p.id && (
                  <ProductOptionsManager productId={p.id} productName={p.name} onClose={() => setOptionsProduct(null)} />
                )}
                </div>
              </div>
            );
          })}
          {products.length === 0 && <div style={{ gridColumn:'1/-1', textAlign:'center', padding:40, color:'#9CA3AF' }}>Aucun produit. Créez votre premier produit !</div>}
        </div>
      )}

      <Modal open={modalOpen} title={editing ? 'Modifier le produit' : 'Nouveau produit'} onClose={() => setModalOpen(false)}>
        {err && <div style={{ marginBottom:14, padding:'10px 14px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, color:'#DC2626', fontSize:13 }}>{err}</div>}

        <Field label="Nom" required><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} style={inputStyle} /></Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Prix (MAD)" required><input type="number" min="0" step="0.01" value={form.price} onChange={e=>setForm(p=>({...p,price:e.target.value}))} style={inputStyle} /></Field>
          <Field label="Prix barré"><input type="number" min="0" step="0.01" value={form.compare_price} onChange={e=>setForm(p=>({...p,compare_price:e.target.value}))} style={inputStyle} /></Field>
        </div>
        <Field label="Unité">
          <select value={form.unit} onChange={e=>setForm(p=>({...p,unit:e.target.value}))} style={{ ...inputStyle, cursor:'pointer' }}>
            {UNITS.map(u=><option key={u} value={u}>{translateUnit(t, u)}</option>)}
          </select>
        </Field>
        <Field label="Catégorie">
          <select value={form.category_id} onChange={e=>setForm(p=>({...p,category_id:e.target.value}))} style={{ ...inputStyle, cursor:'pointer' }}>
            <option value="">Sans catégorie</option>
            {cats.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </Field>
        <Field label="Description"><textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} rows={2} style={{ ...inputStyle, resize:'none' }} /></Field>
        <Field label="SKU / Référence"><input value={form.sku} onChange={e=>setForm(p=>({...p,sku:e.target.value}))} style={inputStyle} /></Field>
        <Field label="Code-barres">
          <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
            <div style={{ flex:1 }}>
              <BarcodeInput
                value={form.barcode}
                onChange={v => setForm(p => ({ ...p, barcode: v }))}
                onDetected={v => setForm(p => ({ ...p, barcode: v }))}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ fontSize:11, color:'#9CA3AF', marginTop:4 }}>Le code-barres sera utilisé pour l'ajout rapide et la vente POS. Laissez vide si le produit n'en a pas.</div>
        </Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, fontWeight:600, color:'#374151' }}>
            <input type="checkbox" checked={form.track_stock} onChange={e=>setForm(p=>({...p,track_stock:e.target.checked}))} /> Gérer le stock
          </label>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, fontWeight:600, color:'#374151' }}>
            <input type="checkbox" checked={form.available} onChange={e=>setForm(p=>({...p,available:e.target.checked}))} /> Disponible
          </label>
        </div>
        {form.track_stock && <Field label="Quantité en stock"><input type="number" min="0" value={form.stock_quantity} onChange={e=>setForm(p=>({...p,stock_quantity:e.target.value}))} style={inputStyle} /></Field>}

        <Field label="Image du produit">
          {form.images?.[0] && (
            <div style={{ position:'relative', flexShrink:0, width:72, marginBottom:10 }}>
              <img src={ASSET(form.images[0])} alt="" style={{ width:72, height:72, objectFit:'cover', borderRadius:10, border:'1.5px solid #E5E7EB' }} />
              <button onClick={() => setForm(p=>({...p, images:[]}))} style={{ position:'absolute', top:-6, right:-6, width:18, height:18, borderRadius:'50%', background:'#EF4444', border:'none', color:'#fff', fontSize:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>✕</button>
            </div>
          )}
          <ProductImageCapture accentColor="#10B981" uploadFn={uploadProductImage} onImageReady={url => setForm(p => ({ ...p, images: [url] }))} />
        </Field>

        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button onClick={() => setModalOpen(false)} style={{ flex:1, padding:'11px', border:'1.5px solid #E5E7EB', borderRadius:10, background:'#fff', cursor:'pointer', fontWeight:600, fontSize:14 }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ flex:2, padding:'11px', background:'linear-gradient(135deg,#10B981,#059669)', border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:14, cursor:saving?'default':'pointer', opacity:saving?.7:1 }}>
            {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer le produit'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ══ ONGLET CATÉGORIES ════════════════════════════════════════════════════ */
function CatsTab() {
  const [cats, setCats]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState({ name:'', icon:'', sort_order:0 });
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await authFetch('/hanout-pro/categories');
    const data = await res.json();
    setCats(data.categories || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() { setForm({ name:'', icon:'', sort_order: cats.length }); setEditing(null); setErr(''); setModalOpen(true); }
  function openEdit(c) { setForm({ name:c.name, icon:c.icon||'', sort_order:c.sort_order }); setEditing(c); setErr(''); setModalOpen(true); }

  async function save() {
    if (!form.name.trim()) { setErr('Nom requis'); return; }
    setSaving(true); setErr('');
    const body = { name:form.name.trim(), icon:form.icon.trim()||null, sort_order:Number(form.sort_order||0) };
    const path   = editing ? `/hanout-pro/categories/${editing.id}` : '/hanout-pro/categories';
    const method = editing ? 'PUT' : 'POST';
    const res    = await authFetch(path, { method, body });
    if (!res.ok) { const d = await res.json(); setErr(d.error || 'Erreur'); setSaving(false); return; }
    setModalOpen(false); load(); setSaving(false);
  }

  async function del(c) {
    if (!confirm(`Supprimer "${c.name}" ? Les produits seront désassociés.`)) return;
    await authFetch(`/hanout-pro/categories/${c.id}`, { method:'DELETE' });
    load();
  }

  return (
    <div>
      <div style={{ marginBottom:18 }}>
        <button onClick={openNew} style={{ padding:'10px 18px', background:'#10B981', border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer', fontSize:13 }}>+ Nouvelle catégorie</button>
      </div>

      {loading ? <div style={{ textAlign:'center', padding:32, color:'#9CA3AF' }}>Chargement…</div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {cats.map(c => (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:12, background:'#fff', borderRadius:12, padding:'12px 16px', border:'1px solid #E5E7EB' }}>
              <DashboardIcon icon={c.icon || '📦'} size={22} />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:14, color:'#111827' }}>{c.name}</div>
                <div style={{ fontSize:11, color:'#9CA3AF' }}>Ordre : {c.sort_order} · {c.active ? 'Active' : 'Inactive'}</div>
              </div>
              <button onClick={() => openEdit(c)} style={{ padding:'6px 12px', border:'1.5px solid #E5E7EB', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:12, fontWeight:600 }}><PremiumIcon name="edit" size={14} /></button>
              <button onClick={() => del(c)} style={{ padding:'6px 10px', border:'1.5px solid #FCA5A5', borderRadius:8, background:'#FEF2F2', cursor:'pointer', fontSize:12, color:'#EF4444' }}><PremiumIcon name="trash" size={14} /></button>
            </div>
          ))}
          {cats.length === 0 && <div style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>Aucune catégorie. Créez-en une !</div>}
        </div>
      )}

      <Modal open={modalOpen} title={editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'} onClose={() => setModalOpen(false)}>
        {err && <div style={{ marginBottom:14, padding:'10px 14px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, color:'#DC2626', fontSize:13 }}>{err}</div>}
        <Field label="Emoji / Icône"><input value={form.icon} onChange={e=>setForm(p=>({...p,icon:e.target.value}))} placeholder="🥤" maxLength={8} style={inputStyle} /></Field>
        <Field label="Nom" required><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} style={inputStyle} /></Field>
        <Field label="Ordre d'affichage"><input type="number" min="0" value={form.sort_order} onChange={e=>setForm(p=>({...p,sort_order:e.target.value}))} style={inputStyle} /></Field>
        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button onClick={() => setModalOpen(false)} style={{ flex:1, padding:'11px', border:'1.5px solid #E5E7EB', borderRadius:10, background:'#fff', cursor:'pointer', fontWeight:600, fontSize:14 }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ flex:2, padding:'11px', background:'linear-gradient(135deg,#10B981,#059669)', border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', opacity:saving?.7:1 }}>
            {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ══ ONGLET CLIENTS ═══════════════════════════════════════════════════════ */
function CustomersTab() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    authFetch('/hanout-pro/customers')
      .then(r => r.json())
      .then(d => { setCustomers(d.customers || []); setLoading(false); });
  }, []);

  return (
    <div>
      {loading ? <div style={{ textAlign:'center', padding:32, color:'#9CA3AF' }}>Chargement…</div> : (
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E5E7EB', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#F9FAFB', borderBottom:'1px solid #E5E7EB' }}>
                {['Client','Téléphone','Commandes','Total dépensé','Dernière commande'].map(h => (
                  <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontWeight:700, color:'#6B7280', fontSize:11, textTransform:'uppercase', letterSpacing:'.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <tr key={i} style={{ borderBottom:'1px solid #F3F4F6', transition:'background .1s' }}>
                  <td style={{ padding:'11px 14px', fontWeight:600, color:'#111827' }}>{c.customer_name}</td>
                  <td style={{ padding:'11px 14px', color:'#374151' }}><a href={`tel:${c.customer_phone}`} style={{ color:'#10B981', textDecoration:'none' }}>{c.customer_phone}</a></td>
                  <td style={{ padding:'11px 14px', fontWeight:700, color:'#111827' }}>{c.dataValues?.order_count || c.order_count || 0}</td>
                  <td style={{ padding:'11px 14px', fontWeight:700, color:'#10B981' }}>{Number(c.dataValues?.total_spent || c.total_spent || 0).toFixed(2)} MAD</td>
                  <td style={{ padding:'11px 14px', color:'#6B7280' }}>{new Date(c.dataValues?.last_order_at || c.last_order_at).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
              {customers.length === 0 && <tr><td colSpan={5} style={{ padding:40, textAlign:'center', color:'#9CA3AF' }}>Aucun client pour l'instant</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ══ ONGLET STATISTIQUES ══════════════════════════════════════════════════ */
function StatsTab() {
  const { t } = useI18n();
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch('/hanout-pro/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); });
  }, []);

  if (loading) return <div style={{ textAlign:'center', padding:32, color:'#9CA3AF' }}>Chargement…</div>;
  if (!stats) return null;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      {/* KPI Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14 }}>
        <KpiCard icon="🛒" label="Commandes (tout)" value={stats.all_time.orders} sub={`${stats.all_time.revenue.toFixed(2)} MAD CA`} color="#10B981" />
        <KpiCard icon="📅" label="Aujourd'hui" value={stats.today.orders} sub={`${stats.today.revenue.toFixed(2)} MAD`} color="#3B82F6" />
        <KpiCard icon="📆" label="Ce mois" value={stats.month.orders} sub={`${stats.month.revenue.toFixed(2)} MAD`} color="#8B5CF6" />
        <KpiCard icon="📦" label="Produits" value={stats.product_count} sub={`${stats.available_count} disponibles`} color="#F59E0B" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        {/* Commandes par statut */}
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E5E7EB', padding:'18px 20px' }}>
          <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:800, color:'#111827' }}>Par statut</h3>
          {stats.by_status.map(row => {
            const s = ORDER_STATUSES.find(x => x.v === row.status) || { c:'#9CA3AF' };
            return (
              <div key={row.status} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:s.c, flexShrink:0 }} />
                <div style={{ flex:1, fontSize:13, color:'#374151' }}>{translateOrderStatus(t, row.status)}</div>
                <div style={{ fontWeight:700, fontSize:14, color:'#111827' }}>{row.count}</div>
              </div>
            );
          })}
          {stats.by_status.length === 0 && <div style={{ color:'#9CA3AF', fontSize:13 }}>Aucune commande</div>}
        </div>

        {/* Top produits */}
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E5E7EB', padding:'18px 20px' }}>
          <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:800, color:'#111827' }}>Top 10 produits</h3>
          {stats.top_products.map((p, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', minWidth:18 }}>#{i+1}</span>
              <div style={{ flex:1, fontSize:12, color:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
              <span style={{ fontSize:12, fontWeight:700, color:'#111827', flexShrink:0 }}>{p.qty}×</span>
              <span style={{ fontSize:11, color:'#10B981', flexShrink:0 }}>{p.revenue.toFixed(0)} MAD</span>
            </div>
          ))}
          {stats.top_products.length === 0 && <div style={{ color:'#9CA3AF', fontSize:13 }}>Aucune vente</div>}
        </div>
      </div>
    </div>
  );
}

/* ══ ONGLET PROFIL ════════════════════════════════════════════════════════ */
function ProfileTab() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState(null);
  const [form, setForm]       = useState({});

  useEffect(() => {
    authFetch('/hanout-pro/profile')
      .then(r => r.json())
      .then(d => {
        setProfile(d.profile || {});
        setForm(d.profile || {});
        setLoading(false);
      });
  }, []);

  async function uploadImg(file, field) {
    const fd  = new FormData();
    fd.append('image', file);
    const token = localStorage.getItem('rb_token');
    const res   = await fetch(API('/hanout-pro/upload'), { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:fd });
    const data  = await res.json();
    if (data.url) setForm(p => ({ ...p, [field]: data.url }));
  }

  async function save() {
    setSaving(true); setMsg(null);
    const res = await authFetch('/hanout-pro/profile', { method:'PATCH', body: form });
    const d   = await res.json();
    if (res.ok) { setMsg({ type:'ok', text:'Profil enregistré ✓' }); setProfile({ ...profile, ...form }); }
    else        setMsg({ type:'err', text: d.error || 'Erreur lors de la sauvegarde' });
    setSaving(false);
  }

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>Chargement…</div>;

  const imgInput = (field, label, ratio) => (
    <div>
      <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>{label}</div>
      <div style={{ position:'relative', borderRadius:14, overflow:'hidden', background:'#F3F4F6', border:`2px dashed ${form[field]?'#10B981':'#D1D5DB'}`, cursor:'pointer', marginBottom:10, aspectRatio:ratio, display:'flex', alignItems:'center', justifyContent:'center' }}
        onClick={() => document.getElementById(`upload-${field}`).click()}>
        {form[field]
          ? <img src={ASSET(form[field])} alt={label} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
          : <div style={{ textAlign:'center', padding:20, color:'#9CA3AF' }}>
              <PremiumIconBadge name="camera" size={22} style={{ margin:'0 auto 6px' }} />
              <div style={{ fontSize:12, fontWeight:600 }}>Cliquer pour ajouter</div>
              <div style={{ fontSize:11 }}>JPG, PNG, WebP · max 5 Mo</div>
            </div>
        }
        {form[field] && (
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0)', display:'flex', alignItems:'center', justifyContent:'center', transition:'background .2s' }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(0,0,0,.45)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(0,0,0,0)'}>
            <span style={{ color:'#fff', fontWeight:700, fontSize:13, pointerEvents:'none', opacity:0, transition:'opacity .2s' }}
              ref={el => { if(el) { el.parentElement.onmouseenter = () => { el.style.opacity=1; el.parentElement.style.background='rgba(0,0,0,.45)'; }; el.parentElement.onmouseleave = () => { el.style.opacity=0; el.parentElement.style.background='rgba(0,0,0,0)'; }; } }}>
              Changer l'image
            </span>
          </div>
        )}
      </div>
      <input id={`upload-${field}`} type="file" accept="image/*" style={{ display:'none' }}
        onChange={e => { const f=e.target.files[0]; if(f) uploadImg(f, field); e.target.value=''; }} />
      {form[field] && (
        <button onClick={() => set(field, '')} style={{ fontSize:11, color:'#EF4444', background:'none', border:'none', cursor:'pointer', padding:0 }}>✕ Supprimer</button>
      )}
    </div>
  );

  return (
    <div className="hn-profile-grid" style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)', gap:24, alignItems:'start' }}>

      {/* Colonne gauche — Images */}
      <div style={{ background:'#fff', borderRadius:16, padding:24, border:'1px solid #E5E7EB', display:'flex', flexDirection:'column', gap:22 }}>
        <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:'#111827', display:'flex', alignItems:'center', gap:8 }}><PremiumIcon name="image" size={17} />Images</h3>

        {/* Cover */}
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>Photo de couverture <span style={{ fontWeight:400, color:'#9CA3AF' }}>(bannière principale)</span></div>
          <div style={{ position:'relative', borderRadius:14, overflow:'hidden', background:'#F3F4F6', border:`2px dashed ${form.cover_url?'#10B981':'#D1D5DB'}`, cursor:'pointer', aspectRatio:'16/5', display:'flex', alignItems:'center', justifyContent:'center' }}
            onClick={() => document.getElementById('upload-cover_url').click()}>
            {form.cover_url
              ? <img src={ASSET(form.cover_url)} alt="Cover" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
              : <div style={{ textAlign:'center', padding:20, color:'#9CA3AF' }}>
                  <PremiumIconBadge name="image" size={22} style={{ margin:'0 auto 6px' }} />
                  <div style={{ fontSize:12, fontWeight:600 }}>Bannière du hanout</div>
                  <div style={{ fontSize:11 }}>Format recommandé : 1200 × 400 px</div>
                </div>
            }
            <div style={{ position:'absolute', top:8, right:8 }}>
              <span style={{ background:'rgba(0,0,0,.5)', color:'#fff', fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:20, backdropFilter:'blur(4px)' }}>Modifier</span>
            </div>
          </div>
          <input id="upload-cover_url" type="file" accept="image/*" style={{ display:'none' }}
            onChange={e => { const f=e.target.files[0]; if(f) uploadImg(f,'cover_url'); e.target.value=''; }} />
          {form.cover_url && <button onClick={() => set('cover_url','')} style={{ fontSize:11, color:'#EF4444', background:'none', border:'none', cursor:'pointer', padding:'4px 0', display:'block' }}>✕ Supprimer la cover</button>}
        </div>

        {/* Logo */}
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>Logo <span style={{ fontWeight:400, color:'#9CA3AF' }}>(icône ronde sur la marketplace)</span></div>
          <div style={{ display:'flex', gap:16, alignItems:'center' }}>
            <div style={{ width:110, height:110, borderRadius:18, overflow:'hidden', background:'#F3F4F6', border:`2px dashed ${form.logo_url?'#10B981':'#D1D5DB'}`, flexShrink:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
              onClick={() => document.getElementById('upload-logo_url').click()}>
              {form.logo_url
                ? <img src={ASSET(form.logo_url)} alt="Logo" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                : <div style={{ textAlign:'center', padding:10, color:'#9CA3AF' }}>
                    <PremiumIcon name="store" size={24} />
                    <div style={{ fontSize:10, marginTop:4 }}>Logo</div>
                  </div>
              }
            </div>
            <div>
              <div style={{ fontSize:12, color:'#6B7280', marginBottom:8 }}>Format carré recommandé.<br/>Min. 200 × 200 px, max 5 Mo.</div>
              <button onClick={() => document.getElementById('upload-logo_url').click()}
                style={{ padding:'8px 16px', background:'#10B981', border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                Choisir un logo
              </button>
              {form.logo_url && <button onClick={() => set('logo_url','')} style={{ display:'block', marginTop:6, fontSize:11, color:'#EF4444', background:'none', border:'none', cursor:'pointer', padding:0 }}>✕ Supprimer</button>}
            </div>
          </div>
          <input id="upload-logo_url" type="file" accept="image/*" style={{ display:'none' }}
            onChange={e => { const f=e.target.files[0]; if(f) uploadImg(f,'logo_url'); e.target.value=''; }} />
        </div>

        {/* Aperçu carte marketplace */}
        {(form.logo_url || form.cover_url || form.name) && (
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>Aperçu carte marketplace</div>
            <div style={{ borderRadius:14, overflow:'hidden', border:'1px solid #E5E7EB', boxShadow:'0 4px 16px rgba(0,0,0,.08)', maxWidth:280 }}>
              <div style={{ position:'relative', height:120, background:'linear-gradient(135deg,#10B98120,#10B98140)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {form.cover_url
                  ? <img src={ASSET(form.cover_url)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0 }} />
                  : <PremiumIcon name="store" size={36} />
                }
                {form.logo_url && <img src={ASSET(form.logo_url)} alt="" style={{ position:'absolute', bottom:-18, left:12, width:44, height:44, borderRadius:12, objectFit:'cover', border:'3px solid #fff', boxShadow:'0 2px 8px rgba(0,0,0,.15)' }} />}
              </div>
              <div style={{ padding: form.logo_url ? '26px 12px 12px' : '12px' }}>
                <div style={{ fontWeight:800, fontSize:14, color:'#111827' }}>{form.name || 'Nom du hanout'}</div>
                <div style={{ fontSize:12, color:'#6B7280', marginTop:2, display:'flex', alignItems:'center', gap:4 }}><PremiumIcon name="store" size={13} />Hanout</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Colonne droite — Infos */}
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <div style={{ background:'#fff', borderRadius:16, padding:24, border:'1px solid #E5E7EB' }}>
          <h3 style={{ margin:'0 0 18px', fontSize:15, fontWeight:800, color:'#111827', display:'flex', alignItems:'center', gap:8 }}><PremiumIcon name="clipboard" size={17} />Informations générales</h3>

          {msg && (
            <div style={{ marginBottom:16, padding:'10px 14px', borderRadius:10, background:msg.type==='ok'?'#F0FDF4':'#FEF2F2', border:`1px solid ${msg.type==='ok'?'#A7F3D0':'#FECACA'}`, color:msg.type==='ok'?'#059669':'#DC2626', fontSize:13, fontWeight:600 }}>
              {msg.text}
            </div>
          )}

          <Field label="Nom du hanout" required>
            <input value={form.name||''} onChange={e=>set('name',e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Description">
            <textarea value={form.description||''} onChange={e=>set('description',e.target.value)} rows={3} style={{ ...inputStyle, resize:'vertical' }} />
          </Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Téléphone"><input value={form.phone||''} onChange={e=>set('phone',e.target.value)} style={inputStyle} /></Field>
            <Field label="Email"><input type="email" value={form.email||''} onChange={e=>set('email',e.target.value)} style={inputStyle} /></Field>
          </div>
          <Field label="WhatsApp"><input value={form.whatsapp||''} onChange={e=>set('whatsapp',e.target.value)} placeholder="+212 6 …" style={inputStyle} /></Field>
          <Field label="Adresse"><input value={form.address||''} onChange={e=>set('address',e.target.value)} style={inputStyle} /></Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Ville"><input value={form.city||''} onChange={e=>set('city',e.target.value)} style={inputStyle} /></Field>
            <Field label="Quartier"><input value={form.district||''} onChange={e=>set('district',e.target.value)} style={inputStyle} /></Field>
          </div>
        </div>

        <div style={{ background:'#fff', borderRadius:16, padding:24, border:'1px solid #E5E7EB' }}>
          <h3 style={{ margin:'0 0 18px', fontSize:15, fontWeight:800, color:'#111827', display:'flex', alignItems:'center', gap:8 }}><PremiumIcon name="mapPin" size={17} />Localisation précise</h3>
          <GeocodingPicker
            lat={form.latitude ? parseFloat(form.latitude) : null}
            lng={form.longitude ? parseFloat(form.longitude) : null}
            address={form.address || ''}
            city={form.city || ''}
            district={form.district || ''}
            formattedAddress={form.formatted_address || ''}
            geocodingSource={form.geocoding_source || null}
            compact
            onUpdate={data => setForm(p => ({
              ...p,
              latitude:          data.lat,
              longitude:         data.lng,
              address:           data.address  || p.address,
              city:              data.city     || p.city,
              district:          data.district || p.district,
              formatted_address: data.formatted_address,
              geocoding_source:  data.geocoding_source,
              location_verified: true,
            }))}
          />
        </div>

        <div style={{ background:'#fff', borderRadius:16, padding:24, border:'1px solid #E5E7EB' }}>
          <h3 style={{ margin:'0 0 18px', fontSize:15, fontWeight:800, color:'#111827', display:'flex', alignItems:'center', gap:8 }}><PremiumIcon name="clock" size={17} />Horaires d'ouverture</h3>
          <HoursEditor value={form.opening_hours} onChange={v => set('opening_hours', v)} />
        </div>

        <div style={{ background:'#fff', borderRadius:16, padding:24, border:'1px solid #E5E7EB' }}>
          <h3 style={{ margin:'0 0 18px', fontSize:15, fontWeight:800, color:'#111827', display:'flex', alignItems:'center', gap:8 }}><PremiumIcon name="delivery" size={17} />Services & livraison</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
            {[['accepts_delivery','Livraison à domicile','🛵'],['accepts_takeaway','À emporter','🏃'],['accepts_dine_in','Sur place','🪑']].map(([k,l,ic]) => (
              <label key={k} style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', padding:'10px 14px', borderRadius:12, border:`1.5px solid ${form[k]?'#10B981':'#E5E7EB'}`, background:form[k]?'#F0FDF4':'transparent', transition:'all .15s' }}>
                <input type="checkbox" checked={!!form[k]} onChange={e=>set(k,e.target.checked)} style={{ accentColor:'#10B981', width:16, height:16 }} />
                <DashboardIcon icon={ic} size={16} /><span style={{ fontSize:14, fontWeight:600, color:'#374151' }}>{l}</span>
              </label>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <Field label="Frais livraison (MAD)"><input type="number" min="0" step="0.5" value={form.delivery_fee||0} onChange={e=>set('delivery_fee',e.target.value)} style={inputStyle} /></Field>
            <Field label="Commande min. (MAD)"><input type="number" min="0" value={form.min_order_amount||0} onChange={e=>set('min_order_amount',e.target.value)} style={inputStyle} /></Field>
            <Field label="Préparation (min)"><input type="number" min="1" max="180" value={form.avg_prep_time||15} onChange={e=>set('avg_prep_time',e.target.value)} style={inputStyle} /></Field>
          </div>
          {form.accepts_delivery && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Attribution des livraisons</div>
              <DeliveryModePicker value={form.delivery_mode} onChange={v => set('delivery_mode', v)} />
            </div>
          )}
        </div>

        <button onClick={save} disabled={saving}
          style={{ padding:'14px', background:'linear-gradient(135deg,#10B981,#059669)', border:'none', borderRadius:12, color:'#fff', fontWeight:700, fontSize:15, cursor:saving?'default':'pointer', opacity:saving?.7:1, boxShadow:'0 6px 20px rgba(16,185,129,.3)', transition:'all .2s' }}>
          {saving ? 'Enregistrement…' : <><PremiumIcon name="save" size={16} /> Enregistrer le profil</>}
        </button>
      </div>
    </div>
  );
}

/* ══ DASHBOARD PRINCIPAL ══════════════════════════════════════════════════ */
export default function HanoutDashboard() {
  const { t } = useI18n();
  const navigate     = useNavigate();
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab    = searchParams.get('tab') || 'orders';

  // Socket.IO — récupérer l'instance globale
  const [socket, setSocket] = useState(null);
  useEffect(() => {
    if (window.__socket) { setSocket(window.__socket); return; }
    const interval = setInterval(() => {
      if (window.__socket) { setSocket(window.__socket); clearInterval(interval); }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  function setTab(tab) {
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('tab', tab); return p; });
  }

  const orgSlug = user?.org_slug;

  return (
    <>
      <style>{`
        @keyframes hn-pulse { 0%,100%{opacity:1} 50%{opacity:.75} }
        .hn-tab-btn { padding: 9px 16px; border: none; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all .15s; background: transparent; color: #6B7280; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
        .hn-tab-btn.active { background: #F0FDF4; color: #059669; }
        .hn-tab-btn:hover:not(.active) { background: #F9FAFB; color: #374151; }
        .hn-quick-tile:hover { border-color: #10B981; background: #F0FDF4; color: #059669; }
        .hn-quick-tile:active { transform: scale(.96); }
        @media (max-width: 768px) { .hn-profile-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      <div style={{ minHeight:'100vh', background:'#F9FAFB' }}>
        {/* Header */}
        <div style={{ background:'#fff', borderBottom:'1px solid #E5E7EB', padding:'0 clamp(12px,4vw,32px)', display:'flex', alignItems:'center', gap:12, height:60 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#10B981,#059669)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}><PremiumIcon name="store" size={19} /></div>
          <div>
            <div style={{ fontWeight:800, fontSize:15, color:'#111827' }}>{t('business.hanout.dashboard_title')}</div>
            {orgSlug && <div style={{ fontSize:11, color:'#9CA3AF' }}>{t('business.hanout.client_link', { slug: orgSlug })}</div>}
          </div>
          {orgSlug && (
            <a href={`${window.location.origin}/h/${orgSlug}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft:'auto', padding:'7px 14px', background:'#F0FDF4', border:'1.5px solid #A7F3D0', borderRadius:10, color:'#059669', textDecoration:'none', fontWeight:700, fontSize:12, flexShrink:0 }}>
              <PremiumIcon name="eye" size={14} /> {t('business.hanout.view_page')}
            </a>
          )}
        </div>

        {/* Accès rapide — toujours visible, avant les onglets */}
        <QuickAccessBar hasPermission={hasPermission} hasAnyPermission={hasAnyPermission} />

        {/* Onglets */}
        <div style={{ background:'#fff', borderBottom:'1px solid #E5E7EB', padding:'0 clamp(12px,4vw,32px)', display:'flex', gap:4, overflowX:'auto' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setTab(tab.id)} className={`hn-tab-btn${activeTab===tab.id?' active':''}`}>
              <DashboardIcon icon={tab.icon} size={16} />{t(tab.labelKey)}
            </button>
          ))}
        </div>

        {/* Contenu */}
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'24px clamp(12px,4vw,32px) 60px' }}>
          {activeTab === 'orders'    && <OrdersTab    socket={socket} />}
          {activeTab === 'products'  && <ProductsTab />}
          {activeTab === 'cats'      && <CatsTab />}
          {activeTab === 'customers' && <CustomersTab />}
          {activeTab === 'credit'    && <CreditModule />}
          {activeTab === 'stats'     && <StatsTab />}
          {activeTab === 'profile'   && <ProfileTab />}
          {activeTab === 'hero'      && <StoreHeroManagerTab />}
        </div>
      </div>
    </>
  );
}
