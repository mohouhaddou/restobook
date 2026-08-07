import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useNotificationSocket } from '../hooks/useNotificationSocket';
import { DashboardIcon } from '../components/ui/DashboardIcon';
import { PremiumIcon, PremiumIconBadge } from '../components/ui/PremiumIcon';

/**
 * Centre de notifications générique — commerçant / livreur / superadmin
 * (le dashboard client a son équivalent dédié : pages/dashboard/NotificationCenterPage.jsx).
 * Même API /api/notifications, mêmes filtres que NotificationBell.jsx.
 */

const FILTERS = [
  { key: 'all',         label: 'Toutes', icon: 'inbox' },
  { key: 'ORDER',       label: 'Commandes', icon: 'bell' },
  { key: 'RESERVATION', label: 'Réservations', icon: 'calendar' },
  { key: 'DELIVERY',    label: 'Livraisons', icon: 'delivery' },
  { key: 'ACCOUNT',     label: 'Compte', icon: 'user' },
  { key: 'SYSTEM',      label: 'Système', icon: 'info' },
];

const TYPE_ICONS = {
  ORDER_NEW: 'bell', ORDER_CONFIRMED: 'check', ORDER_PREPARING: 'chef', ORDER_READY: 'bell',
  ORDER_OUT_DELIVERY: 'delivery', ORDER_DELIVERED: 'package', ORDER_SERVED: 'utensils', ORDER_CANCELLED: 'close',
  ORDER_PAID: 'card', RESERVATION_NEW: 'calendar', RESERVATION_CONFIRMED: 'check', RESERVATION_CANCELLED: 'close',
  ACCOUNT_CREATED: 'user', PRO_ACCOUNT_CREATED: 'rocket', DELIVERY_DOC_EXPIRING: 'fileText',
  LOCATION_MISSING: 'mapPin', SYSTEM: 'info',
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { get, patch, del, token } = useApi();
  const [filter, setFilter] = useState('all');
  const [notifs, setNotifs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const entity = filter !== 'all' ? `&entity_type=${filter}` : '';
      const d = await get(`/notifications?status=all&limit=50${entity}`);
      setNotifs(d.notifications || []);
      setTotal(d.total || 0);
    } catch {} setLoading(false);
  }, [get, filter]);

  useEffect(() => { load(); }, [load]);

  useNotificationSocket(token, {
    onNewNotification: () => { if (filter === 'all') load(); },
  });

  async function markRead(n) {
    if (n.status !== 'unread') return;
    setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, status: 'read' } : x));
    try { await patch(`/notifications/${n.id}/read`, {}); } catch {}
  }

  async function markAllRead() {
    setNotifs(prev => prev.map(x => ({ ...x, status: 'read' })));
    try { await patch('/notifications/mark-all-read', {}); } catch {}
  }

  async function dismiss(n) {
    setNotifs(prev => prev.filter(x => x.id !== n.id));
    try { await del(`/notifications/${n.id}`); } catch {}
  }

  async function dismissAll() {
    setNotifs([]);
    try { await del('/notifications'); } catch {}
  }

  function handleClick(n) {
    markRead(n);
    if (n.action_url) navigate(n.action_url);
  }

  const unreadCount = notifs.filter(n => n.status === 'unread').length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, flex: 1 }}>Notifications</h1>
        <button onClick={() => navigate('/notifications/preferences')} style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}><PremiumIcon name="settings" size={14} /> Préférences</button>
        <div style={{ fontSize: 13, color: '#9CA3AF' }}>{total} notification{total > 1 ? 's' : ''}</div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{ fontSize: 12, fontWeight: 700, color: 'var(--rb-orange,#FF8A00)', background: 'none', border: 'none', cursor: 'pointer' }}>Tout marquer lu</button>
        )}
        {notifs.length > 0 && (
          <button onClick={dismissAll} style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer' }}>Tout supprimer</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 18, paddingBottom: 4 }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap',
            border: `1.5px solid ${filter === f.key ? 'var(--rb-orange,#FF8A00)' : '#E5E7EB'}`,
            background: filter === f.key ? '#FFF7ED' : '#fff',
            color: filter === f.key ? 'var(--rb-orange,#FF8A00)' : '#6B7280',
            fontWeight: filter === f.key ? 700 : 500, fontSize: 12.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
          }}><DashboardIcon icon={f.icon} size={14} /> {f.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Chargement…</div>
      ) : notifs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <PremiumIconBadge name="bell" size={26} style={{ marginBottom: 8 }} />
          <div style={{ color: '#9CA3AF', fontSize: 13 }}>Aucune notification</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notifs.map(n => {
            const icon = TYPE_ICONS[n.type] || 'bell';
            const unread = n.status === 'unread';
            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start',
                  cursor: n.action_url ? 'pointer' : 'default', borderRadius: 12,
                  border: '1px solid #E5E7EB',
                  background: unread ? '#FFF7ED' : '#fff',
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--rb-orange,#FF8A00)' }}>
                  <DashboardIcon icon={icon} size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: unread ? 700 : 600, fontSize: 13.5, color: '#111827' }}>{n.title}</div>
                  {n.message && <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 2 }}>{n.message}</div>}
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>{timeAgo(n.created_at)}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); dismiss(n); }} aria-label="Supprimer" style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', flexShrink: 0, width: 32, height: 32, display: 'grid', placeItems: 'center' }}><PremiumIcon name="close" size={16} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
