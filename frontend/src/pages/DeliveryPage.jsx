import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { Toast } from '../components/ui/Toast';

const DELIVERY_STATUS_FLOW = [
  { from: 'assigned',  to: 'picking_up',  label: 'Je pars chercher la commande' },
  { from: 'picking_up', to: 'picked_up',  label: 'J\'ai récupéré la commande' },
  { from: 'picked_up',  to: 'on_the_way', label: 'Je suis en route vers le client' },
  { from: 'on_the_way', to: 'delivered',  label: 'Commande livrée ✓' },
];

const STATUS_LABELS = {
  pending:    '⏳ En attente',
  assigned:   '👋 Assignée',
  picking_up: '🛵 En route resto',
  picked_up:  '📦 Récupérée',
  on_the_way: '📍 En route client',
  delivered:  '✅ Livrée',
  failed:     '❌ Échouée',
};

export default function DeliveryPage() {
  const { user } = useAuth();
  const { get, post, patch } = useApi();

  const [available, setAvailable]   = useState([]);
  const [myDelivery, setMyDelivery] = useState(null);
  const [history, setHistory]       = useState([]);
  const [todaySummary, setTodaySummary] = useState(null);
  const [tab, setTab]               = useState('available');
  const [loading, setLoading]       = useState(false);
  const [msg, setMsg]               = useState('');
  const [msgKind, setMsgKind]       = useState('success');

  function toast(m, kind = 'success') { setMsg(m); setMsgKind(kind); }

  async function loadAvailable() {
    try { const d = await get('/delivery/available'); setAvailable(d.available || []); } catch {}
  }

  async function loadHistory() {
    try {
      const d = await get('/delivery/history');
      setHistory(d.history || []);
      setTodaySummary(d.today_summary || null);
      // Trouver la livraison en cours
      const active = (d.history || []).find(h => !['delivered','failed'].includes(h.status));
      setMyDelivery(active || null);
    } catch {}
  }

  useEffect(() => {
    loadAvailable();
    loadHistory();
    const id = setInterval(() => { loadAvailable(); loadHistory(); }, 20000);
    return () => clearInterval(id);
  }, []);

  async function acceptDelivery(orderId) {
    setLoading(true);
    try {
      await post(`/delivery/accept/${orderId}`, {});
      toast('Livraison acceptée ! Bonne route 🛵');
      await loadHistory();
      await loadAvailable();
      setTab('current');
    } catch (e) {
      toast(e.message || 'Erreur', 'error');
    }
    setLoading(false);
  }

  async function updateStatus(orderId, newStatus) {
    setLoading(true);
    try {
      await patch(`/delivery/${orderId}/status`, { status: newStatus });
      if (newStatus === 'delivered') toast('Livraison terminée ! Bien joué 🎉');
      else toast('Statut mis à jour');
      await loadHistory();
      await loadAvailable();
    } catch (e) {
      toast(e.message || 'Erreur', 'error');
    }
    setLoading(false);
  }

  function getNextAction(status) {
    return DELIVERY_STATUS_FLOW.find(f => f.from === status);
  }

  const cardStyle = {
    background: '#fff', borderRadius: 12, padding: 16,
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 12
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Toast message={msg} onClose={() => setMsg('')} kind={msgKind} />

      <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 16px', color: '#111827' }}>
        🛵 Espace Livreur
      </h2>

      {/* Stats du jour */}
      {todaySummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Livraisons', value: todaySummary.count },
            { label: 'Terminées', value: todaySummary.completed },
            { label: 'Gains', value: `${todaySummary.earnings?.toFixed(2)} MAD` },
          ].map(s => (
            <div key={s.label} style={{ ...cardStyle, textAlign: 'center', padding: '12px 8px', marginBottom: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--rb-orange,#FF8A00)' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #F3F4F6', marginBottom: 16, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {[
          { key: 'available', label: `📋 Disponibles (${available.length})` },
          { key: 'current',   label: '🚀 En cours' },
          { key: 'history',   label: '📅 Historique' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: tab === t.key ? 700 : 400,
            color: tab === t.key ? 'var(--rb-orange,#FF8A00)' : '#6B7280',
            borderBottom: tab === t.key ? '2px solid var(--rb-orange,#FF8A00)' : '2px solid transparent',
            marginBottom: -2, whiteSpace: 'nowrap'
          }}>{t.label}</button>
        ))}
      </div>

      {/* Livraisons disponibles */}
      {tab === 'available' && (
        <div>
          {available.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
              <div style={{ fontSize: 32 }}>🛵</div>
              <div style={{ marginTop: 8 }}>Aucune livraison disponible pour le moment</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Les nouvelles commandes apparaîtront ici</div>
            </div>
          ) : available.map(d => (
            <div key={d.order_id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
                    {d.restaurant.name}
                  </div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                    📍 {d.restaurant.address || 'Adresse non renseignée'}
                  </div>
                  {d.restaurant.phone && (
                    <a href={`tel:${d.restaurant.phone}`} style={{ fontSize: 12, color: 'var(--rb-orange,#FF8A00)' }}>
                      {d.restaurant.phone}
                    </a>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: 'var(--rb-orange,#FF8A00)', fontSize: 15 }}>
                    +{Number(d.fee).toFixed(2)} MAD
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>{d.items_count} article(s)</div>
                </div>
              </div>
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#F9FAFB', borderRadius: 8, fontSize: 13, color: '#374151' }}>
                📦 Client : {d.guest_name}<br />
                🏠 {d.delivery_address}
              </div>
              <button
                onClick={() => acceptDelivery(d.order_id)}
                disabled={loading}
                style={{
                  marginTop: 12, width: '100%', padding: '12px', background: '#16A34A',
                  color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer'
                }}
              >
                {loading ? '…' : '✓ Accepter cette livraison'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Livraison en cours */}
      {tab === 'current' && (
        <div>
          {!myDelivery ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
              <div style={{ fontSize: 32 }}>✅</div>
              <div style={{ marginTop: 8 }}>Pas de livraison en cours</div>
              <button onClick={() => setTab('available')} style={{
                marginTop: 12, padding: '10px 20px', background: 'var(--rb-orange,#FF8A00)',
                color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14
              }}>
                Voir les livraisons disponibles
              </button>
            </div>
          ) : (
            <div>
              <div style={cardStyle}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                  {STATUS_LABELS[myDelivery.status] || myDelivery.status}
                </div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>Code : {myDelivery.pickup_code}</div>
                <div style={{ marginTop: 10, fontSize: 14, color: '#374151' }}>
                  <div>👤 Client : {myDelivery.guest_name}</div>
                  <div style={{ marginTop: 4 }}>🏠 Adresse : {myDelivery.delivery_address}</div>
                  {myDelivery.restaurant_name && (
                    <div style={{ marginTop: 4 }}>🏪 Restaurant : {myDelivery.restaurant_name}</div>
                  )}
                </div>
              </div>

              {getNextAction(myDelivery.status) && (
                <button
                  onClick={() => updateStatus(myDelivery.order_id, getNextAction(myDelivery.status).to)}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '15px', background: 'var(--rb-orange,#FF8A00)',
                    color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(234,88,12,0.3)'
                  }}
                >
                  {loading ? 'Mise à jour…' : getNextAction(myDelivery.status).label}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Historique */}
      {tab === 'history' && (
        <div>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
              <div style={{ fontSize: 32 }}>📅</div>
              <div style={{ marginTop: 8 }}>Aucune livraison dans l'historique</div>
            </div>
          ) : history.map(h => (
            <div key={h.delivery_id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{h.restaurant_name || 'Restaurant'}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                  {h.created_at ? new Date(h.created_at).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : ''}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{h.guest_name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: ['delivered'].includes(h.status) ? '#16A34A' : '#9CA3AF', fontWeight: 600 }}>
                  {STATUS_LABELS[h.status] || h.status}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--rb-orange,#FF8A00)', marginTop: 4 }}>
                  +{Number(h.fee).toFixed(2)} MAD
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
