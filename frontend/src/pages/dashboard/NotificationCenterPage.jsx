import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../api';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { useNotificationSocket } from '../../shared/hooks/useNotificationSocket';
import { DashboardIcon } from '../../shared/components/ui/DashboardIcon';
import { PremiumIcon, PremiumIconBadge } from '../../shared/components/ui/PremiumIcon';

const FILTERS = [
  { key: 'all',         label: 'Toutes' },
  { key: 'ORDER',       label: 'Commandes', icon: '🔔' },
  { key: 'PROMOTION',   label: 'Promotions', icon: '🎁' },
  { key: 'CASHBACK',    label: 'Cashback', icon: '💰' },
  { key: 'POINTS',      label: 'Points', icon: '⭐' },
  { key: 'FAMILY',      label: 'Famille', icon: '👨‍👩‍👧' },
  { key: 'PAYMENT',     label: 'Paiement', icon: '🧾' },
  { key: 'MESSAGE',     label: 'Messages', icon: '💬' },
  { key: 'ACCOUNT',     label: 'Compte', icon: '👤' },
  { key: 'SYSTEM',      label: 'Système', icon: 'ℹ️' },
];

const TYPE_ICONS = {
  ORDER_NEW: '🛎️', ORDER_CONFIRMED: '✅', ORDER_PREPARING: '👨‍🍳', ORDER_READY: '🔔',
  ORDER_OUT_DELIVERY: '🛵', ORDER_DELIVERED: '📦', ORDER_SERVED: '🍽️', ORDER_CANCELLED: '❌',
  PROMOTION: '🎁', CASHBACK_EARNED: '💰', POINTS_CREDITED: '⭐', FAMILY_INVITE: '👨‍👩‍👧',
  PAYMENT_RECEIPT: '🧾', MESSAGE: '💬', ACCOUNT_CREATED: '🎉', SYSTEM: 'ℹ️',
  STOCK_BACK: '🔔', PRICE_DROP: '💸',
  COUPON_RECEIVED: '🎁', BADGE_EARNED: '🏅', LEVEL_UP: '🎉', BIRTHDAY: '🎂', REWARD_REDEEMED: '🎁',
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

export default function NotificationCenterPage() {
  const navigate = useNavigate();
  const { authHeader, token } = useCustomerAuth();
  const [filter, setFilter] = useState('all');
  const [notifs, setNotifs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const entity = filter !== 'all' ? `&entity_type=${filter}` : '';
      const d = await fetch(API(`/notifications?status=all&limit=50${entity}`), { headers: authHeader }).then(r => r.json());
      setNotifs(d.notifications || []);
      setTotal(d.total || 0);
    } catch {} setLoading(false);
  }, [authHeader, filter]);

  useEffect(() => { load(); }, [load]);

  useNotificationSocket(token, {
    onNewNotification: () => { if (filter === 'all') load(); },
  });

  async function markRead(n) {
    if (n.status !== 'unread') return;
    setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, status: 'read' } : x));
    try { await fetch(API(`/notifications/${n.id}/read`), { method: 'PATCH', headers: authHeader }); } catch {}
  }

  async function markAllRead() {
    setNotifs(prev => prev.map(x => ({ ...x, status: 'read' })));
    try { await fetch(API('/notifications/mark-all-read'), { method: 'PATCH', headers: authHeader }); } catch {}
  }

  async function dismiss(n) {
    setNotifs(prev => prev.filter(x => x.id !== n.id));
    try { await fetch(API(`/notifications/${n.id}`), { method: 'DELETE', headers: authHeader }); } catch {}
  }

  async function dismissAll() {
    setNotifs([]);
    try { await fetch(API('/notifications'), { method: 'DELETE', headers: authHeader }); } catch {}
  }

  function handleClick(n) {
    markRead(n);
    if (n.action_url) navigate(n.action_url);
  }

  const unreadCount = notifs.filter(n => n.status === 'unread').length;

  return (
    <div className="mk-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--mk-muted)', flex: 1 }}>{total} notification{total > 1 ? 's' : ''}</div>
        <button onClick={() => navigate('/dashboard/notifications/preferences')} className="mk-pill"><PremiumIcon name="settings" size={14} /> Préférences</button>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="mk-pill" style={{ color: 'var(--mk-orange)' }}>Tout marquer lu</button>
        )}
        {notifs.length > 0 && (
          <button onClick={dismissAll} className="mk-pill" style={{ color: 'var(--mk-red)' }}>Tout supprimer</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 18, paddingBottom: 4 }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`mk-pill${filter === f.key ? ' active' : ''}`}>{f.icon && <DashboardIcon icon={f.icon} size={14} />} {f.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--mk-muted)' }}>Chargement…</div>
      ) : notifs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <PremiumIconBadge name="bell" size={24} style={{ margin:'0 auto 8px' }} />
          <div style={{ color: 'var(--mk-muted)', fontSize: 13 }}>Aucune notification</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notifs.map(n => {
            const icon = TYPE_ICONS[n.type] || '🔔';
            const unread = n.status === 'unread';
            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className="mk-card"
                style={{
                  padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start',
                  cursor: n.action_url ? 'pointer' : 'default',
                  background: unread ? 'var(--mk-orange-light)' : 'var(--mk-card)',
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--mk-pill)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <DashboardIcon icon={icon} size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: unread ? 700 : 600, fontSize: 13.5, color: 'var(--mk-text)' }}>{n.title}</div>
                  {n.message && <div style={{ fontSize: 12.5, color: 'var(--mk-muted)', marginTop: 2 }}>{n.message}</div>}
                  <div style={{ fontSize: 11, color: 'var(--mk-muted)', marginTop: 6 }}>{timeAgo(n.created_at)}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); dismiss(n); }} style={{ background: 'none', border: 'none', color: 'var(--mk-muted)', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>✕</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
