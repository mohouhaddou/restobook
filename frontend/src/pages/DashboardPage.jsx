import React, { useEffect, useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { ASSET } from '../api';
import { QrModal } from '../components/reservation/QrModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';

// Images Unsplash open-source par catégorie de plat
const FOOD_FALLBACKS = {
  plat:    'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&q=75',
  entrée:  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=75',
  dessert: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=75',
  boisson: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=600&q=75',
};

const CATS = ['entrée', 'plat', 'dessert', 'boisson'];
const cap  = s => s ? s[0].toUpperCase() + s.slice(1) : '';

function today() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function formatDay(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function StatusPill({ status }) {
  const map = {
    confirmed: ['rb-badge--blue',   'Confirmée'],
    picked:    ['rb-badge--green',  'Retirée'],
    cancelled: ['rb-badge--red',    'Annulée'],
  };
  const [cls, label] = map[status] || ['rb-badge--gray', status];
  return <span className={`rb-badge ${cls}`}>{label}</span>;
}

function StatCard({ value, label, icon, color }) {
  return (
    <div className="stat-card">
      <div className="stat-card__icon" style={{background:color+'20'}}>
        <span style={{fontSize:20}}>{icon}</span>
      </div>
      <div className="stat-card__value" style={{color}}>{value ?? '—'}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { get, post } = useApi();
  const { user, isManager } = useAuth();
  const [date, setDate]   = useState(today());
  const [menu, setMenu]   = useState({ items: [], locked: false });
  const [myOrders, setMyOrders] = useState([]);
  const [cart, setCart]   = useState({ entree_id: null, plat_id: null, dessert_id: null, boisson_id: null });
  const [cartMsg, setCartMsg] = useState({ text: '', kind: 'info' });
  const [submitting, setSubmitting] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [activeCat, setActiveCat] = useState('tous');
  const [qrOrder, setQrOrder]     = useState(null); // commande ouverte dans la modale QR
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => { loadMenu(); }, [date]);
  useEffect(() => { loadMine(); }, []);
  useEffect(() => { if (isManager) loadDashboard(); }, [isManager]);

  async function loadMenu() {
    try { setMenu(await get(`/menu/today?date=${date}`)); } catch {}
  }
  async function loadMine() {
    try {
      const d = await get('/reservations/me?view=matrix_day');
      setMyOrders(groupOrders(d.items || []));
    } catch {}
  }
  async function loadDashboard() {
    try { setDashboard(await get('/stats/dashboard')); } catch {}
  }

  function groupOrders(matrix) {
    return matrix.map(row => {
      const items = CATS.map(cat => {
        const cell = row[cat === 'entrée' ? 'entree' : cat];
        return cell ? { category: cat, ...cell } : null;
      }).filter(Boolean);
      const statuses = items.map(i => i.status);
      let status = 'confirmed';
      if (statuses.every(s => s === 'cancelled')) status = 'cancelled';
      else if (statuses.some(s => s === 'picked')) status = 'picked';
      return { date_jour: row.date_jour, order_code: row.order_code, items, status };
    }).sort((a, b) => b.date_jour.localeCompare(a.date_jour));
  }

  const grouped = useMemo(() => {
    const g = { entrée:[], plat:[], dessert:[], boisson:[] };
    (menu.items || []).forEach(it => {
      const t = it.type === 'entree' ? 'entrée' : it.type;
      if (g[t]) g[t].push(it);
    });
    return g;
  }, [menu.items]);

  const displayItems = useMemo(() => {
    if (activeCat === 'tous') return menu.items || [];
    return grouped[activeCat] || [];
  }, [activeCat, menu.items, grouped]);

  async function confirmOrder() {
    const any = Object.values(cart).some(Boolean);
    if (!any) { setCartMsg({ text: 'Sélectionnez au moins un plat.', kind: 'error' }); return; }
    setCartMsg({ text: '', kind: 'info' }); setSubmitting(true);
    try {
      await post('/reservations/confirm', { date_jour: date, selections: cart });
      setCartMsg({ text: 'Commande confirmée !', kind: 'success' });
      setCart({ entree_id: null, plat_id: null, dessert_id: null, boisson_id: null });
      await Promise.all([loadMine(), loadMenu()]);
    } catch (e) {
      setCartMsg({ text: e.message, kind: 'error' });
    } finally { setSubmitting(false); }
  }

  async function deleteOrder(order_code) {
    try {
      await post('/reservations/delete-order', { order_code });
      setPendingDelete(null);
      await Promise.all([loadMine(), loadMenu()]);
    } catch (e) { setCartMsg({ text: e.message, kind: 'error' }); }
  }

  const cartCount = Object.values(cart).filter(Boolean).length;
  const totalItems = (menu.items || []).length;

  return (
    <>
      {/* ── Dashboard manager KPIs ── */}
      {isManager && dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
          <StatCard value={dashboard.today?.confirmed} label="Confirmées aujourd'hui" icon="🎯" color="var(--rb-blue)" />
          <StatCard value={dashboard.today?.served}    label="Servies"                icon="✅" color="var(--rb-green)" />
          <StatCard value={dashboard.today?.cancelled} label="Annulées"               icon="❌" color="var(--rb-danger)" />
          <StatCard value={dashboard.users?.active}    label="Utilisateurs actifs"    icon="👥" color="var(--rb-orange)" />
        </div>
      )}

      {/* ── Menu du jour ── */}
      <div className="card p-0" style={{overflow:'hidden'}}>
        {/* Header menu */}
        <div style={{padding:'16px 20px 14px', borderBottom:'1px solid var(--rb-border)'}}>
          <div className="page-header">
            <div>
              <h4 className="section-title">Menu du jour</h4>
              <div style={{fontSize:12, color:'var(--rb-muted)', marginTop:2}}>
                {formatDay(date)} · {totalItems} plat{totalItems > 1 ? 's' : ''}
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              {menu.locked && (
                <span className="rb-badge rb-badge--red">Réservations closes</span>
              )}
              <input type="date" className="form-control form-control-sm" style={{width:'auto'}}
                value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          {/* Filtres catégories */}
          {totalItems > 0 && (
            <div className="cat-tabs mt-3">
              <button className={`cat-tab${activeCat === 'tous' ? ' active' : ''}`}
                onClick={() => setActiveCat('tous')}>
                Tous ({totalItems})
              </button>
              {CATS.filter(c => (grouped[c] || []).length > 0).map(cat => (
                <button key={cat} className={`cat-tab${activeCat === cat ? ' active' : ''}`}
                  onClick={() => setActiveCat(cat)}>
                  {cap(cat)} ({(grouped[cat] || []).length})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grille plats */}
        <div style={{padding:'18px 20px'}}>
          {totalItems === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">🍽️</div>
              <div className="empty-state__title">Aucun menu planifié pour ce jour</div>
              <div style={{fontSize:13, marginTop:4}}>Le gestionnaire n'a pas encore planifié les plats.</div>
            </div>
          ) : (
            <>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:14}}>
                {displayItems.map(it => {
                  const cat  = it.type === 'entree' ? 'entrée' : it.type;
                  const key  = `${cat === 'entrée' ? 'entree' : cat}_id`;
                  const sel  = cart[key] === it.id;
                  const disa = menu.locked || (it.restant !== null && it.restant <= 0);
                  const img  = it.image_url ? ASSET(it.image_url) : FOOD_FALLBACKS[cat];

                  return (
                    <div key={it.id}
                      className={`food-card${sel ? ' selected' : ''}${disa ? ' disabled' : ''}`}
                      style={{position:'relative'}}
                      onClick={() => !disa && setCart(c => ({ ...c, [key]: sel ? null : it.id }))}
                    >
                      <img src={img} alt={it.libelle} className="food-card__img"
                        onError={e => { e.target.src = FOOD_FALLBACKS[cat] || ''; }} />
                      {sel && <div className="food-card__check">✓</div>}
                      <div style={{padding:'10px 12px 12px'}}>
                        <div style={{fontWeight:600, fontSize:13, marginBottom:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                          {it.libelle}
                        </div>
                        {it.description && (
                          <div style={{fontSize:11, color:'var(--rb-muted)', marginBottom:6, lineHeight:1.4}}>
                            {it.description}
                          </div>
                        )}
                        <div className="d-flex align-items-center justify-content-between">
                          <span className="food-card__badge">{cap(cat)}</span>
                          <span className={`food-card__badge ${
                            it.restant === null ? 'food-card__badge--gray' :
                            it.restant > 0 ? 'food-card__badge--green' : 'food-card__badge--red'
                          }`}>
                            {it.restant === null ? '∞' : `${it.restant} dispo`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Panier */}
              <div style={{marginTop:18, padding:'14px 16px', background:'var(--rb-surface)', borderRadius:10, display:'flex', alignItems:'center', flexWrap:'wrap', gap:12}}>
                <div style={{flex:1, minWidth:200}}>
                  <div style={{fontWeight:600, fontSize:13}}>
                    {cartCount === 0 ? 'Aucun plat sélectionné' : `${cartCount} plat${cartCount > 1 ? 's' : ''} sélectionné${cartCount > 1 ? 's' : ''}`}
                  </div>
                  {cartCount > 0 && (
                    <div style={{fontSize:11, color:'var(--rb-muted)', marginTop:2}}>
                      {CATS.filter(c => cart[`${c === 'entrée' ? 'entree' : c}_id`]).map(c => {
                        const item = (grouped[c] || []).find(x => x.id === cart[`${c === 'entrée' ? 'entree' : c}_id`]);
                        return item ? cap(c) + ': ' + item.libelle : null;
                      }).filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-secondary btn-sm"
                    onClick={() => setCart({ entree_id: null, plat_id: null, dessert_id: null, boisson_id: null })}>
                    Vider
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={confirmOrder} disabled={submitting || !cartCount}>
                    {submitting
                      ? <><span className="spinner-border spinner-border-sm me-1" style={{width:12,height:12}} />Validation…</>
                      : `Commander${cartCount > 0 ? ` (${cartCount})` : ''}`
                    }
                  </button>
                </div>
              </div>

              {cartMsg.text && (
                <div className={`alert mt-2 mb-0 py-2 ${cartMsg.kind === 'success' ? 'alert-success' : 'alert-danger'}`}
                  style={{fontSize:13}}>
                  {cartMsg.kind === 'success' ? '✅ ' : '❌ '}{cartMsg.text}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Mes commandes ── */}
      <div className="card p-0" style={{overflow:'hidden'}}>
        <div style={{padding:'16px 20px', borderBottom:'1px solid var(--rb-border)'}}>
          <h4 className="section-title">Mes commandes</h4>
        </div>

        <div style={{padding:16}}>
          {myOrders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📭</div>
              <div className="empty-state__title">Aucune commande</div>
              <div style={{fontSize:13, marginTop:4}}>Réservez votre repas ci-dessus.</div>
            </div>
          ) : (
            <div style={{display:'grid', gap:10}}>
              {myOrders.map(order => (
                <div key={order.order_code} className="order-card">
                  <div className="order-card__header">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <div style={{
                        width:34, height:34, borderRadius:8,
                        background:'var(--rb-orange-light)', display:'grid', placeItems:'center', fontSize:16, flexShrink:0
                      }}>🍽️</div>
                      <div>
                        <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                          <code style={{fontSize:12, background:'var(--rb-surface)', padding:'2px 7px', borderRadius:4}}>
                            {order.order_code}
                          </code>
                          <StatusPill status={order.status} />
                        </div>
                        <div style={{fontSize:11, color:'var(--rb-muted)', marginTop:2}}>
                          {formatDay(order.date_jour)}
                        </div>
                      </div>
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-sm"
                        style={{ fontSize: 11, background: 'var(--rb-orange)', color: '#fff', border: 'none' }}
                        onClick={() => setQrOrder(order)}
                        title="Voir le QR code"
                      >
                        📷 QR
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        style={{ fontSize: 11 }}
                        onClick={() => setPendingDelete(order)}
                        disabled={order.status !== 'confirmed'}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>

                  <div className="order-card__body">
                    <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                      {order.items.map(it => (
                        <div key={it.category} className="order-item-chip">
                          <div>
                            <div className="order-item-chip__cat">{cap(it.category)}</div>
                            <div style={{fontSize:12, fontWeight:500}}>{it.label || '—'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {qrOrder && <QrModal order={qrOrder} onClose={() => setQrOrder(null)} />}
      <ConfirmModal
        show={!!pendingDelete}
        title="Supprimer la commande"
        message={pendingDelete ? `La commande ${pendingDelete.order_code} sera supprimée définitivement.` : ''}
        confirmLabel="Supprimer"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteOrder(pendingDelete.order_code)}
      />
    </>
  );
}
