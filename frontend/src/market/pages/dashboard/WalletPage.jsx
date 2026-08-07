import React, { useCallback, useEffect, useState } from 'react';
import { API } from '../../../api';
import { useCustomerAuth } from '../../../contexts/CustomerAuthContext';
import { IfilinoCard } from '../../components/dashboard/IfilinoCard';
import { DashboardIcon } from '../../../shared/components/ui/DashboardIcon';
import { PremiumIcon } from '../../../shared/components/ui/PremiumIcon';

const cardStyle = {
  background: 'var(--mk-card)', border: '1px solid var(--mk-border)', borderRadius: 16,
  padding: 18, marginBottom: 16,
};

const TABS = [
  { key: 'points',   label: 'Points', icon: '⭐' },
  { key: 'cashback', label: 'Cashback', icon: '💰' },
  { key: 'coupons',  label: 'Coupons', icon: '🎟️' },
];

export default function WalletPage() {
  const { authHeader } = useCustomerAuth();
  const [tab, setTab] = useState('points');

  const [loyalty, setLoyalty] = useState(null);
  const [loyaltyHistory, setLoyaltyHistory] = useState([]);
  const [birthday, setBirthday] = useState('');
  const [savingBday, setSavingBday] = useState(false);

  const [cashback, setCashback] = useState(null);
  const [cashbackHistory, setCashbackHistory] = useState([]);

  const [coupons, setCoupons] = useState({ available: [], used: [] });

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

  const loadCashback = useCallback(async () => {
    try {
      const [acct, hist] = await Promise.all([
        fetch(API('/dashboard/cashback'), { headers: authHeader }).then(r => r.json()),
        fetch(API('/dashboard/cashback/history'), { headers: authHeader }).then(r => r.json()),
      ]);
      setCashback(acct);
      setCashbackHistory(hist.transactions || []);
    } catch {}
  }, [authHeader]);

  const loadCoupons = useCallback(async () => {
    try {
      const d = await fetch(API('/dashboard/coupons'), { headers: authHeader }).then(r => r.json());
      setCoupons({ available: d.available || [], used: d.used || [] });
    } catch {}
  }, [authHeader]);

  useEffect(() => {
    loadLoyalty(); loadCashback(); loadCoupons();
  }, []);

  async function saveBirthday() {
    if (!birthday) return;
    setSavingBday(true);
    try {
      await fetch(API('/loyalty/me/birthday'), {
        method: 'PATCH', headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthday }),
      });
    } catch {} finally { setSavingBday(false); }
  }

  return (
    <div className="mk-fade-up">
      <IfilinoCard user={loyalty?.user} tier={loyalty?.tier} points={loyalty?.points || 0} />

      <div style={{ display: 'flex', gap: 8, margin: '18px 0', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`mk-pill${tab === t.key ? ' active' : ''}`}>
            <DashboardIcon icon={t.icon} size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'points' && (
        loyalty ? (
          <>
            {loyalty.next_tier && (
              <div style={cardStyle}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--mk-text)' }}>
                  {loyalty.next_tier.points_needed} pts pour atteindre {loyalty.next_tier.name}
                </div>
                <div style={{ height: 8, background: 'var(--mk-border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4, background: 'var(--mk-orange)',
                    width: `${Math.min(100, Math.round(((loyalty.total_earned - loyalty.tier.min) / (loyalty.next_tier.min - loyalty.tier.min)) * 100))}%`,
                  }} />
                </div>
              </div>
            )}

            {loyalty.badges?.length > 0 && (
              <div style={cardStyle}>
                <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14, color: 'var(--mk-text)', display:'flex', alignItems:'center', gap:8 }}><PremiumIcon name="award" size={16} />Mes badges</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {loyalty.badges.map((b, i) => (
                    <div key={i} title={b.description} style={{
                      background: 'var(--mk-orange-light)', border: '1px solid var(--mk-border)', borderRadius: 10,
                      padding: '8px 12px', textAlign: 'center', fontSize: 11,
                    }}>
                      <div style={{ fontSize: 22 }}>{b.icon}</div>
                      <div style={{ fontWeight: 700, marginTop: 2, color: 'var(--mk-text)' }}>{b.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={cardStyle}>
              <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14, color: 'var(--mk-text)', display:'flex', alignItems:'center', gap:8 }}><PremiumIcon name="gift" size={16} />Date d'anniversaire</div>
              <div style={{ fontSize: 12, color: 'var(--mk-muted)', marginBottom: 10 }}>
                Recevez automatiquement un coupon -15% et 200 pts le jour J !
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--mk-border)', fontSize: 13, background: 'var(--mk-input-bg)', color: 'var(--mk-text)' }} />
                <button onClick={saveBirthday} disabled={savingBday || !birthday}
                  style={{ padding: '8px 16px', background: 'var(--mk-orange)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                  {savingBday ? '…' : 'Enregistrer'}
                </button>
              </div>
            </div>

            {loyaltyHistory.length > 0 && (
              <div style={cardStyle}>
                <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14, color: 'var(--mk-text)', display:'flex', alignItems:'center', gap:8 }}><PremiumIcon name="history" size={16} />Historique des points</div>
                {loyaltyHistory.slice(0, 15).map((tx, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < loyaltyHistory.length - 1 ? '1px solid var(--mk-border2)' : 'none', fontSize: 12 }}>
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--mk-text)' }}>{tx.description || tx.type}</span>
                      <div style={{ color: 'var(--mk-muted)', fontSize: 10 }}>{new Date(tx.created_at).toLocaleDateString('fr-FR')}</div>
                    </div>
                    <span style={{ fontWeight: 800, color: tx.points > 0 ? 'var(--mk-green)' : 'var(--mk-red)' }}>
                      {tx.points > 0 ? '+' : ''}{tx.points} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : <div style={{ textAlign: 'center', padding: 40, color: 'var(--mk-muted)' }}>Chargement…</div>
      )}

      {tab === 'cashback' && (
        cashback ? (
          <>
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--mk-green)' }}>{cashback.balance.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: 'var(--mk-muted)' }}>Solde (MAD)</div>
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--mk-text)' }}>{cashback.total_earned.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: 'var(--mk-muted)' }}>Total gagné</div>
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--mk-text)' }}>{cashback.total_used.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: 'var(--mk-muted)' }}>Total utilisé</div>
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14, color: 'var(--mk-text)', display:'flex', alignItems:'center', gap:8 }}><PremiumIcon name="history" size={16} />Historique cashback</div>
              {cashbackHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--mk-muted)', fontSize: 13 }}>Aucune transaction pour le moment</div>
              ) : cashbackHistory.map((tx, i) => (
                <div key={tx.id || i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < cashbackHistory.length - 1 ? '1px solid var(--mk-border2)' : 'none', fontSize: 12 }}>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--mk-text)' }}>{tx.description || tx.type}{tx.organization ? ` · ${tx.organization.name}` : ''}</span>
                    <div style={{ color: 'var(--mk-muted)', fontSize: 10 }}>{new Date(tx.created_at).toLocaleDateString('fr-FR')}</div>
                  </div>
                  <span style={{ fontWeight: 800, color: tx.type === 'earn' ? 'var(--mk-green)' : 'var(--mk-red)' }}>
                    {tx.type === 'earn' ? '+' : '-'}{Number(tx.amount).toFixed(2)} MAD
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : <div style={{ textAlign: 'center', padding: 40, color: 'var(--mk-muted)' }}>Chargement…</div>
      )}

      {tab === 'coupons' && (
        <>
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14, color: 'var(--mk-text)' }}>🎟️ Coupons disponibles</div>
            {coupons.available.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--mk-muted)', fontSize: 13 }}>Aucun coupon disponible pour le moment</div>
            ) : coupons.available.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--mk-border2)' }}>
                <span style={{ fontSize: 20 }}>🎁</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--mk-text)' }}>
                    {c.type === 'percent' ? `-${Number(c.value)}%` : `-${Number(c.value)} MAD`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--mk-muted)' }}>{c.description || 'Offre exclusive'}</div>
                </div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', background: 'var(--mk-pill)', padding: '4px 8px', borderRadius: 8, color: 'var(--mk-text2)' }}>{c.code}</div>
              </div>
            ))}
          </div>

          {coupons.used.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14, color: 'var(--mk-text)' }}>Coupons utilisés</div>
              {coupons.used.map((u, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < coupons.used.length - 1 ? '1px solid var(--mk-border2)' : 'none', fontSize: 12, opacity: .6 }}>
                  <span style={{ color: 'var(--mk-text)' }}>{u.coupon?.code}</span>
                  <span style={{ color: 'var(--mk-muted)' }}>{new Date(u.used_at).toLocaleDateString('fr-FR')}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
