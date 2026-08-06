import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { API } from '../../api';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { STATUS_META, TYPE_ICONS } from '../../shared/config/orderStatus';
import { OrderTimeline } from '../../shared/components/dashboard/OrderTimeline';
import { useI18n } from '../../i18n/config';
import { translateOrderStatus } from '../../i18n/status';
import { DashboardIcon } from '../../shared/components/ui/DashboardIcon';
import { PremiumIcon } from '../../shared/components/ui/PremiumIcon';

const cardStyle = {
  background: 'var(--mk-card)', border: '1px solid var(--mk-border)', borderRadius: 16,
  padding: 16, marginBottom: 12,
};

const TABS = [
  { key: 'current', labelKey: 'dashboard.activity.tabs.current', icon: '📦' },
  { key: 'history', labelKey: 'dashboard.activity.tabs.history', icon: '🕓' },
  { key: 'reservations', labelKey: 'dashboard.activity.tabs.reservations', icon: '🪑' },
  { key: 'favorites', labelKey: 'dashboard.activity.tabs.favorites', icon: '❤️' },
];

const RESERVATION_STATUS_META = {
  pending:   { labelKey: 'status.reservation.pending', color: '#D97706', icon: '⏳' },
  confirmed: { labelKey: 'status.reservation.confirmed',  color: '#16A34A', icon: '✅' },
  seated:    { labelKey: 'status.reservation.seated',   color: '#2563EB', icon: '🪑' },
  cancelled: { labelKey: 'status.reservation.cancelled',    color: '#DC2626', icon: '❌' },
  no_show:   { labelKey: 'status.reservation.no_show',    color: 'var(--mk-muted)', icon: '👻' },
};

function normalizeDateInput(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : raw;
}

function safeFormatDate(formatDate, value, options, fallback = '—') {
  const normalized = normalizeDateInput(value);
  if (!normalized) return fallback;
  try {
    return formatDate(normalized, options);
  } catch {
    return fallback;
  }
}

function ReservationCard({ reservation, navigate, t, formatDate }) {
  const st = RESERVATION_STATUS_META[reservation.status] || { label: reservation.status, color: 'var(--mk-muted)', icon: '📅' };
  const dateLabel = safeFormatDate(
    formatDate,
    reservation.date_jour ? reservation.date_jour + 'T00:00:00' : null,
    { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' },
  );
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--mk-text)' }}>
            {reservation.organization?.name || t('common.restaurant')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--mk-muted)', marginTop: 2 }}>
            {safeFormatDate(formatDate, reservation.createdAt || reservation.created_at, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }, '')}
            {t('dashboard.activity.reservedFor', { date: dateLabel, time: reservation.time_slot })}
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: st.color, whiteSpace: 'nowrap' }}><DashboardIcon icon={st.icon} size={14} /> {st.labelKey ? t(st.labelKey) : reservation.status}</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--mk-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span className="premium-inline-icon"><DashboardIcon icon="👥" size={14} />{t('dashboard.activity.guestCount', { count: reservation.guests_count })}</span>
        {reservation.table_label && <span className="premium-inline-icon"><DashboardIcon icon="table" size={14} />{reservation.table_label}</span>}
      </div>
      {reservation.organization?.slug && (
        <button onClick={() => navigate(`/r/${reservation.organization.slug}`)} style={{
          marginTop: 10, width: '100%', padding: '8px', border: '1px solid var(--mk-border)', borderRadius: 8,
          cursor: 'pointer', fontSize: 12, background: 'var(--mk-surface)', fontWeight: 600, color: 'var(--mk-text2)',
        }}>{t('dashboard.activity.viewRestaurant')}</button>
      )}
    </div>
  );
}

