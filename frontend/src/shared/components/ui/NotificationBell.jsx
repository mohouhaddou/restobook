import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API } from '../../../api';
import { useNotificationSocket } from '../../hooks/useNotificationSocket';
import { onForegroundMessage } from '../../../config/firebase';
import { DashboardIcon } from './DashboardIcon';
import { PremiumIcon, PremiumIconBadge } from './PremiumIcon';

// ── Icônes et couleurs par type ──────────────────────────────────────────────
const TYPE_META = {
  ORDER_NEW:           { icon: '🛎️', color: '#FF8A00', label: 'Commande' },
  ORDER_CONFIRMED:     { icon: '✅', color: '#16A34A', label: 'Commande' },
  ORDER_PREPARING:     { icon: '👨‍🍳', color: '#2563EB', label: 'Commande' },
  ORDER_READY:         { icon: '🔔', color: '#D97706', label: 'Commande' },
  ORDER_OUT_DELIVERY:  { icon: '🛵', color: '#7C3AED', label: 'Livraison' },
  ORDER_DELIVERED:     { icon: '📦', color: '#16A34A', label: 'Livraison' },
  ORDER_SERVED:        { icon: '🍽️', color: '#16A34A', label: 'Table' },
  ORDER_CANCELLED:     { icon: '❌', color: '#DC2626', label: 'Commande' },
  ORDER_PAID:          { icon: '💳', color: '#16A34A', label: 'Paiement' },
  RESERVATION_NEW:     { icon: '📅', color: '#FF8A00', label: 'Réservation' },
  RESERVATION_CONFIRMED: { icon: '✅', color: '#16A34A', label: 'Réservation' },
  RESERVATION_CANCELLED: { icon: '❌', color: '#DC2626', label: 'Réservation' },
  ACCOUNT_CREATED:     { icon: '🎉', color: '#7C3AED', label: 'Compte' },
  EMAIL_VERIFY:        { icon: '📧', color: '#D97706', label: 'Email' },
  EMAIL_VERIFIED:      { icon: '✅', color: '#16A34A', label: 'Email' },
  PRO_ACCOUNT_CREATED: { icon: '🚀', color: '#FF8A00', label: 'Compte pro' },
  LOCATION_MISSING:    { icon: '📍', color: '#D97706', label: 'Localisation' },
  PROFILE_INCOMPLETE:  { icon: '⚠️', color: '#D97706', label: 'Profil' },
  MARKETPLACE_PUBLISHED: { icon: '🌐', color: '#16A34A', label: 'Marketplace' },
  SUBSCRIPTION_EXPIRING: { icon: '⏰', color: '#DC2626', label: 'Abonnement' },
  STOCK_BACK:          { icon: '🔔', color: '#16A34A', label: 'Liste de courses' },
  PRICE_DROP:          { icon: '💸', color: '#16A34A', label: 'Liste de courses' },
  SYSTEM:              { icon: 'ℹ️', color: '#64748B', label: 'Système' },
  COURIER_OFFER:       { icon: '🛵', color: '#7C3AED', label: 'Livraison' },
  POINTS_CREDITED:     { icon: '⭐', color: '#F59E0B', label: 'Points' },
  CASHBACK_EARNED:     { icon: '💰', color: '#16A34A', label: 'Cashback' },
  BADGE_EARNED:        { icon: '🏅', color: '#7C3AED', label: 'Badge' },
  COUPON_RECEIVED:     { icon: '🎁', color: '#FF8A00', label: 'Promotion' },
  LEVEL_UP:            { icon: '🎉', color: '#7C3AED', label: 'Fidélité' },
  BIRTHDAY:            { icon: '🎂', color: '#EC4899', label: 'Anniversaire' },
  REWARD_REDEEMED:     { icon: '🎁', color: '#FF8A00', label: 'Récompense' },
  LOYALTY_RULE_APPROVED: { icon: '✅', color: '#16A34A', label: 'Fidélité' },
  LOYALTY_RULE_REJECTED: { icon: '❌', color: '#DC2626', label: 'Fidélité' },
  SIGNUP_REQUEST:      { icon: '👤', color: '#D97706', label: 'Compte' },
};

