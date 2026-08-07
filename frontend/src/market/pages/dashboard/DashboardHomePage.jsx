import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../../api';
import { useCustomerAuth } from '../../../contexts/CustomerAuthContext';
import { StatsCard } from '../../components/dashboard/StatsCard';
import { QuickActionCard } from '../../components/dashboard/QuickActionCard';
import { IfilinoCard } from '../../components/dashboard/IfilinoCard';
import { WalletSummary } from '../../components/dashboard/WalletSummary';
import { OrderTimeline } from '../../components/dashboard/OrderTimeline';
import { PromotionCarousel } from '../../components/dashboard/PromotionCarousel';
import { AssistantWidget } from '../../components/dashboard/AssistantWidget';
import { PremiumIconBadge } from '../../../shared/components/ui/PremiumIcon';

const QUICK_ACTIONS = [
  { icon: '🛍️', label: 'Commander', to: '/marketplace' },
  { icon: '🔁', label: 'Recommander', to: '/dashboard/activity' },
  { icon: '📝', label: 'Liste de courses', to: '/dashboard/lists' },
  { icon: '💊', label: 'Pharmacie de garde', to: '/marketplace' },
  { icon: '🎟️', label: 'Mes coupons', to: '/dashboard/wallet' },
  { icon: '🎮', label: 'iFilino Play', to: '/play' },
];

function SectionTitle({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '26px 0 12px' }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--mk-text)', margin: 0 }}>{children}</h2>
      {action}
    </div>
  );
}

export default function DashboardHomePage() {
  const navigate = useNavigate();
  const { authHeader } = useCustomerAuth();
  const [data, setData] = useState(null);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(API('/dashboard/home'), { headers: authHeader }).then(r => r.json()),
      fetch(API('/dashboard/coupons'), { headers: authHeader }).then(r => r.json()).catch(() => ({ available: [] })),
    ]).then(([home, cp]) => {
      setData(home);
      setCoupons(cp.available || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        {[1, 2, 3].map(i => <div key={i} className="mk-skeleton" style={{ height: 90, borderRadius: 16 }} />)}
      </div>
    );
  }

  const firstName = (data.user?.nom || '').split(' ')[0] || 'là';

  return (
    <div className="mk-fade-up">
      {/* Bienvenue */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', background: 'var(--mk-orange-light)',
          color: 'var(--mk-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 20, flexShrink: 0, overflow: 'hidden',
        }}>
          {data.user?.avatar_url
            ? <img src={data.user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : firstName.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 900, color: 'var(--mk-text)' }}>Salut {firstName}</div>
          <div style={{ fontSize: 12, color: 'var(--mk-muted)' }}>
            {data.tier?.icon} Niveau {data.tier?.name} · {data.favorites_count} favori{data.favorites_count > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Stats rapides */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
        <StatsCard icon="📦" label="Commandes actives" value={data.active_orders.length} color="#2563EB" onClick={() => navigate('/dashboard/activity')} />
        <StatsCard icon="🗓️" label="Ce mois-ci" value={data.orders_this_month} color="#16A34A" onClick={() => navigate('/dashboard/activity?tab=history')} />
        <StatsCard icon="⭐" label="Points fidélité" value={data.loyalty_points.toLocaleString('fr-FR')} color="#F59E0B" onClick={() => navigate('/dashboard/wallet')} />
        <StatsCard icon="💰" label="Économies (mois)" value={`${data.savings_this_month.toFixed(0)} MAD`} color="#7C3AED" onClick={() => navigate('/dashboard/insights')} />
      </div>

      {/* Carte iFilino */}
      <SectionTitle action={<button onClick={() => navigate('/dashboard/card')} style={{ background: 'none', border: 'none', color: 'var(--mk-orange)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Voir les avantages →</button>}>
        Ma carte
      </SectionTitle>
      <IfilinoCard user={data.user} tier={data.tier} points={data.loyalty_points} compact />

      {/* Wallet summary */}
      <SectionTitle>Wallet</SectionTitle>
      <WalletSummary points={data.loyalty_points} cashback={data.cashback_balance} couponsCount={coupons.length} />

      {/* Actions rapides */}
      <SectionTitle>Actions rapides</SectionTitle>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {QUICK_ACTIONS.map(a => (
          <QuickActionCard key={a.label} icon={a.icon} label={a.label} onClick={() => navigate(a.to)} />
        ))}
      </div>

      {/* Promotions */}
      {coupons.length > 0 && (
        <>
          <SectionTitle action={<button onClick={() => navigate('/dashboard/wallet')} style={{ background: 'none', border: 'none', color: 'var(--mk-orange)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Tout voir →</button>}>
            Pour vous
          </SectionTitle>
          <PromotionCarousel coupons={coupons} />
        </>
      )}

      {/* Commandes actives */}
      <SectionTitle action={<button onClick={() => navigate('/dashboard/activity')} style={{ background: 'none', border: 'none', color: 'var(--mk-orange)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Historique →</button>}>
        Commandes en cours
      </SectionTitle>
      {data.active_orders.length === 0 ? (
        <div className="mk-card" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ display:'grid', placeItems:'center', color:'var(--mk-orange)', marginBottom:6 }}><PremiumIconBadge name="utensils" size={26} /></div>
          <div style={{ color: 'var(--mk-muted)', fontSize: 13 }}>Aucune commande en cours</div>
          <button onClick={() => navigate('/marketplace')} style={{ marginTop: 12, padding: '9px 18px', background: 'var(--mk-orange)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Commander maintenant
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {data.active_orders.map(order => (
            <div key={order.id} className="mk-card" style={{ padding: 16, cursor: 'pointer' }} onClick={() => navigate(`/track/${order.pickup_code}`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--mk-text)' }}>{order.organization?.name}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--mk-orange)' }}>{Number(order.total_amount).toFixed(2)} MAD</div>
              </div>
              <OrderTimeline order={order} compact />
            </div>
          ))}
        </div>
      )}

      {/* Assistant IA */}
      <SectionTitle>Assistant</SectionTitle>
      <AssistantWidget authHeader={authHeader} />
    </div>
  );
}
