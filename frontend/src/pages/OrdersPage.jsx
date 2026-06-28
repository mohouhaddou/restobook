import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { EmptyState } from '../components/ui/EmptyState';
import { Toast } from '../components/ui/Toast';

function today() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Colonnes kanban communes
const KANBAN_COLS = [
  { key: 'pending',   label: 'En attente',     color: '#6B7280', bg: '#F9FAFB', dot: '#9CA3AF' },
  { key: 'confirmed', label: 'Confirmée',       color: '#2563EB', bg: '#EFF6FF', dot: '#3B82F6' },
  { key: 'preparing', label: 'En préparation',  color: '#FF8A00', bg: '#FFF7ED', dot: '#FF5D00' },
  { key: 'ready',     label: 'Prête ✓',         color: '#16A34A', bg: '#F0FDF4', dot: '#22C55E' },
];

const STATUS_LABELS = {
  pending:    'En attente',
  confirmed:  'Confirmée',
  preparing:  'En préparation',
  ready:      'Prête',
  picked_up:  'Récupérée',
  on_the_way: 'En livraison',
  delivered:  'Terminée',
  cancelled:  'Annulée',
};

const STATUS_BADGE = {
  pending:    'rb-badge--gray',
  confirmed:  'rb-badge--blue',
  preparing:  'rb-badge--orange',
  ready:      'rb-badge--green',
  picked_up:  'rb-badge--green',
  on_the_way: 'rb-badge--blue',
  delivered:  'rb-badge--green',
  cancelled:  'rb-badge--red',
};

// Transition de statut selon le parcours
function getNextAction(order) {
  const src  = order.order_source;
  const type = order.type;
  const s    = order.status;
  if (s === 'pending')   return { next: 'confirmed',  label: 'Confirmer' };
  if (s === 'confirmed') return { next: 'preparing',  label: 'Préparer' };
  if (s === 'preparing') return { next: 'ready',      label: 'Prête ✓' };
  if (s === 'ready') {
    if (src === 'TABLE_QR')          return { next: 'delivered',  label: '🍽️ Servie' };
    if (type === 'delivery')         return { next: 'on_the_way', label: '🛵 Partir' };
    if (type === 'click_collect' || type === 'takeaway') return { next: 'picked_up', label: '✅ Récupérée' };
    return { next: 'delivered', label: 'Terminée' };
  }
  if (s === 'on_the_way') return { next: 'delivered', label: '✓ Livrée' };
  return null;
}

// Badge de source visuel
function SourceBadge({ order }) {
  const src  = order.order_source;
  const type = order.type;
  if (src === 'TABLE_QR') return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#FFF7ED', border:'1.5px solid #FED7AA', borderRadius:7, padding:'2px 8px', fontSize:11, fontWeight:700, color:'#B45309', flexShrink:0 }}>
      🪑 Table {order.table_label || '—'}
    </span>
  );
  if (type === 'delivery') return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#EFF6FF', border:'1.5px solid #BFDBFE', borderRadius:7, padding:'2px 8px', fontSize:11, fontWeight:700, color:'#1D4ED8', flexShrink:0 }}>
      🛵 Livraison
    </span>
  );
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#F0FDF4', border:'1.5px solid #BBF7D0', borderRadius:7, padding:'2px 8px', fontSize:11, fontWeight:700, color:'#15803D', flexShrink:0 }}>
      🏃 À emporter
    </span>
  );
}

