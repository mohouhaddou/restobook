import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../api';
import { useCart } from '../contexts/CartContext';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { sendHeroAttribution } from '../shared/utils/heroAttribution';
import { useI18n } from '../i18n/config';
import { translateApiError } from '../i18n/apiErrors';

// Configuration par module — c'est ce qui permet à cette page unique de
// servir resto/hanout/pharmacie (même interface graphique, endpoints et
// vocabulaire de champs différents côté API). Voir plan
// misty-dreaming-puddle.md §2.1.
const MODULE_CONFIG = {
  resto: {
    endpoint: () => '/marketplace/orders',
    orderNumberKey: 'pickup_code',
    showTable: true,
    showCoupon: true,
    defaultOrderType: 'delivery',
    deliveryOptions: [
      { value: 'delivery', labelKey: 'fulfillment.type.delivery', icon: '🛵', descKey: 'checkout.fulfillment.deliveryAddress' },
      { value: 'click_collect', labelKey: 'fulfillment.type.click_collect', icon: '🏃', descKey: 'checkout.fulfillment.pickupOnSite' },
    ],
    buildBody: (ctx) => ({
      organization_slug: ctx.cart.orgSlug,
      type:              ctx.effectiveType,
      items:             ctx.cart.items.map(i => ({ menu_item_id: i.id, quantity: i.quantity })),
      guest_name:        ctx.guestName.trim(),
      guest_phone:       ctx.guestPhone.trim(),
      notes:             ctx.notes.trim() || undefined,
      coupon_code:       (!ctx.isTableQR && ctx.couponResult?.valid) ? ctx.couponCode.trim() : undefined,
      payment_method:    'cash',
      ...(ctx.isTableQR
        ? { table_label: ctx.tableLabel || undefined, table_id: ctx.tableId || undefined }
        : ctx.effectiveType === 'delivery'
          ? { delivery_address: ctx.deliveryAddress.trim(), ...(ctx.deliveryCoords ? { delivery_lat: ctx.deliveryCoords.lat, delivery_lng: ctx.deliveryCoords.lng } : {}) }
          : {}),
    }),
  },
  hanout: {
    endpoint: (slug) => `/hanout/${slug}/orders`,
    orderNumberKey: 'order_number',
    showTable: false,
    showCoupon: false,
    defaultOrderType: 'pickup',
    deliveryOptions: [
      { value: 'pickup', labelKey: 'fulfillment.type.pickup', icon: '🏪', descKey: 'checkout.fulfillment.free' },
      { value: 'delivery', labelKey: 'fulfillment.type.delivery', icon: '🛵', descKey: 'checkout.fulfillment.deliveryFeeHint' },
    ],
    buildBody: (ctx) => ({
      customer_name:  ctx.guestName.trim(),
      customer_phone: ctx.guestPhone.trim(),
      delivery_type:  ctx.effectiveType,
      notes:          ctx.notes.trim() || undefined,
      items: ctx.cart.items.map(i => {
        const qtyOpt = (i.selected_options || []).find(o => o.option_type === 'quantity' || o.option_type === 'weight');
        return {
          product_id: i.id,
          quantity:   qtyOpt ? qtyOpt.numeric_value * i.quantity : i.quantity,
          selected_options: i.selected_options || [],
        };
      }),
      ...(ctx.effectiveType === 'delivery' ? {
        delivery_address:  ctx.deliveryAddress.trim(),
        delivery_district: ctx.deliveryDistrict.trim(),
        ...(ctx.deliveryCoords ? { delivery_lat: ctx.deliveryCoords.lat, delivery_lng: ctx.deliveryCoords.lng } : {}),
      } : {}),
    }),
  },
  pharmacie: {
    endpoint: (slug) => `/pharmacy/${slug}/orders`,
    orderNumberKey: 'order_number',
    showTable: false,
    showCoupon: false,
    defaultOrderType: 'pickup',
    deliveryOptions: [
      { value: 'pickup', labelKey: 'fulfillment.type.pickup', icon: '🏪', descKey: 'checkout.fulfillment.free' },
      { value: 'delivery', labelKey: 'fulfillment.type.delivery', icon: '🛵', descKey: 'checkout.fulfillment.deliveryFeeHint' },
    ],
    buildBody: (ctx) => ({
      customer_name:  ctx.guestName.trim(),
      customer_phone: ctx.guestPhone.trim(),
      delivery_type:  ctx.effectiveType,
      notes:          ctx.notes.trim() || undefined,
      items: ctx.cart.items.map(i => ({ medicine_id: i.id, quantity: i.quantity })),
      ...(ctx.effectiveType === 'delivery' ? {
        delivery_address:  ctx.deliveryAddress.trim(),
        delivery_district: ctx.deliveryDistrict.trim(),
        ...(ctx.deliveryCoords ? { delivery_lat: ctx.deliveryCoords.lat, delivery_lng: ctx.deliveryCoords.lng } : {}),
      } : {}),
    }),
  },
};

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
  const { t, formatCurrency } = useI18n();
  const { user: customerUser, authHeader } = useCustomerAuth();

  const config = MODULE_CONFIG[cart?.module] || MODULE_CONFIG.resto;

  // Source de vérité : CartContext (pas router state). TABLE_QR n'existe que
  // pour le moteur resto (aucun concept de table pour hanout/pharmacie).
  const isTableQR    = cart?.module === 'resto' && cart?.orderSource === 'TABLE_QR';
  const tableLabel   = cart?.tableLabel || null;
  const tableId      = cart?.tableId || null;

  const [orderType, setOrderType]   = useState(() => config.defaultOrderType);
  const [guestName, setGuestName]   = useState(customerUser?.nom || '');
  const [guestPhone, setGuestPhone] = useState(customerUser?.phone || '');
  const [deliveryAddress, setDeliveryAddress]   = useState('');
  const [deliveryDistrict, setDeliveryDistrict] = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

  function detectDeliveryGps() {
    if (!navigator.geolocation) { setGpsError(t('checkout.errors.geolocationUnsupported')); return; }
    setGpsLoading(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setDeliveryCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsLoading(false); },
      () => { setGpsError(t('checkout.errors.positionUnavailable')); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }
  const [notes, setNotes]           = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult]   = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  if (!cart || cart.items.length === 0) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, background: '#F8FAFC' }}>
      <div style={{ fontSize: 52 }}>🛒</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>{t('checkout.emptyCart.title')}</div>
      <button onClick={() => navigate('/marketplace')} style={{ padding: '12px 24px', background: 'var(--rb-orange,#FF8A00)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
        {t('checkout.emptyCart.continueShopping')}
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
      setCouponResult({ valid: false, message: t('checkout.errors.couponValidation') });
    }
    setCouponLoading(false);
  }

  async function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    setError('');
    if (!guestName.trim()) { setError(t('checkout.errors.nameRequired')); return; }
    if (!guestPhone.trim()) { setError(t('checkout.errors.phoneRequired')); return; }
    if (!isTableQR && effectiveType === 'delivery' && !deliveryAddress.trim() && !(cart.module !== 'resto' && deliveryDistrict.trim())) {
      setError(t('checkout.errors.deliveryAddressRequired')); return;
    }

    setLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json', ...authHeader };
      const body = config.buildBody({
        cart, effectiveType, guestName, guestPhone, notes, couponCode, couponResult, isTableQR, tableLabel, tableId,
        deliveryAddress, deliveryDistrict, deliveryCoords,
      });

      const res = await fetch(API(config.endpoint(cart.orgSlug)), { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.messageKey ? t(data.messageKey) : translateApiError(t, data, 'checkout.errors.orderFailed')); setLoading(false); return; }
      sendHeroAttribution(cart.module, data.order_id);
      clearCart();
      navigate(`/track/${data[config.orderNumberKey]}`, { state: { justOrdered: true, orderData: data } });
    } catch (err) { setError(translateApiError(t, err, 'checkout.errors.network')); }
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
        }} aria-label={t('checkout.actions.back')}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: isTableQR ? '#fff' : '#0F172A' }}>
            {isTableQR ? t('checkout.header.tableOrder', { table: tableLabel }) : t('checkout.header.title')}
          </h1>
          <div style={{ fontSize: 11, color: isTableQR ? 'rgba(255,255,255,.7)' : '#94A3B8', marginTop: 1 }}>
            {isTableQR ? t('checkout.header.qrScanned', { store: cart.orgName }) : cart.orgName}
          </div>
        </div>
      </div>

      <div className="co-layout">
        <form onSubmit={handleSubmit} className="co-form">

          {/* ── PARCOURS TABLE QR (resto uniquement) ── */}
          {isTableQR && (
            <div style={{ background: 'linear-gradient(135deg,#FFF7ED,#FFEDD5)', borderRadius: 16, padding: '20px 24px', border: '2px solid #FED7AA' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ background: 'var(--rb-orange,#FF8A00)', borderRadius: 14, width: 56, height: 56, display: 'grid', placeItems: 'center', fontSize: 26, flexShrink: 0 }}>🪑</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#92400E', lineHeight: 1.1 }}>{t('checkout.table.label', { table: tableLabel })}</div>
                  <div style={{ fontSize: 13, color: '#B45309', marginTop: 3 }}>{t('checkout.table.storeDineIn', { store: cart.orgName })}</div>
                  <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, color: '#15803D', border: '1px solid #BBF7D0' }}>
                    ✓ {t('checkout.table.payAtServer')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── MODE DE COMMANDE (ONLINE seulement) ── */}
          {!isTableQR && (
            <Section title={t('checkout.sections.fulfillment')} icon="📦">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {config.deliveryOptions.map(opt => (
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
                      <div style={{ fontSize: 14, fontWeight: orderType === opt.value ? 700 : 500, color: '#0F172A' }}>{t(opt.labelKey)}</div>
                      <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>{t(opt.descKey)}</div>
                    </div>
                  </label>
                ))}
              </div>
            </Section>
          )}

          {/* ── COORDONNÉES ── */}
          <Section title={t('checkout.sections.customer')} icon="👤">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="co-name-grid">
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>{t('checkout.fields.fullName')}</label>
                  <input value={guestName} onChange={e => setGuestName(e.target.value)}
                    placeholder="Mohammed Alami" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>{t('checkout.fields.phone')}</label>
                  <input value={guestPhone} onChange={e => setGuestPhone(e.target.value)}
                    placeholder="+212 6 00 00 00 00" style={inputStyle} />
                </div>
              </div>

              {/* Adresse UNIQUEMENT pour livraison en ligne */}
              {!isTableQR && effectiveType === 'delivery' && (
                <div>
                  {cart.module !== 'resto' && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>{t('checkout.fields.district')}</label>
                      <input value={deliveryDistrict} onChange={e => setDeliveryDistrict(e.target.value)}
                        placeholder={t('checkout.placeholders.district')} style={inputStyle} />
                    </div>
                  )}
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>{cart.module === 'resto' ? t('checkout.fields.deliveryAddressRequired') : t('checkout.fields.deliveryAddressPrecise')}</label>
                  <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                    placeholder={t('checkout.placeholders.deliveryAddress')} style={inputStyle} />
                  <button type="button" onClick={detectDeliveryGps} disabled={gpsLoading} style={{
                    marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 12px', borderRadius: 8, border: 'none', cursor: gpsLoading ? 'default' : 'pointer',
                    background: deliveryCoords ? '#F0FDF4' : '#EFF6FF',
                    color: deliveryCoords ? '#16A34A' : '#2563EB', fontSize: 12, fontWeight: 700,
                  }}>
                    {gpsLoading ? t('checkout.gps.loading') : deliveryCoords ? t('checkout.gps.detected') : t('checkout.gps.usePosition')}
                  </button>
                  {gpsError && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>{gpsError}</div>}
                </div>
              )}

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>
                  {isTableQR ? t('checkout.fields.specialRequest') : t('checkout.fields.storeNote')}
                </label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder={isTableQR ? t('checkout.placeholders.specialRequest') : t('checkout.placeholders.storeNote')}
                  rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
          </Section>

          {/* ── CODE PROMO (resto uniquement) ── */}
          {!isTableQR && config.showCoupon && (
            <Section title={t('checkout.sections.promoCode')} icon="🎟">
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={couponCode} onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); }}
                  placeholder="EX : BIENVENUE10" style={{ ...inputStyle, flex: 1, textTransform: 'uppercase', letterSpacing: '.05em' }} />
                <button type="button" onClick={validateCoupon} disabled={couponLoading || !couponCode.trim()} style={{
                  padding: '11px 18px', background: couponLoading ? '#F1F5F9' : '#0F172A',
                  color: couponLoading ? '#94A3B8' : '#fff', border: 'none', borderRadius: 10,
                  cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                }}>
                  {couponLoading ? '…' : t('checkout.actions.applyCoupon')}
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
              {isTableQR ? t('checkout.summary.tableDineIn', { table: tableLabel }) : t(config.deliveryOptions.find(o => o.value === effectiveType)?.labelKey || 'fulfillment.type.pickup')}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid #F8FAFC' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>📋 {cart.orgName}</div>
              <button
                onClick={() => { if (window.confirm(t('marketplace.cart.clearConfirm'))) { clearCart(); navigate('/marketplace'); } }}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                🗑 {t('marketplace.cart.clear')}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {cart.items.map(item => (
                <div key={item._key ?? item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: '#374151' }}><span style={{ fontWeight: 700, color: '#0F172A' }}>{item.quantity}×</span> {item.libelle || item.name}</span>
                  <span style={{ fontWeight: 600, color: '#0F172A', flexShrink: 0, marginLeft: 8 }}>{formatCurrency(item.unit_price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#64748B' }}>
                <span>{t('checkout.summary.subtotal')}</span><span>{formatCurrency(total)}</span>
              </div>
              {!isTableQR && effectiveType === 'delivery' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#94A3B8' }}>
                  <span>{t('checkout.summary.delivery')}</span><span>{t('checkout.summary.calculatedAtValidation')}</span>
                </div>
              )}
              {couponResult?.valid && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#16A34A', fontWeight: 700 }}>
                  <span>{t('checkout.summary.discount')}</span><span>-{formatCurrency(couponResult.discount_amount || 0)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, borderTop: '1px solid #F1F5F9', paddingTop: 12, marginTop: 4, color: '#0F172A' }}>
                <span>{t('checkout.summary.estimatedTotal')}</span>
                <span style={{ color: 'var(--rb-orange,#FF8A00)' }}>{formatCurrency(finalTotal)}</span>
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
                {isTableQR ? t('checkout.payment.payAtServer') : t('checkout.payment.payOnDeliveryOrPickup')}
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
                ? <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,.5)', borderTopColor: '#fff', borderRadius: '50%', animation: 'co-spin .6s linear infinite', marginRight: 8, verticalAlign: 'middle' }} />{t('checkout.actions.sending')}</>
                : isTableQR ? t('checkout.actions.orderAtTable') : t('checkout.actions.confirmOrder')
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
            ? <><span style={{ display:'inline-block', width:14, height:14, border:'2px solid rgba(255,255,255,.5)', borderTopColor:'#fff', borderRadius:'50%', animation:'co-spin .6s linear infinite' }} />{t('checkout.actions.sending')}</>
            : isTableQR ? `🍽️ ${t('checkout.actions.order')} · ${formatCurrency(finalTotal)}` : `✓ ${t('checkout.actions.confirm')} · ${formatCurrency(finalTotal)}`
          }
        </button>
      </div>

      <style>{`@keyframes co-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