function getMeta(type) {
  return TYPE_META[type] || { icon: '🔔', color: '#64748B', label: 'Notification' };
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return 'à l\'instant';
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

const ENTITY_FILTERS = [
  { key: 'all',         label: 'Toutes' },
  { key: 'ORDER',       label: 'Commandes', icon: '🛎️' },
  { key: 'RESERVATION', label: 'Réservations', icon: '📅' },
  { key: 'ACCOUNT',     label: 'Compte', icon: '👤' },
  { key: 'SYSTEM',      label: 'Système', icon: 'ℹ️' },
];

// ════════════════════════════════════════════════════════════════════════════
// NotificationBell — composant universel (pro + client)
// Props :
//   token      : JWT string (requis)
//   theme      : 'light' | 'dark' (optionnel, défaut 'light')
//   onNavigate : function(url) — appelée quand l'utilisateur clique une notif avec action_url
// ════════════════════════════════════════════════════════════════════════════
export function NotificationBell({ token, theme = 'light', onNavigate, centerUrl }) {
  const [open, setOpen]         = useState(false);
  const [count, setCount]       = useState(0);
  const [notifs, setNotifs]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [filter, setFilter]     = useState('all');
  const [page, setPage]         = useState(0);
  const [hasMore, setHasMore]   = useState(false);
  const dropRef = useRef(null);
  const pollRef = useRef(null);

  const isDark = theme === 'dark';
  const surface = isDark ? '#0F172A' : '#FFFFFF';
  const border  = isDark ? '#1E293B' : '#E5E7EB';
  const text    = isDark ? '#F1F5F9' : '#111827';
  const muted   = isDark ? '#64748B' : '#9CA3AF';
  const pill    = isDark ? '#1E293B' : '#F3F4F6';

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchCount = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(API('/notifications/unread-count'), { headers: authHeader });
      const d = await r.json();
      setCount(d.count || 0);
    } catch {}
  }, [token]);

  const fetchNotifs = useCallback(async (reset = false) => {
    if (!token) return;
    setLoading(true);
    try {
      const offset = reset ? 0 : page * 20;
      const entity = filter !== 'all' ? `&entity_type=${filter}` : '';
      const r = await fetch(API(`/notifications?status=all&limit=20&offset=${offset}${entity}`), { headers: authHeader });
      const d = await r.json();
      const incoming = d.notifications || [];
      setNotifs(prev => reset ? incoming : [...prev, ...incoming]);
      setHasMore(incoming.length === 20);
      if (reset) setPage(0);
    } catch {}
    setLoading(false);
  }, [token, filter, page]);

  // Poll unread count toutes les 30s — filet de sécurité (reconnexion socket,
  // notifications broadcast org non poussées en temps réel, voir NotificationService.create).
  useEffect(() => {
    fetchCount();
    pollRef.current = setInterval(fetchCount, 30000);
    return () => clearInterval(pollRef.current);
  }, [fetchCount]);

  // Temps réel — badge instantané dès qu'une notification personnelle arrive
  useNotificationSocket(token, {
    onNewNotification: (n) => {
      setCount(c => c + 1);
      setNotifs(prev => (open && filter === 'all') ? [{ ...n, status: 'unread' }, ...prev] : prev);
    },
  });

  // Push FCM reçu onglet au premier plan — le service worker (firebase-messaging-sw.js)
  // ne gère QUE le cas arrière-plan/onglet fermé (onBackgroundMessage). Sans ceci,
  // un push arrivant pendant que l'utilisateur a l'app ouverte n'affiche jamais rien
  // (le badge socket ci-dessus couvre déjà la mise à jour du compteur/liste — on
  // affiche en plus une vraie notification navigateur pour rester cohérent avec
  // l'expérience "push" attendue par l'utilisateur, même onglet actif).
  useEffect(() => {
    let unsubscribe = () => {};
    onForegroundMessage((payload) => {
      const title = payload?.notification?.title || payload?.data?.title;
      const body = payload?.notification?.body || payload?.data?.body;
      if (title && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/brand/ifilino_favicon.png' });
      }
    }).then(fn => { unsubscribe = fn; });
    return () => unsubscribe();
  }, []);

  // Recharger quand filtre change
  useEffect(() => {
    if (open) fetchNotifs(true);
  }, [filter, open]);

  // Fermer sur clic extérieur
  useEffect(() => {
    function handler(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next) fetchNotifs(true);
  }

  async function markRead(n) {
    if (n.status !== 'unread') return;
    try {
      await fetch(API(`/notifications/${n.id}/read`), { method: 'PATCH', headers: authHeader });
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, status: 'read' } : x));
      setCount(prev => Math.max(0, prev - 1));
    } catch {}
  }

  async function markAllRead() {
    try {
      await fetch(API('/notifications/mark-all-read'), { method: 'PATCH', headers: authHeader });
      setNotifs(prev => prev.map(x => ({ ...x, status: 'read' })));
      setCount(0);
    } catch {}
  }

  async function dismiss(n, e) {
    e.stopPropagation();
    try {
      await fetch(API(`/notifications/${n.id}`), { method: 'DELETE', headers: authHeader });
      setNotifs(prev => prev.filter(x => x.id !== n.id));
      if (n.status === 'unread') setCount(prev => Math.max(0, prev - 1));
    } catch {}
  }

  async function dismissAll() {
    try {
      await fetch(API('/notifications'), { method: 'DELETE', headers: authHeader });
      setNotifs([]);
      setCount(0);
    } catch {}
  }

  function handleClick(n) {
    markRead(n);
    if (n.action_url && onNavigate) { onNavigate(n.action_url); setOpen(false); }
  }

  const unreadCount = Math.min(count, 99);

  return (
    <div ref={dropRef} style={{ position: 'relative', flexShrink: 0 }}>
      {/* ── Bouton cloche ── */}
      <button
        onClick={handleOpen}
        title="Notifications"
        style={{
          width: 36, height: 36, borderRadius: 10, border: 'none',
          background: open ? (isDark ? '#1E293B' : '#F3F4F6') : 'transparent',
          color: isDark ? '#CBD5E1' : '#374151',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, position: 'relative', transition: 'background .15s', flexShrink: 0,
        }}
      >
        <PremiumIcon name="bell" size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            background: '#DC2626', color: '#fff', fontSize: 9, fontWeight: 800,
            minWidth: 16, height: 16, borderRadius: 8, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: '0 3px', lineHeight: 1, border: `2px solid ${surface}`,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div style={{
          position: 'absolute', top: 44, right: 0, width: 360,
          background: surface, border: `1px solid ${border}`, borderRadius: 16,
          boxShadow: '0 16px 48px rgba(0,0,0,.18)', zIndex: 1000, overflow: 'hidden',
          animation: 'nb-slideDown .2s ease',
          maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: text, flex: 1 }}>
              Notifications {count > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', padding: '2px 7px', borderRadius: 20, marginLeft: 6 }}>{count} non lues</span>}
            </span>
            {count > 0 && (
              <button onClick={markAllRead} style={{ fontSize: 11, color: '#FF8A00', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 8px', borderRadius: 6, flexShrink: 0 }}>
                Tout marquer lu
              </button>
            )}
            {notifs.length > 0 && (
              <button onClick={dismissAll} style={{ fontSize: 11, color: '#DC2626', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 8px', borderRadius: 6, flexShrink: 0 }}>
                Tout supprimer
              </button>
            )}
          </div>

          {/* Filtres */}
          <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: `1px solid ${border}`, overflowX: 'auto', flexShrink: 0 }}>
            {ENTITY_FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                padding: '4px 10px', borderRadius: 20, border: `1.5px solid ${filter === f.key ? '#FF8A00' : border}`,
                background: filter === f.key ? '#FFF7ED' : 'transparent',
                color: filter === f.key ? '#FF8A00' : muted,
                fontWeight: filter === f.key ? 700 : 500, fontSize: 11, cursor: 'pointer',
                whiteSpace: 'nowrap', fontFamily: 'inherit',
              }}>{f.icon && <DashboardIcon icon={f.icon} size={13} />} {f.label}</button>
            ))}
          </div>

          {/* Liste */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && notifs.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: muted, fontSize: 13 }}>
                <div style={{ width: 24, height: 24, border: '2px solid #E5E7EB', borderTopColor: '#FF8A00', borderRadius: '50%', animation: 'nb-spin .7s linear infinite', margin: '0 auto 8px' }} />
                Chargement…
              </div>
            ) : notifs.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <PremiumIconBadge name="bell" size={24} style={{ margin:'0 auto 8px' }} />
                <div style={{ fontWeight: 700, fontSize: 14, color: text, marginBottom: 4 }}>Aucune notification</div>
                <div style={{ fontSize: 12, color: muted }}>Tout est calme pour l'instant !</div>
              </div>
            ) : (
              <>
                {notifs.map(n => {
                  const meta = getMeta(n.type);
                  const unread = n.status === 'unread';
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleClick(n)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px',
                        borderBottom: `1px solid ${border}`, cursor: n.action_url ? 'pointer' : 'default',
                        background: unread ? (isDark ? '#0F172A' : '#FFFBF5') : 'transparent',
                        transition: 'background .15s', position: 'relative',
                      }}
                      onMouseEnter={e => { if (!unread) e.currentTarget.style.background = isDark ? '#1E293B' : '#F9FAFB'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = unread ? (isDark ? '#0F172A' : '#FFFBF5') : 'transparent'; }}
                    >
                      {/* Dot non lu */}
                      {unread && <div style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', width: 6, height: 6, borderRadius: '50%', background: '#FF8A00', flexShrink: 0 }} />}

                      {/* Icône */}
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: meta.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
                        <DashboardIcon icon={meta.icon} size={17} />
                      </div>

                      {/* Contenu */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: unread ? 700 : 500, fontSize: 13, color: text, marginBottom: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                          {n.title}
                        </div>
                        {n.message && (
                          <div style={{ fontSize: 12, color: muted, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 4 }}>
                            {n.message}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, background: meta.color + '15', padding: '1px 6px', borderRadius: 20 }}>{meta.label}</span>
                          <span style={{ fontSize: 10, color: muted }}>{timeAgo(n.created_at)}</span>
                          {n.priority === 'high' || n.priority === 'urgent'
                            ? <span style={{ fontSize: 10, color: '#DC2626', fontWeight: 700 }}>● Urgent</span>
                            : null
                          }
                        </div>
                      </div>

                      {/* Dismiss */}
                      <button onClick={e => dismiss(n, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, fontSize: 14, padding: '2px 4px', borderRadius: 4, flexShrink: 0, lineHeight: 1, fontFamily: 'inherit' }} title="Archiver"><PremiumIcon name="close" size={14} /></button>
                    </div>
                  );
                })}

                {hasMore && (
                  <button onClick={() => { setPage(p => p + 1); fetchNotifs(false); }} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#FF8A00', fontWeight: 700, fontFamily: 'inherit' }}>
                    Voir plus…
                  </button>
                )}
              </>
            )}
          </div>

          {centerUrl && (
            <button
              onClick={() => { setOpen(false); onNavigate?.(centerUrl); }}
              style={{ flexShrink: 0, width: '100%', padding: '11px', border: 'none', borderTop: `1px solid ${border}`, background: 'none', cursor: 'pointer', fontSize: 12.5, color: isDark ? '#CBD5E1' : '#374151', fontWeight: 700, fontFamily: 'inherit' }}>
              Voir toutes les notifications →
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes nb-slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes nb-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