function timeSince(dateStr) {
  const d = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (d < 1) return 'À l\'instant';
  if (d < 60) return `${d} min`;
  if (d < 1440) return `${Math.floor(d / 60)}h`;
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

const API_BASE    = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/restobook/api/';
const SOCKET_PATH = API_BASE.replace(/\/+$/, '') + '/socket.io';

export default function OrdersPage() {
  const { get, patch } = useApi();
  const { user }       = useAuth();

  const [orders, setOrders]         = useState([]);
  const [viewMode, setViewMode]     = useState('kanban');
  const [sourceTab, setSourceTab]   = useState('all');      // 'all' | 'TABLE_QR' | 'ONLINE'
  const [filterStatus, setFilterStatus] = useState('all');
  const [date, setDate]             = useState(today());
  const [q, setQ]                   = useState('');
  const [msg, setMsg]               = useState('');
  const [kind, setKind]             = useState('success');
  const [updating, setUpdating]     = useState(null);
  const [expanded, setExpanded]     = useState(null);
  const [connected, setConnected]   = useState(false);
  const [newIds, setNewIds]         = useState(new Set());
  const socketRef = useRef(null);
  const loadRef   = useRef(null);

  async function load() {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (date) params.set('date', date);
      if (sourceTab !== 'all') params.set('source', sourceTab === 'ONLINE' ? 'ONLINE' : 'TABLE_QR');
      const d = await get(`/orders?${params}`);
      setOrders(d.orders || []);
    } catch {}
  }

  loadRef.current = load;

  useEffect(() => { load(); }, [filterStatus, date, sourceTab]);
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [filterStatus, date, sourceTab]);

  useEffect(() => {
    if (!user?.organization_id) return;
    const socket = io(window.location.origin, {
      path: SOCKET_PATH, transports: ['websocket','polling'], reconnectionAttempts: 5,
    });
    socketRef.current = socket;
    socket.on('connect',    () => { setConnected(true); socket.emit('restaurant:join', user.organization_id); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('order:new',  (order) => {
      loadRef.current();
      setNewIds(prev => new Set([...prev, order.id]));
      setTimeout(() => setNewIds(prev => { const n = new Set(prev); n.delete(order.id); return n; }), 4000);
    });
    socket.on('order:status', () => { loadRef.current(); });
    return () => { socket.disconnect(); };
  }, [user?.organization_id]);

  async function updateStatus(order, newStatus, e) {
    if (e) e.stopPropagation();
    setUpdating(order.id);
    try {
      await patch(`/orders/${order.id}/status`, { status: newStatus });
      setMsg(`Statut mis à jour : ${STATUS_LABELS[newStatus] || newStatus}`);
      setKind('success');
      load();
    } catch (err) { setMsg(err.message); setKind('error'); }
    finally { setUpdating(null); }
  }

  // Compteurs pour badges
  const stats      = orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});
  const qrCount    = orders.filter(o => o.order_source === 'TABLE_QR').length;
  const onlineCount= orders.filter(o => o.order_source === 'ONLINE').length;

  const filtered = orders.filter(o => {
    if (!q) return true;
    const hay = [o.pickup_code, o.guest_name, o.user?.matricule, o.user?.nom, o.table_label]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  // ── OrderCard ────────────────────────────────────────────────────────────
  function OrderCard({ order, compact = false }) {
    const isNew   = newIds.has(order.id);
    const isOpen  = expanded === order.id;
    const total   = Number(order.total_amount || 0);
    const action  = getNextAction(order);
    const isQR    = order.order_source === 'TABLE_QR';

    return (
      <div style={{
        background: isNew ? '#FFF7ED' : '#fff',
        borderRadius: 10, marginBottom: compact ? 8 : 10,
        boxShadow: isNew ? '0 0 0 2px #FF8A00, 0 2px 8px rgba(0,0,0,0.08)' : '0 1px 4px rgba(0,0,0,0.06)',
        border: isNew ? '1.5px solid #FF8A00' : `1px solid ${isQR ? '#FED7AA' : '#F3F4F6'}`,
        transition: 'all 0.3s', overflow: 'hidden',
      }}>
        {/* Bande colorée selon source */}
        <div style={{ height: 3, background: isQR ? 'linear-gradient(90deg,#FF8A00,#FF5D00)' : 'linear-gradient(90deg,#3B82F6,#2563EB)' }} />

        <div style={{ display:'flex', alignItems:'center', gap:10, padding: compact ? '9px 12px' : '12px 14px', flexWrap:'wrap', cursor:'pointer' }}
          onClick={() => setExpanded(isOpen ? null : order.id)}>

          {/* Icône + num table si QR */}
          <div style={{ width:38, height:38, borderRadius:9, flexShrink:0, background: isQR ? '#FFF7ED' : '#EFF6FF', display:'grid', placeItems:'center', fontSize:17, fontWeight:900, color: isQR ? '#B45309' : '#1D4ED8', border: `1.5px solid ${isQR ? '#FED7AA' : '#BFDBFE'}` }}>
            {isQR ? (order.table_label || '🪑') : (order.type === 'delivery' ? '🛵' : '🏃')}
          </div>

          <div style={{ flex:1, minWidth:100 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              <span style={{ fontWeight:700, fontSize:13 }}>#{order.id}</span>
              <code style={{ fontSize:10, background:'#F3F4F6', padding:'1px 5px', borderRadius:4 }}>{order.pickup_code}</code>
              <SourceBadge order={order} />
              {isNew && <span style={{ fontSize:10, background:'#FF8A00', color:'#fff', padding:'1px 6px', borderRadius:10, fontWeight:700 }}>NOUVEAU</span>}
            </div>
            <div style={{ fontSize:11, color:'#6B7280', marginTop:3, display:'flex', gap:8, flexWrap:'wrap' }}>
              <span>{order.user?.nom || order.guest_name || 'Client anonyme'}</span>
              {order.guest_phone && <a href={`tel:${order.guest_phone}`} style={{ color:'#FF8A00', fontWeight:700, textDecoration:'none' }}>{order.guest_phone}</a>}
              <span>⏱ {timeSince(order.created_at)}</span>
            </div>
          </div>

          {total > 0 && !compact && (
            <div style={{ fontWeight:700, fontSize:14, color:'var(--rb-orange,#FF8A00)', flexShrink:0 }}>{total.toFixed(0)} MAD</div>
          )}

          <div style={{ display:'flex', gap:6, flexShrink:0 }} onClick={e => e.stopPropagation()}>
            {action && (
              <button style={{ border:'none', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer', background: isQR ? '#FF8A00' : '#2563EB', color:'#fff', opacity: updating === order.id ? 0.6 : 1 }}
                onClick={e => updateStatus(order, action.next, e)} disabled={updating === order.id}>
                {updating === order.id ? '…' : action.label}
              </button>
            )}
            {!['cancelled','delivered','picked_up'].includes(order.status) && (
              <button style={{ border:'1px solid #FCA5A5', borderRadius:6, padding:'5px 8px', fontSize:11, cursor:'pointer', background:'#fff', color:'#DC2626', opacity: updating === order.id ? 0.6 : 1 }}
                onClick={e => updateStatus(order, 'cancelled', e)} disabled={updating === order.id}>✕</button>
            )}
          </div>
          <span style={{ color:'#9CA3AF', fontSize:12 }}>{isOpen ? '▲' : '▼'}</span>
        </div>

        {/* Détail expandable */}
        {isOpen && (
          <div style={{ padding:'8px 14px 14px', background:'#FAFAFA', borderTop:'1px solid #F3F4F6' }}>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
              <span className={`rb-badge ${STATUS_BADGE[order.status] || ''}`}>{STATUS_LABELS[order.status] || order.status}</span>
              {order.payment_method && <span style={{ fontSize:11, color:'#6B7280', background:'#F3F4F6', borderRadius:6, padding:'2px 7px' }}>💳 {order.payment_method === 'cash' ? 'Espèces' : order.payment_method}</span>}
            </div>
            {order.notes && <div style={{ fontSize:11, color:'#6B7280', fontStyle:'italic', marginBottom:8 }}>📝 {order.notes}</div>}
            {order.delivery_address && <div style={{ fontSize:11, color:'#374151', marginBottom:8 }}>📍 {order.delivery_address}</div>}
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {(order.items || []).map((it, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'5px 10px', background:'#fff', borderRadius:6, fontSize:12, border:'1px solid #F3F4F6' }}>
                  <span><strong>×{it.quantity}</strong> {it.menu_item?.libelle || `Item #${it.menu_item_id}`}{it.notes ? <em style={{ color:'#9CA3AF', marginLeft:4 }}>({it.notes})</em> : null}</span>
                  <span style={{ fontWeight:600 }}>{(Number(it.unit_price || 0) * it.quantity).toFixed(2)} MAD</span>
                </div>
              ))}
            </div>
            {total > 0 && (
              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8, fontWeight:700, fontSize:13 }}>
                Total : <span style={{ color:'var(--rb-orange,#FF8A00)', marginLeft:6 }}>{total.toFixed(2)} MAD</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Rendu principal ─────────────────────────────────────────────────────
  return (
    <>
      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />

      {/* KPIs */}
      <div className="row g-2 mb-2">
        {[
          { key:'pending',   label:'En attente',     icon:'⏳', color:'var(--rb-muted,#6B7280)' },
          { key:'preparing', label:'En préparation', icon:'👨‍🍳', color:'var(--rb-orange,#FF8A00)' },
          { key:'ready',     label:'Prêtes',          icon:'✅', color:'var(--rb-green,#16A34A)' },
          { key:'delivered', label:'Terminées',       icon:'🏁', color:'#2563EB' },
        ].map(c => (
          <div key={c.key} className="col-6 col-md-3">
            <div className="stat-card" style={{ cursor:'pointer' }} onClick={() => { setViewMode('list'); setFilterStatus(c.key); }}>
              <div style={{ fontSize:22 }}>{c.icon}</div>
              <div className="stat-card__value" style={{ color:c.color, fontSize:26 }}>{stats[c.key] || 0}</div>
              <div className="stat-card__label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── ONGLETS SOURCE ── */}
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        {[
          { key:'all',      label:'Toutes',       count: orders.length,  icon:'📋' },
          { key:'TABLE_QR', label:'Sur place QR', count: qrCount,        icon:'🪑' },
          { key:'ONLINE',   label:'En ligne',     count: onlineCount,    icon:'🌐' },
        ].map(t => (
          <button key={t.key} onClick={() => setSourceTab(t.key)} style={{
            display:'flex', alignItems:'center', gap:6,
            padding:'8px 16px', borderRadius:10, border:'2px solid',
            borderColor: sourceTab === t.key ? (t.key === 'TABLE_QR' ? '#FED7AA' : t.key === 'ONLINE' ? '#BFDBFE' : 'var(--rb-orange,#FF8A00)') : '#E5E7EB',
            background: sourceTab === t.key ? (t.key === 'TABLE_QR' ? '#FFF7ED' : t.key === 'ONLINE' ? '#EFF6FF' : '#FFF7ED') : '#fff',
            color: sourceTab === t.key ? (t.key === 'TABLE_QR' ? '#B45309' : t.key === 'ONLINE' ? '#1D4ED8' : 'var(--rb-orange,#FF8A00)') : '#6B7280',
            fontWeight:700, fontSize:13, cursor:'pointer', transition:'all .15s', fontFamily:'inherit',
          }}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
            {t.count > 0 && (
              <span style={{ background: sourceTab === t.key ? 'currentColor' : '#E5E7EB', color: sourceTab === t.key ? '#fff' : '#374151', borderRadius:10, padding:'0px 7px', fontSize:11, fontWeight:800 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Barre d'outils */}
      <div className="card p-3 mb-2">
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ display:'flex', background:'#F3F4F6', borderRadius:8, padding:3, gap:2 }}>
            {[['kanban','⬜ Kanban'],['list','☰ Liste']].map(([v,l]) => (
              <button key={v} onClick={() => setViewMode(v)} style={{ border:'none', borderRadius:6, padding:'5px 12px', fontSize:12, fontWeight:600, cursor:'pointer', background: viewMode===v ? '#fff' : 'transparent', color: viewMode===v ? 'var(--rb-text,#111827)' : '#9CA3AF', boxShadow: viewMode===v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{l}</button>
            ))}
          </div>

          {viewMode === 'list' && (
            <div style={{ display:'flex', background:'#F3F4F6', borderRadius:8, padding:3, gap:2, flexWrap:'wrap' }}>
              {[['all','Toutes'],['pending','Attente'],['confirmed','Confirmées'],['preparing','Préparation'],['ready','Prêtes'],['delivered','Terminées'],['cancelled','Annulées']].map(([v,l]) => (
                <button key={v} onClick={() => setFilterStatus(v)} style={{ border:'none', borderRadius:6, padding:'5px 9px', fontSize:11, fontWeight:600, cursor:'pointer', background: filterStatus===v ? '#fff' : 'transparent', color: filterStatus===v ? 'var(--rb-text,#111827)' : '#9CA3AF', boxShadow: filterStatus===v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{l}{stats[v] ? ` (${stats[v]})` : ''}</button>
              ))}
            </div>
          )}

          <input type="date" className="form-control form-control-sm" style={{ width:'auto' }}
            value={date} onChange={e => setDate(e.target.value)} />
          <input className="form-control form-control-sm" style={{ maxWidth:180 }}
            placeholder="Code, nom, table…" value={q} onChange={e => setQ(e.target.value)} />

          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, fontSize:12, color: connected ? '#16A34A' : '#9CA3AF' }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background: connected ? '#22C55E' : '#D1D5DB', display:'inline-block', boxShadow: connected ? '0 0 0 3px rgba(34,197,94,0.2)' : 'none', animation: connected ? 'pulse 2s infinite' : 'none' }} />
            {connected ? 'Live' : 'Polling'}
          </div>
        </div>
      </div>

      {/* ── VUE KANBAN ── */}
      {viewMode === 'kanban' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12, alignItems:'start' }}>
          {KANBAN_COLS.map(col => {
            const colOrders = filtered.filter(o => o.status === col.key);
            return (
              <div key={col.key} style={{ background:col.bg, borderRadius:12, padding:'12px 10px', minHeight:120 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, paddingBottom:8, borderBottom:`2px solid ${col.dot}22` }}>
                  <span style={{ fontWeight:700, fontSize:13, color:col.color }}>{col.label}</span>
                  <span style={{ background:col.dot, color:'#fff', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:10 }}>{colOrders.length}</span>
                </div>
                {colOrders.length === 0
                  ? <div style={{ textAlign:'center', padding:'20px 0', color:'#D1D5DB', fontSize:12 }}>Aucune commande</div>
                  : colOrders.map(order => <OrderCard key={order.id} order={order} compact />)
                }
              </div>
            );
          })}
        </div>
      )}

      {/* ── VUE LISTE ── */}
      {viewMode === 'list' && (
        <div className="card p-0" style={{ overflow:'hidden' }}>
          {filtered.length === 0
            ? <div style={{ padding:32 }}><EmptyState icon="🛒" title="Aucune commande" subtitle="Modifiez le filtre ou la date." /></div>
            : filtered.map(order => {
                const isOpen = expanded === order.id;
                const total  = Number(order.total_amount || 0);
                const isNew  = newIds.has(order.id);
                const isQR   = order.order_source === 'TABLE_QR';
                const action = getNextAction(order);

                return (
                  <div key={order.id} style={{ borderBottom:'1px solid var(--rb-border,#F3F4F6)', background: isNew ? '#FFF7ED' : 'transparent', transition:'background 0.4s' }}>
                    <div style={{ height:3, background: isQR ? 'linear-gradient(90deg,#FF8A00,#FF5D00)' : 'linear-gradient(90deg,#3B82F6,#2563EB)' }} />
                    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 18px', flexWrap:'wrap', cursor:'pointer', background: isOpen ? 'var(--rb-surface,#F9FAFB)' : 'transparent' }}
                      onClick={() => setExpanded(isOpen ? null : order.id)}>
                      <div style={{ width:38, height:38, borderRadius:10, flexShrink:0, background: isQR ? '#FFF7ED' : '#EFF6FF', display:'grid', placeItems:'center', fontSize:15, fontWeight:900, color: isQR ? '#B45309' : '#1D4ED8', border:`1.5px solid ${isQR ? '#FED7AA' : '#BFDBFE'}` }}>
                        {isQR ? (order.table_label || '🪑') : (order.type === 'delivery' ? '🛵' : '🏃')}
                      </div>
                      <div style={{ flex:1, minWidth:120 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                          <span style={{ fontWeight:700, fontSize:14 }}>#{order.id}</span>
                          <code style={{ fontSize:11, background:'var(--rb-surface,#F9FAFB)', padding:'1px 6px', borderRadius:4 }}>{order.pickup_code}</code>
                          <span className={`rb-badge ${STATUS_BADGE[order.status] || ''}`}>{STATUS_LABELS[order.status] || order.status}</span>
                          <SourceBadge order={order} />
                          {isNew && <span style={{ fontSize:10, background:'#FF8A00', color:'#fff', padding:'1px 6px', borderRadius:10, fontWeight:700 }}>NOUVEAU</span>}
                        </div>
                        <div style={{ fontSize:12, color:'var(--rb-muted,#6B7280)', marginTop:2, display:'flex', gap:8, flexWrap:'wrap' }}>
                          <span>{order.user?.nom || order.guest_name || 'Client anonyme'}</span>
                          {order.guest_phone && <a href={`tel:${order.guest_phone}`} style={{ color:'#FF8A00', fontWeight:700, textDecoration:'none' }} onClick={e => e.stopPropagation()}>{order.guest_phone}</a>}
                          <span>⏱ {timeSince(order.created_at)}</span>
                        </div>
                      </div>
                      {total > 0 && <div style={{ fontWeight:700, fontSize:16, color:'var(--rb-orange,#FF8A00)', flexShrink:0 }}>{total.toFixed(2)} MAD</div>}
                      <div className="d-flex gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        {action && (
                          <button className="btn btn-primary btn-sm" style={{ fontSize:11, background: isQR ? '#FF8A00' : undefined, borderColor: isQR ? '#FF8A00' : undefined }}
                            onClick={e => updateStatus(order, action.next, e)} disabled={updating === order.id}>
                            {updating === order.id ? <span className="spinner-border spinner-border-sm" style={{ width:12, height:12 }} /> : action.label}
                          </button>
                        )}
                        {!['cancelled','delivered','picked_up'].includes(order.status) && (
                          <button className="btn btn-outline-danger btn-sm" style={{ fontSize:11 }}
                            onClick={e => updateStatus(order, 'cancelled', e)} disabled={updating === order.id}>✕</button>
                        )}
                      </div>
                      <span style={{ color:'var(--rb-muted,#9CA3AF)', fontSize:14 }}>{isOpen ? '▲' : '▼'}</span>
                    </div>

                    {isOpen && (
                      <div style={{ padding:'8px 18px 16px', background:'var(--rb-surface,#F9FAFB)', borderTop:'1px solid var(--rb-border,#F3F4F6)' }}>
                        {order.notes && <div style={{ fontSize:12, color:'var(--rb-muted)', fontStyle:'italic', marginBottom:10 }}>📝 {order.notes}</div>}
                        {order.delivery_address && <div style={{ fontSize:12, color:'#374151', marginBottom:10 }}>📍 {order.delivery_address}</div>}
                        <div style={{ display:'grid', gap:6 }}>
                          {(order.items || []).map((it, i) => (
                            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 12px', background:'var(--rb-card,#fff)', borderRadius:8, border:'1px solid var(--rb-border,#F3F4F6)', fontSize:13 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                <span style={{ fontWeight:600 }}>×{it.quantity}</span>
                                <div>
                                  <div>{it.menu_item?.libelle || `Item #${it.menu_item_id}`}</div>
                                  {it.notes && <div style={{ fontSize:11, color:'var(--rb-muted)' }}>{it.notes}</div>}
                                </div>
                              </div>
                              <span style={{ fontWeight:600 }}>{(Number(it.unit_price || 0) * it.quantity).toFixed(2)} MAD</span>
                            </div>
                          ))}
                        </div>
                        {total > 0 && (
                          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:10, paddingTop:10, borderTop:'1px solid var(--rb-border,#F3F4F6)', fontWeight:700, fontSize:15 }}>
                            Total : <span style={{ color:'var(--rb-orange,#FF8A00)', marginLeft:8 }}>{total.toFixed(2)} MAD</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
          }
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </>
  );
}
