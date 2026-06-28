import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../api';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';

const STATUS_LABELS = {
  pending:    { label: 'En attente',     color: '#9CA3AF' },
  confirmed:  { label: 'Confirmée',      color: '#2563EB' },
  preparing:  { label: 'En préparation', color: '#FF8A00' },
  ready:      { label: 'Prête',          color: '#16A34A' },
  picked_up:  { label: 'Récupérée',      color: '#7C3AED' },
  on_the_way: { label: 'En route',       color: '#7C3AED' },
  delivered:  { label: 'Livrée',         color: '#16A34A' },
  cancelled:  { label: 'Annulée',        color: '#DC2626' },
};

const TYPE_ICONS = { dine_in: '🍽️', takeaway: '🛍️', click_collect: '🏃', delivery: '🛵' };

function StarRating({ rating }) {
  return (
    <span>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= rating ? '#F59E0B' : '#E5E7EB', fontSize: 14 }}>★</span>
      ))}
    </span>
  );
}

export default function CustomerProfilePage() {
  const navigate = useNavigate();
  const { user, token, authHeader, logoutCustomer } = useCustomerAuth();

  const [tab, setTab]       = useState('orders');
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [addresses, setAddresses] = useState([]);

  const [editNom, setEditNom]   = useState(user?.nom || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [saving, setSaving]     = useState(false);
  const [saveMsg, setSaveMsg]   = useState('');

  // Fidélité
  const [loyalty, setLoyalty]     = useState(null);
  const [loyaltyRewards, setLoyaltyRewards] = useState([]);
  const [loyaltyHistory, setLoyaltyHistory] = useState([]);
  const [birthday, setBirthday]   = useState('');
  const [savingBday, setSavingBday] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState('');

  const TIERS = [
    { name: 'Bronze', min: 0,    icon: '🥉', color: '#cd7f32' },
    { name: 'Argent', min: 500,  icon: '🥈', color: '#94a3b8' },
    { name: 'Or',     min: 2000, icon: '🥇', color: '#f59e0b' },
    { name: 'Platine',min: 5000, icon: '💎', color: '#8b5cf6' },
  ];

  const loadLoyalty = useCallback(async () => {
    try {
      const [me, hist] = await Promise.all([
        fetch(API('/loyalty/me'), { headers: authHeader }).then(r => r.json()),
        fetch(API('/loyalty/me/history'), { headers: authHeader }).then(r => r.json()),
      ]);
      setLoyalty(me);
      setLoyaltyHistory(hist.history || []);
    } catch {}
  }, [authHeader]);

  const loadRewards = useCallback(async (orgId) => {
    if (!orgId) return;
    try {
      const d = await fetch(API(`/loyalty/rewards?org_id=${orgId}`), { headers: authHeader }).then(r => r.json());
      setLoyaltyRewards(d.rewards || []);
    } catch {}
  }, [authHeader]);

  const saveBirthday = async () => {
    if (!birthday) return;
    setSavingBday(true);
    try {
      await fetch(API('/loyalty/me/birthday'), {
        method: 'PATCH', headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthday }),
      });
    } catch {} finally { setSavingBday(false); }
  };

  const redeemReward = async (rewardId, orgId) => {
    try {
      const d = await fetch(API(`/loyalty/redeem/${rewardId}`), {
        method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId }),
      }).then(r => r.json());
      if (d.coupon_code) {
        setRedeemMsg(`🎁 Coupon activé : ${d.coupon_code}`);
        loadLoyalty();
        setTimeout(() => setRedeemMsg(''), 6000);
      } else {
        setRedeemMsg(d.error || 'Erreur');
        setTimeout(() => setRedeemMsg(''), 4000);
      }
    } catch {}
  };

  useEffect(() => {
    if (!token) { navigate('/account', { replace: true }); return; }
    if (tab === 'orders')    loadOrders(1);
    if (tab === 'addresses') loadAddresses();
    if (tab === 'loyalty')   loadLoyalty();
  }, [tab, token]);

  async function loadOrders(page) {
    setOrdersLoading(true);
    try {
      const res  = await fetch(API(`/marketplace/me/orders?page=${page}&limit=10`), { headers: authHeader });
      const data = await res.json();
      setOrders(data.orders || []);
      setOrdersTotal(data.total || 0);
      setOrdersPage(page);
    } catch {}
    setOrdersLoading(false);
  }

  async function loadAddresses() {
    try {
      const res  = await fetch(API('/marketplace/me/addresses'), { headers: authHeader });
      const data = await res.json();
      setAddresses(data.addresses || []);
    } catch {}
  }

  async function deleteAddress(id) {
    try {
      await fetch(API(`/marketplace/me/addresses/${id}`), { method: 'DELETE', headers: authHeader });
      setAddresses(prev => prev.filter(a => a.id !== id));
    } catch {}
  }

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res  = await fetch(API('/marketplace/me'), {
        method: 'PATCH',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: editNom.trim(), phone: editPhone.trim() || undefined }),
      });
      const data = await res.json();
      if (data.ok) setSaveMsg('Profil mis à jour ✓');
      else setSaveMsg(data.error || 'Erreur');
    } catch { setSaveMsg('Erreur réseau'); }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 3000);
  }

  if (!user) return null;

  const cardStyle = {
    background: '#fff', borderRadius: 12, padding: 16,
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 12
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--rb-orange,#FF8A00), var(--rb-deep-orange,#FF5D00))',
        padding: '24px 16px', color: '#fff'
      }}>
        <button onClick={() => navigate('/marketplace')} style={{
          background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8,
          color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 13, marginBottom: 16
        }}>← Marketplace</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 700,
          }}>
            {(user.nom || 'C')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{user.nom}</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>{user.email}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '2px solid #F3F4F6', display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {[
          { key: 'orders',    label: '📋 Commandes' },
          { key: 'loyalty',   label: '💎 Fidélité' },
          { key: 'addresses', label: '📍 Adresses' },
          { key: 'profile',   label: '👤 Profil' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '12px 14px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
            color: tab === t.key ? 'var(--rb-orange,#FF8A00)' : '#6B7280',
            borderBottom: tab === t.key ? '2px solid var(--rb-orange,#FF8A00)' : '2px solid transparent',
            marginBottom: -2, whiteSpace: 'nowrap', flexShrink: 0,
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ maxWidth: 600, margin: '20px auto', padding: '0 16px' }}>

        {/* ── Fidélité ── */}
        {tab === 'loyalty' && (
          <div>
            {/* Banner tier */}
            {loyalty ? (
              <>
                <div style={{
                  background: `linear-gradient(135deg, ${loyalty.tier?.color || '#cd7f32'}, ${loyalty.tier?.color || '#cd7f32'}cc)`,
                  borderRadius: 16, padding: '20px 22px', color: '#fff', marginBottom: 16, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 48 }}>{loyalty.tier?.icon || '🥉'}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{loyalty.tier?.name || 'Bronze'}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginTop: 8 }}>{(loyalty.points || 0).toLocaleString('fr-FR')} pts</div>
                  <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
                    {(loyalty.total_earned || 0).toLocaleString('fr-FR')} gagnés · {(loyalty.total_spent || 0).toLocaleString('fr-FR')} utilisés
                  </div>
                  {loyalty.next_tier && (
                    <div style={{ marginTop: 12, fontSize: 12, opacity: 0.9 }}>
                      {loyalty.next_tier.points_needed} pts pour atteindre {loyalty.next_tier.icon} {loyalty.next_tier.name}
                      <div style={{ height: 6, background: 'rgba(255,255,255,.3)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 3, background: '#fff',
                          width: `${Math.round(((loyalty.total_earned - loyalty.tier.min) / (loyalty.next_tier.min - loyalty.tier.min)) * 100)}%`,
                        }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Badges */}
                {loyalty.badges && loyalty.badges.length > 0 && (
                  <div style={cardStyle}>
                    <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>🏅 Mes badges</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {loyalty.badges.map((b, i) => (
                        <div key={i} title={b.description} style={{
                          background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 10,
                          padding: '8px 12px', textAlign: 'center', fontSize: 11,
                        }}>
                          <div style={{ fontSize: 22 }}>{b.icon}</div>
                          <div style={{ fontWeight: 700, marginTop: 2 }}>{b.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Récompenses */}
                {loyaltyRewards.length > 0 && (
                  <div style={cardStyle}>
                    <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>🎁 Récompenses disponibles</div>
                    {redeemMsg && (
                      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: '#15803d' }}>
                        {redeemMsg}
                      </div>
                    )}
                    {loyaltyRewards.map(r => (
                      <div key={r.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                        borderBottom: '1px solid #F3F4F6',
                      }}>
                        <span style={{ fontSize: 24 }}>{r.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: '#6B7280' }}>{r.description}</div>
                          <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>{r.points_cost} pts</div>
                        </div>
                        <button
                          disabled={!r.can_redeem}
                          onClick={() => redeemReward(r.id, r.organization_id)}
                          style={{
                            padding: '7px 14px', borderRadius: 8, border: 'none', cursor: r.can_redeem ? 'pointer' : 'not-allowed',
                            background: r.can_redeem ? 'var(--rb-orange,#FF8A00)' : '#E5E7EB',
                            color: r.can_redeem ? '#fff' : '#9CA3AF', fontWeight: 700, fontSize: 12,
                          }}>
                          {r.can_redeem ? 'Échanger' : `Manque ${r.points_cost - loyalty.points}pts`}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Anniversaire */}
                <div style={cardStyle}>
                  <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>🎂 Date d'anniversaire</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
                    Recevez automatiquement un coupon -15% et 200 pts le jour J !
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: 13 }} />
                    <button onClick={saveBirthday} disabled={savingBday || !birthday}
                      style={{ padding: '8px 16px', background: 'var(--rb-orange,#FF8A00)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                      {savingBday ? '…' : 'Enregistrer'}
                    </button>
                  </div>
                </div>

                {/* Historique transactions */}
                {loyaltyHistory.length > 0 && (
                  <div style={cardStyle}>
                    <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>📜 Historique des points</div>
                    {loyaltyHistory.slice(0, 15).map((tx, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < loyaltyHistory.length - 1 ? '1px solid #F3F4F6' : 'none', fontSize: 12 }}>
                        <div>
                          <span style={{ fontWeight: 600 }}>{tx.description || tx.type}</span>
                          <div style={{ color: '#9CA3AF', fontSize: 10 }}>{new Date(tx.created_at).toLocaleDateString('fr-FR')}</div>
                        </div>
                        <span style={{ fontWeight: 800, color: tx.points > 0 ? '#16a34a' : '#dc2626' }}>
                          {tx.points > 0 ? '+' : ''}{tx.points} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>Chargement…</div>
            )}
          </div>
        )}

        {/* ── Mes commandes ── */}
        {tab === 'orders' && (
          <div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>
              {ordersTotal} commande{ordersTotal > 1 ? 's' : ''}
            </div>
            {ordersLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>Chargement…</div>
            ) : orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 40 }}>🛒</div>
                <div style={{ color: '#9CA3AF', marginTop: 8 }}>Aucune commande pour le moment</div>
                <button onClick={() => navigate('/marketplace')} style={{
                  marginTop: 16, padding: '10px 20px', background: 'var(--rb-orange,#FF8A00)',
                  color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14
                }}>Commander maintenant</button>
              </div>
            ) : (
              <>
                {orders.map(order => {
                  const st = STATUS_LABELS[order.status] || { label: order.status, color: '#9CA3AF' };
                  const total = Number(order.total_amount || 0);
                  return (
                    <div key={order.id} style={cardStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>
                            {order.organization?.name || 'Restaurant'}
                            <span style={{ marginLeft: 8, fontSize: 16 }}>{TYPE_ICONS[order.type] || '🛒'}</span>
                          </div>
                          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                            {new Date(order.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {' · '}Code : <code style={{ fontSize: 11 }}>{order.pickup_code}</code>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: st.color }}>{st.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--rb-orange,#FF8A00)', marginTop: 4 }}>
                            {total.toFixed(2)} MAD
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>
                        {(order.items || []).slice(0, 3).map((it, i) => (
                          <span key={i}>{i > 0 && ', '}{it.quantity}× {it.menu_item?.libelle || '?'}</span>
                        ))}
                        {order.items?.length > 3 && ` +${order.items.length - 3}`}
                      </div>
                      {order.review && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <StarRating rating={order.review.rating} />
                          {order.review.comment && <span style={{ fontSize: 12, color: '#6B7280' }}>{order.review.comment}</span>}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button onClick={() => navigate(`/track/${order.pickup_code}`)} style={{
                          flex: 1, padding: '8px', border: '1px solid #E5E7EB', borderRadius: 8,
                          cursor: 'pointer', fontSize: 12, background: '#fff', fontWeight: 600, color: '#374151'
                        }}>Voir le suivi</button>
                        {order.organization?.slug && (
                          <button onClick={() => navigate(`/r/${order.organization.slug}`)} style={{
                            flex: 1, padding: '8px', border: 'none', borderRadius: 8,
                            cursor: 'pointer', fontSize: 12, background: 'var(--rb-orange,#FF8A00)', color: '#fff', fontWeight: 600
                          }}>Recommander</button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {/* Pagination */}
                {ordersTotal > 10 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                    <button disabled={ordersPage === 1} onClick={() => loadOrders(ordersPage - 1)} style={{ padding: '8px 16px', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', background: '#fff' }}>←</button>
                    <span style={{ padding: '8px 12px', fontSize: 13, color: '#6B7280' }}>Page {ordersPage}</span>
                    <button disabled={ordersPage * 10 >= ordersTotal} onClick={() => loadOrders(ordersPage + 1)} style={{ padding: '8px 16px', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', background: '#fff' }}>→</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Mes adresses ── */}
        {tab === 'addresses' && (
          <div>
            {addresses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
                <div style={{ fontSize: 40 }}>📍</div>
                <div style={{ marginTop: 8 }}>Aucune adresse sauvegardée</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Vos adresses seront sauvegardées lors de la prochaine commande</div>
              </div>
            ) : addresses.map(addr => (
              <div key={addr.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
                    {addr.label}
                    {addr.is_default && <span style={{ marginLeft: 8, fontSize: 10, background: '#DCFCE7', color: '#16A34A', padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>Défaut</span>}
                  </div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{addr.street}</div>
                  {addr.city && <div style={{ fontSize: 12, color: '#9CA3AF' }}>{addr.city}</div>}
                </div>
                <button onClick={() => deleteAddress(addr.id)} style={{
                  background: 'none', border: '1px solid #FCA5A5', borderRadius: 6, padding: '4px 8px',
                  color: '#DC2626', cursor: 'pointer', fontSize: 11
                }}>Supprimer</button>
              </div>
            ))}
          </div>
        )}

        {/* ── Mon profil ── */}
        {tab === 'profile' && (
          <div>
            <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={cardStyle}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Informations personnelles</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Nom complet</label>
                    <input value={editNom} onChange={e => setEditNom(e.target.value)}
                      style={{ width: '100%', padding: '12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Téléphone</label>
                    <input value={editPhone} onChange={e => setEditPhone(e.target.value)}
                      style={{ width: '100%', padding: '12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Email</label>
                    <input value={user.email || ''} disabled
                      style={{ width: '100%', padding: '12px', border: '1px solid #F3F4F6', borderRadius: 8, fontSize: 14, background: '#F9FAFB', color: '#9CA3AF', boxSizing: 'border-box' }} />
                  </div>
                </div>
                {saveMsg && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: '#DCFCE7', borderRadius: 6, fontSize: 13, color: '#16A34A', fontWeight: 600 }}>
                    {saveMsg}
                  </div>
                )}
              </div>
              <button type="submit" disabled={saving} style={{
                padding: '14px', background: saving ? '#9CA3AF' : 'var(--rb-orange,#FF8A00)',
                color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer'
              }}>{saving ? 'Enregistrement…' : 'Enregistrer les modifications'}</button>
            </form>

            <button onClick={logoutCustomer} style={{
              marginTop: 20, width: '100%', padding: '13px', background: '#fff',
              border: '1.5px solid #FCA5A5', borderRadius: 10, color: '#DC2626',
              fontWeight: 600, fontSize: 14, cursor: 'pointer'
            }}>Se déconnecter</button>
          </div>
        )}
      </div>
    </div>
  );
}
