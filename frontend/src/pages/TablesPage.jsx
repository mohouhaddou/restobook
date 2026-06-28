import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { Toast } from '../components/ui/Toast';
import { API } from '../api';

const STATUS_CONFIG = {
  pending:   { label:'En attente', color:'#F59E0B', bg:'#FFFBEB', icon:'⏳' },
  confirmed: { label:'Confirmée',  color:'#22C55E', bg:'#F0FDF4', icon:'✓'  },
  seated:    { label:'Attablée',   color:'#3B82F6', bg:'#EFF6FF', icon:'🪑'  },
  cancelled: { label:'Annulée',   color:'#EF4444', bg:'#FEF2F2', icon:'✕'  },
  no_show:   { label:'No-show',   color:'#9CA3AF', bg:'#F9FAFB', icon:'👻' },
};

const TODAY = new Date().toISOString().slice(0, 10);

function formatTime(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }); } catch { return iso; }
}

export default function TablesPage() {
  const { get, post, patch, del, token } = useApi();
  const { user } = useAuth();

  /* ── Tab ── */
  const [activeTab, setActiveTab] = useState('reservations');

  /* ── Reservations ── */
  const [reservations, setReservations]   = useState([]);
  const [loadingRes, setLoadingRes]       = useState(false);
  const [filterDate, setFilterDate]       = useState('');    // vide = toutes les dates
  const [filterStatus, setFilterStatus]   = useState('all');
  const [updatingId, setUpdatingId]       = useState(null);

  /* ── Tables (QR) ── */
  const [tables, setTables]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel]     = useState('');
  const [capacity, setCapacity] = useState(2);
  const [floor, setFloor]     = useState('');

  /* ── Toast ── */
  const [msg, setMsg]         = useState('');
  const [msgKind, setMsgKind] = useState('success');

  function toast(m, kind = 'success') { setMsg(m); setMsgKind(kind); }

  /* ── Load reservations ── */
  async function loadReservations() {
    setLoadingRes(true);
    try {
      const params = new URLSearchParams();
      if (filterDate) params.append('date', filterDate);   // date vide = toutes les dates
      if (filterStatus !== 'all') params.append('status', filterStatus);
      const d = await get(`/tables${params.toString() ? '?' + params : ''}`);
      setReservations(d.reservations || []);
    } catch { toast('Erreur chargement réservations', 'error'); }
    setLoadingRes(false);
  }

  /* ── Load tables ── */
  async function loadTables() {
    try { const d = await get('/restaurant/tables'); setTables(d.tables || []); } catch {}
  }

  useEffect(() => { loadReservations(); }, [filterDate, filterStatus]);
  useEffect(() => { loadTables(); }, []);

  /* ── Update reservation status ── */
  async function updateStatus(id, status) {
    setUpdatingId(id);
    try {
      await patch(`/tables/${id}/status`, { status });
      toast(`Statut mis à jour : ${STATUS_CONFIG[status]?.label}`);
      loadReservations();
    } catch (e) { toast(e.message || 'Erreur', 'error'); }
    setUpdatingId(null);
  }

  /* ── Delete reservation ── */
  async function deleteReservation(id) {
    if (!confirm('Supprimer cette réservation ?')) return;
    try {
      await del(`/tables/${id}`);
      toast('Réservation supprimée');
      loadReservations();
    } catch (e) { toast(e.message || 'Erreur', 'error'); }
  }

  /* ── Create table ── */
  async function createTable(e) {
    e.preventDefault();
    if (!label.trim()) return;
    setLoading(true);
    try {
      await post('/restaurant/tables', { label: label.trim(), capacity: Number(capacity), floor: floor.trim() || undefined });
      toast(`Table ${label} créée !`);
      setLabel(''); setCapacity(2); setFloor(''); setShowForm(false);
      loadTables();
    } catch (err) { toast(err.message || 'Erreur', 'error'); }
    setLoading(false);
  }

  async function deleteTable(id, lbl) {
    if (!confirm(`Supprimer la table ${lbl} ?`)) return;
    try {
      await del(`/restaurant/tables/${id}`);
      toast(`Table ${lbl} supprimée`);
      loadTables();
    } catch (err) { toast(err.message || 'Erreur', 'error'); }
  }

  async function downloadQr(tableId, tableLabel) {
    try {
      const resp = await fetch(API(`/restaurant/tables/${tableId}/qr?format=png`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error('Erreur génération QR');
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `qr-table-${tableLabel}.png`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast(err.message || 'Erreur QR', 'error'); }
  }

  /* ── Stats ── */
  const statsByStatus = reservations.reduce((acc, r) => { acc[r.status] = (acc[r.status]||0)+1; return acc; }, {});
  const totalGuests = reservations.filter(r => !['cancelled','no_show'].includes(r.status)).reduce((s,r) => s + (r.guests_count||0), 0);

  const card = { background:'#fff', borderRadius:16, padding:16, border:'1px solid #E5E7EB', boxShadow:'0 1px 4px rgba(0,0,0,.04)' };
  const inp  = { padding:'9px 12px', border:'1.5px solid #E5E7EB', borderRadius:10, fontSize:14, outline:'none', background:'#fff', color:'#111827', fontFamily:'inherit' };
  const btn  = (color='#FF8A00') => ({ padding:'9px 18px', background:color, color:'#fff', border:'none', borderRadius:9, cursor:'pointer', fontWeight:700, fontSize:13, fontFamily:'inherit' });

  /* ═══ RENDER ══════════════════════════════════════════════════════════ */
  return (
    <>
      <Toast msg={msg} kind={msgKind} onClose={() => setMsg('')} />

      {/* ── Tab switcher ── */}
      <div style={{ display:'flex', borderBottom:'2px solid #F3F4F6', marginBottom:20 }}>
        {[
          { key:'reservations', label:'📅 Réservations' },
          { key:'tables',       label:'🪑 Tables & QR' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding:'11px 18px', border:'none', background:'none', cursor:'pointer',
            fontSize:14, fontWeight: activeTab===t.key ? 700 : 500,
            color: activeTab===t.key ? 'var(--rb-orange,#FF8A00)' : '#6B7280',
            borderBottom:`2px solid ${activeTab===t.key?'var(--rb-orange,#FF8A00)':'transparent'}`,
            marginBottom:-2, whiteSpace:'nowrap', fontFamily:'inherit',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ════ RESERVATIONS TAB ════════════════════════════════════════ */}
      {activeTab === 'reservations' && (
        <>
          {/* ── KPI row ── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:10, marginBottom:20 }}>
            {[
              { label:'Total', value: reservations.length, color:'#6B7280' },
              { label:'En attente', value: statsByStatus.pending||0, color:'#F59E0B' },
              { label:'Confirmées', value: statsByStatus.confirmed||0, color:'#22C55E' },
              { label:'Attablées', value: statsByStatus.seated||0, color:'#3B82F6' },
              { label:'Couverts', value: totalGuests, color:'var(--rb-orange,#FF8A00)' },
            ].map(k => (
              <div key={k.label} style={{ ...card, textAlign:'center', padding:'14px 8px' }}>
                <div style={{ fontSize:22, fontWeight:900, color:k.color }}>{k.value}</div>
                <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2, fontWeight:600 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* ── Filters ── */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16, alignItems:'center' }}>
            <button onClick={()=>setFilterDate('')} style={{ padding:'9px 14px', border:'1.5px solid #E5E7EB', borderRadius:9, background: !filterDate?'var(--rb-orange,#FF8A00)':'#fff', color: !filterDate?'#fff':'#374151', cursor:'pointer', fontWeight:700, fontSize:12, fontFamily:'inherit', flexShrink:0 }}>
              Tout
            </button>
            <button onClick={()=>setFilterDate(TODAY)} style={{ padding:'9px 14px', border:'1.5px solid #E5E7EB', borderRadius:9, background: filterDate===TODAY?'var(--rb-orange,#FF8A00)':'#fff', color: filterDate===TODAY?'#fff':'#374151', cursor:'pointer', fontWeight:700, fontSize:12, fontFamily:'inherit', flexShrink:0 }}>
              Aujourd'hui
            </button>
            <input
              type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)}
              style={{ ...inp, flex:'1 1 140px' }}
            />
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ ...inp, flex:'1 1 130px' }}>
              <option value="all">Tous les statuts</option>
              {Object.entries(STATUS_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={loadReservations} style={{ ...btn(), flexShrink:0 }}>↻</button>
          </div>

          {/* ── Reservations list ── */}
          {loadingRes ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'#9CA3AF' }}>Chargement…</div>
          ) : reservations.length === 0 ? (
            <div style={{ ...card, padding:'50px 20px', textAlign:'center', color:'#9CA3AF' }}>
              <div style={{ fontSize:40, marginBottom:8 }}>📅</div>
              <div style={{ fontWeight:700, fontSize:16, color:'#374151', marginBottom:4 }}>Aucune réservation</div>
              <div style={{ fontSize:13 }}>{filterDate ? `pour le ${filterDate}` : 'aucune réservation trouvée'}{filterStatus!=='all'?` · ${STATUS_CONFIG[filterStatus]?.label}`:''}</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {reservations.map(r => {
                const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                return (
                  <div key={r.id} style={{ ...card, borderLeft:`4px solid ${sc.color}`, padding:'16px 18px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 }}>
                      {/* Left info */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:6 }}>
                          <span style={{ fontWeight:800, fontSize:16, color:'#111827' }}>{r.guest_name}</span>
                          <span style={{ fontSize:11, background:sc.bg, color:sc.color, padding:'3px 10px', borderRadius:20, fontWeight:700, flexShrink:0 }}>
                            {sc.icon} {sc.label}
                          </span>
                        </div>
                        <div style={{ display:'flex', gap:14, flexWrap:'wrap', fontSize:13, color:'#6B7280' }}>
                          <span style={{ fontWeight:700, color:'#374151' }}>📅 {r.date_jour ? new Date(r.date_jour + 'T00:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'short'}) : '—'}</span>
                          <span>🕐 {r.time_slot}</span>
                          <span>👥 {r.guests_count} couvert{r.guests_count>1?'s':''}</span>
                          {r.table_label && <span>🪑 {r.table_label}</span>}
                          {r.guest_phone && <a href={`tel:${r.guest_phone}`} style={{ color:'var(--rb-orange,#FF8A00)', fontWeight:600, textDecoration:'none' }}>📞 {r.guest_phone}</a>}
                          {r.guest_email && <a href={`mailto:${r.guest_email}`} style={{ color:'var(--rb-orange,#FF8A00)', fontWeight:600, textDecoration:'none', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis' }}>{r.guest_email}</a>}
                        </div>
                        {r.notes && (
                          <div style={{ marginTop:8, padding:'8px 12px', background:'#F9FAFB', borderRadius:8, fontSize:12, color:'#374151', lineHeight:1.6 }}>
                            💬 {r.notes}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
                        {r.status === 'pending' && (
                          <>
                            <button onClick={()=>updateStatus(r.id,'confirmed')} disabled={updatingId===r.id} style={{ ...btn('#22C55E'), padding:'7px 12px', fontSize:12 }}>✓ Confirmer</button>
                            <button onClick={()=>updateStatus(r.id,'cancelled')} disabled={updatingId===r.id} style={{ ...btn('#EF4444'), padding:'7px 12px', fontSize:12 }}>✕ Annuler</button>
                          </>
                        )}
                        {r.status === 'confirmed' && (
                          <>
                            <button onClick={()=>updateStatus(r.id,'seated')} disabled={updatingId===r.id} style={{ ...btn('#3B82F6'), padding:'7px 12px', fontSize:12 }}>🪑 Attabler</button>
                            <button onClick={()=>updateStatus(r.id,'no_show')} disabled={updatingId===r.id} style={{ ...btn('#9CA3AF'), padding:'7px 12px', fontSize:12 }}>👻 No-show</button>
                          </>
                        )}
                        <button onClick={()=>deleteReservation(r.id)} style={{ padding:'7px 12px', background:'#fff', border:'1px solid #FCA5A5', borderRadius:8, cursor:'pointer', color:'#DC2626', fontSize:11, fontFamily:'inherit' }}>🗑 Supprimer</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ════ TABLES & QR TAB ═════════════════════════════════════════ */}
      {activeTab === 'tables' && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:'#111827' }}>Tables & QR Codes</h2>
            <button onClick={() => setShowForm(!showForm)} style={btn()}>+ Nouvelle table</button>
          </div>

          {showForm && (
            <div style={{ ...card, marginBottom:16, padding:'18px 20px' }}>
              <form onSubmit={createTable} style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:700, marginBottom:4, color:'#374151' }}>Label *</label>
                  <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="T1, VIP…"
                    style={{ ...inp, width:120 }} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:700, marginBottom:4, color:'#374151' }}>Capacité</label>
                  <input type="number" min={1} max={50} value={capacity} onChange={e=>setCapacity(e.target.value)}
                    style={{ ...inp, width:80 }} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:700, marginBottom:4, color:'#374151' }}>Salle / Étage</label>
                  <input value={floor} onChange={e=>setFloor(e.target.value)} placeholder="Terrasse, Salle…"
                    style={{ ...inp, width:160 }} />
                </div>
                <button type="submit" disabled={loading||!label.trim()} style={{ ...btn(), opacity:loading||!label.trim()?0.5:1 }}>
                  {loading ? '…' : 'Créer'}
                </button>
                <button type="button" onClick={()=>setShowForm(false)} style={{ padding:'9px 14px', background:'#fff', border:'1.5px solid #E5E7EB', borderRadius:9, cursor:'pointer', fontSize:14, color:'#6B7280', fontFamily:'inherit' }}>
                  Annuler
                </button>
              </form>
            </div>
          )}

          {tables.length === 0 ? (
            <div style={{ ...card, padding:'50px 20px', textAlign:'center', color:'#9CA3AF' }}>
              <div style={{ fontSize:40 }}>🪑</div>
              <div style={{ marginTop:8, fontWeight:700, fontSize:15, color:'#374151' }}>Aucune table configurée</div>
              <div style={{ fontSize:13, marginTop:4 }}>Créez vos tables pour générer des QR Codes</div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12 }}>
              {tables.map(table => (
                <div key={table.id} style={{ ...card, textAlign:'center', position:'relative' }}>
                  <div style={{ position:'absolute', top:10, right:10, background:'#F3F4F6', borderRadius:8, padding:'2px 8px', fontSize:11, color:'#6B7280', fontWeight:700 }}>
                    👤 {table.capacity}
                  </div>
                  <div style={{ fontSize:36, marginBottom:6 }}>🪑</div>
                  <div style={{ fontSize:20, fontWeight:900, color:'#111827' }}>{table.label}</div>
                  {table.floor && <div style={{ fontSize:12, color:'#9CA3AF', marginTop:2 }}>{table.floor}</div>}
                  <div style={{ display:'flex', gap:6, justifyContent:'center', marginTop:12 }}>
                    <button onClick={()=>downloadQr(table.id, table.label)} style={{ flex:1, padding:'7px', background:'var(--rb-orange,#FF8A00)', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'inherit' }}>
                      ⬇ QR Code
                    </button>
                    <button onClick={()=>deleteTable(table.id, table.label)} style={{ padding:'7px 10px', background:'#fff', border:'1px solid #FCA5A5', borderRadius:8, cursor:'pointer', color:'#DC2626', fontSize:11, fontFamily:'inherit' }}>
                      🗑
                    </button>
                  </div>
                  <div style={{ marginTop:8, fontSize:9, color:'#D1D5DB', wordBreak:'break-all', fontFamily:'monospace' }}>
                    {table.qr_token?.slice(0,12)}…
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
