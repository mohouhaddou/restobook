import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../api';
import { useCart } from '../contexts/CartContext';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';

const ONLINE_TYPES = [
  { value: 'delivery',      label: 'Livraison à domicile', icon: '🛵', desc: 'Livré à votre adresse' },
  { value: 'click_collect', label: 'Click & Collect',      icon: '🏃', desc: 'Retrait sur place' },
];

function Section({ title, icon, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.05), 0 4px 16px rgba(0,0,0,.05)', border: '1px solid #F1F5F9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #F8FAFC' }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function CheckoutPage() {
  const navigate  = useNavigate();
  const { cart, total, clearCart } = useCart();
  const { user: customerUser, authHeader } = useCustomerAuth();

  // Source de vérité : CartContext (pas router state)
  const isTableQR    = cart?.orderSource === 'TABLE_QR';
  const tableLabel   = cart?.tableLabel || null;
  const tableId      = cart?.tableId || null;

  const [orderType, setOrderType]   = useState('delivery');
  const [guestName, setGuestName]   = useState(customerUser?.nom || '');
  const [guestPhone, setGuestPhone] = useState(customerUser?.phone || '');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes]           = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult]   = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  if (!cart || cart.items.length === 0) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, background: '#F8FAFC' }}>
      <div style={{ fontSize: 52 }}>🛒</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>Votre panier est vide</div>
      <button onClick={() => navigate('/marketplace')} style={{ padding: '12px 24px', background: 'var(--rb-orange,#FF8A00)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
        Voir les restaurants
      </button>
    </div>
  );

  // Pour TABLE_QR : pas de livraison, type forcé dine_in
  const effectiveType = isTableQR ? 'dine_in' : orderType;

  const discount   = couponResult?.discount_amount || 0;
  const finalTotal = Math.max(0, total - discount);

  async function validateCoupon() {
    if (!couponCode.trim()) return;
    setCouponLoading(true); setCouponResult(null);
    try {
      const res = await fetch(API('/marketplace/coupons/validate'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), organization_slug: cart.orgSlug, subtotal: total })
      });
      setCouponResult(await res.json());
    } catch {
      setCouponResult({ valid: false, message: 'Erreur lors de la validation' });
    }
    setCouponLoading(false);
  }

  async function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    setError('');
    if (!guestName.trim()) { setError('Votre nom est requis'); return; }
    if (!guestPhone.trim()) { setError('Votre téléphone est requis'); return; }
    if (!isTableQR && effectiveType === 'delivery' && !deliveryAddress.trim()) {
      setError("L'adresse de livraison est requise"); return;
    }

    setLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json', ...authHeader };
      const body = {
        organization_slug: cart.orgSlug,
        type:              effectiveType,
        items:             cart.items.map(i => ({ menu_item_id: i.id, quantity: i.quantity })),
        guest_name:        guestName.trim(),
        guest_phone:       guestPhone.trim(),
        notes:             notes.trim() || undefined,
        coupon_code:       (!isTableQR && couponResult?.valid) ? couponCode.trim() : undefined,
        payment_method:    'cash',
      };

      if (isTableQR) {
        body.table_label = tableLabel || undefined;
        body.table_id    = tableId    || undefined;
      } else if (effectiveType === 'delivery') {
        body.delivery_address = deliveryAddress.trim();
      }

      const res = await fetch(API('/marketplace/orders'), { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erreur lors de la commande'); setLoading(false); return; }
      clearCart();
      navigate(`/track/${data.pickup_code}`, { state: { justOrdered: true, orderData: data } });
    } catch { setError('Erreur réseau. Vérifiez votre connexion.'); }
    setLoading(false);
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', border: '1.5px solid #E2E8F0', borderRadius: 10,
    fontSize: 14, outline: 'none', color: '#0F172A', background: '#fff', transition: 'border-color .15s',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'Inter,system-ui,sans-serif' }}>

      {/* Header — couleur différente selon parcours */}
      <div style={{
        background: isTableQR ? 'linear-gradient(135deg,#92400E,#B45309)' : '#fff',
        borderBottom: isTableQR ? 'none' : '1px solid #F1F5F9',
        padding: '0 20px', display: 'flex', alignItems: 'center', gap: 14,
        height: 60, position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 4px rgba(0,0,0,.08)',
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: isTableQR ? 'rgba(255,255,255,.15)' : '#F8FAFC',
          border: isTableQR ? '1px solid rgba(255,255,255,.3)' : '1px solid #E2E8F0',
          borderRadius: 10, width: 38, height: 38, cursor: 'pointer', fontSize: 16,
          display: 'grid', placeItems: 'center',
          color: isTableQR ? '#fff' : '#374151',
        }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: isTableQR ? '#fff' : '#0F172A' }}>
            {isTableQR ? `🪑 Commande sur place — Table ${tableLabel}` : 'Finaliser la commande'}
          </h1>
          <div style={{ fontSize: 11, color: isTableQR ? 'rgba(255,255,255,.7)' : '#94A3B8', marginTop: 1 }}>
            {isTableQR ? `Scannée via QR Code · ${cart.orgName}` : cart.orgName}
          </div>
        </div>
      </div>

      <div className="co-layout">
        <form onSubmit={handleSubmit} className="co-form">

          {/* ── PARCOURS TABLE QR ── */}
          {isTableQR && (
            <div style={{ background: 'linear-gradient(135deg,#FFF7ED,#FFEDD5)', borderRadius: 16, padding: '20px 24px', border: '2px solid #FED7AA' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ background: 'var(--rb-orange,#FF8A00)', borderRadius: 14, width: 56, height: 56, display: 'grid', placeItems: 'center', fontSize: 26, flexShrink: 0 }}>🪑</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#92400E', lineHeight: 1.1 }}>Table {tableLabel}</div>
                  <div style={{ fontSize: 13, color: '#B45309', marginTop: 3 }}>{cart.orgName} — Commande sur place</div>
                  <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, color: '#15803D', border: '1px solid #BBF7D0' }}>
                    ✓ Dîner sur place · Paiement au serveur
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── MODE DE COMMANDE (ONLINE seulement) ── */}
          {!isTableQR && (
            <Section title="Mode de commande" icon="📦">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ONLINE_TYPES.map(opt => (
                  <label key={opt.value} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                    border: `2px solid ${orderType === opt.value ? 'var(--rb-orange,#FF8A00)' : '#E2E8F0'}`,
                    borderRadius: 12, cursor: 'pointer',
                    background: orderType === opt.value ? '#FFF7ED' : '#fff', transition: 'all .15s',
                  }}>
                    <input type="radio" name="type" value={opt.value} checked={orderType === opt.value}
                      onChange={() => setOrderType(opt.value)} style={{ cursor: 'pointer', accentColor: 'var(--rb-orange,#FF8A00)' }} />
                    <span style={{ fontSize: 20 }}>{opt.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: orderType === opt.value ? 700 : 500, color: '#0F172A' }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </Section>
          )}

          {/* ── COORDONNÉES ── */}
          <Section title="Vos coordonnées" icon="👤">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="co-name-grid">
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Prénom & Nom *</label>
                  <input value={guestName} onChange={e => setGuestName(e.target.value)}
                    placeholder="Mohammed Alami" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Téléphone *</label>
                  <input value={guestPhone} onChange={e => setGuestPhone(e.target.value)}
                    placeholder="+212 6 00 00 00 00" style={inputStyle} />
                </div>
              </div>

              {/* Adresse UNIQUEMENT pour livraison en ligne */}
              {!isTableQR && effectiveType === 'delivery' && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Adresse de livraison *</label>
                  <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                    placeholder="12 rue des Fleurs, Quartier Maarif, Casablanca" style={inputStyle} />
                </div>
              )}

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>
                  {isTableQR ? 'Demande spéciale (allergie, préférence…)' : 'Note pour le restaurant'}
                </label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder={isTableQR ? 'Ex : allergie aux noix, sans piment…' : 'Pas de piment, allergie aux fruits à coque…'}
                  rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
          </Section>

          {/* ── CODE PROMO (ONLINE seulement) ── */}
          {!isTableQR && (
            <Section title="Code promo" icon="🎟">
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={couponCode} onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); }}
                  placeholder="EX : BIENVENUE10" style={{ ...inputStyle, flex: 1, textTransform: 'uppercase', letterSpacing: '.05em' }} />
                <button type="button" onClick={validateCoupon} disabled={couponLoading || !couponCode.trim()} style={{
                  padding: '11px 18px', background: couponLoading ? '#F1F5F9' : '#0F172A',
                  color: couponLoading ? '#94A3B8' : '#fff', border: 'none', borderRadius: 10,
                  cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                }}>
                  {couponLoading ? '…' : 'Appliquer'}
                </button>
              </div>
              {couponResult && (
                <div style={{
                  marginTop: 10, padding: '10px 14px', borderRadius: 10,
                  background: couponResult.valid ? '#F0FDF4' : '#FEF2F2',
                  color: couponResult.valid ? '#16A34A' : '#DC2626', fontSize: 13, fontWeight: 600,
                  border: `1px solid ${couponResult.valid ? '#BBF7D0' : '#FECACA'}`,
                }}>
                  {couponResult.valid ? `✓ ${couponResult.message}` : `✗ ${couponResult.message}`}
                </div>
              )}
            </Section>
          )}

          {error && (
            <div style={{ padding: '14px 18px', background: '#FEF2F2', borderRadius: 12, color: '#DC2626', fontSize: 14, fontWeight: 600, border: '1px solid #FECACA' }}>
              ⚠️ {error}
            </div>
          )}
        </form>

        {/* ── SIDEBAR RÉCAPITULATIF ── */}
        <div className="co-sidebar">
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 4px 20px rgba(0,0,0,.08)', border: '1px solid #F1F5F9' }}>

            {/* Badge source en haut du panier */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8, padding: '5px 11px',
              marginBottom: 14, fontSize: 12, fontWeight: 700,
              background: isTableQR ? '#FFF7ED' : '#EFF6FF',
              color: isTableQR ? '#B45309' : '#1D4ED8',
              border: `1.5px solid ${isTableQR ? '#FED7AA' : '#BFDBFE'}`,
            }}>
              {isTableQR ? `🪑 Table ${tableLabel} · Sur place` : `${effectiveType === 'delivery' ? '🛵 Livraison' : '🏃 À emporter'}`}
            </div>

            <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid #F8FAFC' }}>
              📋 {cart.orgName}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {cart.items.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: '#374151' }}><span style={{ fontWeight: 700, color: '#0F172A' }}>{item.quantity}×</span> {item.libelle}</span>
                  <span style={{ fontWeight: 600, color: '#0F172A', flexShrink: 0, marginLeft: 8 }}>{(item.unit_price * item.quantity).toFixed(2)} MAD</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#64748B' }}>
                <span>Sous-total</span><span>{total.toFixed(2)} MAD</span>
              </div>
              {!isTableQR && effectiveType === 'delivery' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#94A3B8' }}>
                  <span>Livraison</span><span>calculée à la validation</span>
                </div>
              )}
              {couponResult?.valid && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#16A34A', fontWeight: 700 }}>
                  <span>Réduction</span><span>-{couponResult.discount_amount?.toFixed(2)} MAD</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, borderTop: '1px solid #F1F5F9', paddingTop: 12, marginTop: 4, color: '#0F172A' }}>
                <span>Total estimé</span>
                <span style={{ color: 'var(--rb-orange,#FF8A00)' }}>{finalTotal.toFixed(2)} MAD</span>
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
                {isTableQR ? 'Paiement au serveur en fin de repas' : 'Paiement à la livraison / au retrait'}
              </div>
            </div>

            <button type="button" onClick={handleSubmit} disabled={loading} className="co-sidebar-submit" style={{
              marginTop: 18, width: '100%', padding: '15px',
              background: loading ? '#94A3B8' : 'var(--rb-orange,#FF8A00)',
              color: '#fff', border: 'none', borderRadius: 12,
              fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(234,88,12,.35)', transition: 'all .15s',
            }}>
              {loading
                ? <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,.5)', borderTopColor: '#fff', borderRadius: '50%', animation: 'co-spin .6s linear infinite', marginRight: 8, verticalAlign: 'middle' }} />Envoi…</>
                : isTableQR ? '🍽️ Commander à la table' : '✓ Confirmer la commande'
              }
            </button>
          </div>
        </div>
      </div>

      {/* BOUTON STICKY MOBILE */}
      <div className="co-sticky-bar">
        <button type="button" onClick={handleSubmit} disabled={loading} style={{
          width: '100%', padding: '15px',
          background: loading ? '#94A3B8' : 'var(--rb-orange,#FF8A00)',
          color: '#fff', border: 'none', borderRadius: 12,
          fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
          boxShadow: loading ? 'none' : '0 4px 16px rgba(234,88,12,.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all .15s',
        }}>
          {loading
            ? <><span style={{ display:'inline-block', width:14, height:14, border:'2px solid rgba(255,255,255,.5)', borderTopColor:'#fff', borderRadius:'50%', animation:'co-spin .6s linear infinite' }} />Envoi…</>
            : isTableQR ? `🍽️ Commander · ${finalTotal.toFixed(2)} MAD` : `✓ Confirmer · ${finalTotal.toFixed(2)} MAD`
          }
        </button>
      </div>

      <style>{`@keyframes co-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