function OrderCard({ order, navigate, t, formatDate, formatCurrency }) {
  const st = STATUS_META[order.status] || { label: order.status, color: 'var(--mk-muted)' };
  const statusLabel = translateOrderStatus(t, order.status);
  const total = Number(order.total_amount || 0);
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--mk-text)' }}>
            {order.organization?.name || t('common.restaurant')}
            <span style={{ marginLeft: 8 }}><DashboardIcon icon={TYPE_ICONS[order.type] || '🛒'} size={16} /></span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--mk-muted)', marginTop: 2 }}>
            {safeFormatDate(formatDate, order.created_at || order.createdAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {t('dashboard.activity.codeLabel')}  <code style={{ fontSize: 11 }}>{order.pickup_code}</code>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: st.color }}><DashboardIcon icon={st.icon} size={14} /> {statusLabel}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--mk-orange)', marginTop: 4 }}>{formatCurrency(total)}</div>
        </div>
      </div>
      {order.items?.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--mk-muted)', marginBottom: 10 }}>
          {order.items.slice(0, 3).map((it, i) => (
            <span key={i}>{i > 0 && ', '}{it.quantity}× {it.menu_item?.libelle || '?'}</span>
          ))}
          {order.items.length > 3 && ` +${order.items.length - 3}`}
        </div>
      )}
      {!['delivered', 'cancelled', 'picked_up'].includes(order.status) && (
        <div style={{ marginBottom: 10 }}><OrderTimeline order={order} compact /></div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => navigate(`/track/${order.pickup_code}`)} style={{
          flex: 1, padding: '8px', border: '1px solid var(--mk-border)', borderRadius: 8,
          cursor: 'pointer', fontSize: 12, background: 'var(--mk-surface)', fontWeight: 600, color: 'var(--mk-text2)',
        }}>{t('dashboard.activity.trackOrder')}</button>
        {order.organization?.slug && (
          <button onClick={() => navigate(`/r/${order.organization.slug}`)} style={{
            flex: 1, padding: '8px', border: 'none', borderRadius: 8,
            cursor: 'pointer', fontSize: 12, background: 'var(--mk-orange)', color: '#fff', fontWeight: 600,
          }}>{t('dashboard.activity.orderAgain')}</button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, text, cta, onCta }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <DashboardIcon icon={icon} size={34} badge />
      <div style={{ color: 'var(--mk-muted)', marginTop: 8, fontSize: 13 }}>{text}</div>
      {cta && (
        <button onClick={onCta} style={{ marginTop: 16, padding: '10px 20px', background: 'var(--mk-orange)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
          {cta}
        </button>
      )}
    </div>
  );
}

export default function ActivityPage() {
  const navigate = useNavigate();
  const { t, formatDate, formatCurrency } = useI18n();
  const { authHeader } = useCustomerAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'current';

  const [activeOrders, setActiveOrders] = useState([]);
  const [loadingActive, setLoadingActive] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [reservations, setReservations] = useState([]);
  const [reservationsTotal, setReservationsTotal] = useState(0);
  const [reservationsPage, setReservationsPage] = useState(1);
  const [loadingReservations, setLoadingReservations] = useState(false);

  const [favorites, setFavorites] = useState([]);
  const [loadingFav, setLoadingFav] = useState(false);

  const setTab = (t) => setSearchParams(t === 'current' ? {} : { tab: t });

  const loadActive = useCallback(async () => {
    setLoadingActive(true);
    try {
      const d = await fetch(API('/dashboard/home'), { headers: authHeader }).then(r => r.json());
      setActiveOrders(d.active_orders || []);
    } catch {} setLoadingActive(false);
  }, [authHeader]);

  const loadHistory = useCallback(async (page = 1) => {
    setLoadingHistory(true);
    try {
      const d = await fetch(API(`/marketplace/me/orders?page=${page}&limit=10`), { headers: authHeader }).then(r => r.json());
      setHistory(d.orders || []);
      setHistoryTotal(d.total || 0);
      setHistoryPage(page);
    } catch {} setLoadingHistory(false);
  }, [authHeader]);

  const loadReservations = useCallback(async (page = 1) => {
    setLoadingReservations(true);
    try {
      const d = await fetch(API(`/marketplace/me/reservations?page=${page}&limit=10`), { headers: authHeader }).then(r => r.json());
      setReservations(d.reservations || []);
      setReservationsTotal(d.total || 0);
      setReservationsPage(page);
    } catch {} setLoadingReservations(false);
  }, [authHeader]);

  const loadFavorites = useCallback(async () => {
    setLoadingFav(true);
    try {
      const d = await fetch(API('/dashboard/favorites'), { headers: authHeader }).then(r => r.json());
      setFavorites(d.favorites || []);
    } catch {} setLoadingFav(false);
  }, [authHeader]);

  useEffect(() => {
    if (tab === 'current') loadActive();
    if (tab === 'history') loadHistory(1);
    if (tab === 'reservations') loadReservations(1);
    if (tab === 'favorites') loadFavorites();
  }, [tab]);

  async function removeFavorite(fav) {
    setFavorites(prev => prev.filter(f => f.id !== fav.id));
    try {
      await fetch(API(`/dashboard/favorites/${fav.id}`), { method: 'DELETE', headers: authHeader });
    } catch { loadFavorites(); }
  }

  // L'onglet "Listes" est devenu la page dédiée /dashboard/lists (trop de
  // sous-fonctionnalités pour un onglet) — un ancien lien ?tab=lists redirige.
  if (tab === 'lists') return <Navigate to="/dashboard/lists" replace />;

  return (
    <div className="mk-fade-up">
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto' }}>
        {TABS.map(item => (
          <button key={item.key} onClick={() => setTab(item.key)} className={`mk-pill${tab === item.key ? ' active' : ''}`}><DashboardIcon icon={item.icon} size={14} /> {t(item.labelKey)}</button>
        ))}
      </div>

      {tab === 'current' && (
        loadingActive ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--mk-muted)' }}>{t('common.loading')}</div>
        : activeOrders.length === 0 ? <EmptyState icon="utensils" text={t('dashboard.activity.emptyCurrent')} cta={t('dashboard.activity.orderNow')} onCta={() => navigate('/marketplace')} />
        : activeOrders.map(o => <OrderCard key={o.id} order={o} navigate={navigate} t={t} formatDate={formatDate} formatCurrency={formatCurrency} />)
      )}

      {tab === 'history' && (
        <>
          <div style={{ fontSize: 13, color: 'var(--mk-muted)', marginBottom: 12 }}>{t('dashboard.activity.orderCount', { count: historyTotal })}</div>
          {loadingHistory ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--mk-muted)' }}>{t('common.loading')}</div>
          : history.length === 0 ? <EmptyState icon="cart" text={t('dashboard.activity.emptyHistory')} cta={t('dashboard.activity.orderNow')} onCta={() => navigate('/marketplace')} />
          : (
            <>
              {history.map(o => <OrderCard key={o.id} order={o} navigate={navigate} t={t} formatDate={formatDate} formatCurrency={formatCurrency} />)}
              {historyTotal > 10 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                  <button disabled={historyPage === 1} onClick={() => loadHistory(historyPage - 1)} className="mk-pill">←</button>
                  <span style={{ padding: '8px 12px', fontSize: 13, color: 'var(--mk-muted)' }}>{t('dashboard.activity.page', { page: historyPage })}</span>
                  <button disabled={historyPage * 10 >= historyTotal} onClick={() => loadHistory(historyPage + 1)} className="mk-pill">→</button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {tab === 'reservations' && (
        <>
          <div style={{ fontSize: 13, color: 'var(--mk-muted)', marginBottom: 12 }}>{t('dashboard.activity.reservationCount', { count: reservationsTotal })}</div>
          {loadingReservations ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--mk-muted)' }}>{t('common.loading')}</div>
          : reservations.length === 0 ? <EmptyState icon="table" text={t('dashboard.activity.emptyReservations')} cta={t('dashboard.activity.exploreMarketplace')} onCta={() => navigate('/marketplace')} />
          : (
            <>
              {reservations.map(r => <ReservationCard key={r.id} reservation={r} navigate={navigate} t={t} formatDate={formatDate} />)}
              {reservationsTotal > 10 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                  <button disabled={reservationsPage === 1} onClick={() => loadReservations(reservationsPage - 1)} className="mk-pill">←</button>
                  <span style={{ padding: '8px 12px', fontSize: 13, color: 'var(--mk-muted)' }}>{t('dashboard.activity.page', { page: reservationsPage })}</span>
                  <button disabled={reservationsPage * 10 >= reservationsTotal} onClick={() => loadReservations(reservationsPage + 1)} className="mk-pill">→</button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {tab === 'favorites' && (
        loadingFav ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--mk-muted)' }}>{t('common.loading')}</div>
        : favorites.length === 0 ? <EmptyState icon="heart" text={t('dashboard.activity.emptyFavorites')} cta={t('dashboard.activity.exploreMarketplace')} onCta={() => navigate('/marketplace')} />
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {favorites.map(fav => (
              <div key={fav.id} className="mk-card" style={{ padding: 14, cursor: 'pointer', position: 'relative' }} onClick={() => fav.organization?.slug && navigate(`/r/${fav.organization.slug}`)}>
                <button aria-label="Retirer des favoris" onClick={e => { e.stopPropagation(); removeFavorite(fav); }} style={{
                  position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,.4)', border: 'none',
                  color: '#fff', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', display:'grid', placeItems:'center',
                }}><PremiumIcon name="close" size={14} /></button>
                <div style={{ height: 90, borderRadius: 10, background: `var(--mk-pill) center/cover url(${fav.organization?.cover_url || ''})`, marginBottom: 10 }} />
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--mk-text)' }}>{fav.organization?.name}</div>
                <div style={{ fontSize: 11, color: 'var(--mk-muted)' }}>{fav.organization?.city}</div>
              </div>
            ))}
          </div>
        )
      )}

    </div>
  );
}
