import React from 'react';
import { PremiumIcon, PremiumIconBadge } from '../../../shared/components/ui/PremiumIcon';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../../i18n/config';

const BRAND_THEME = { primary: '#FF8A00', dark: '#FF5D00', light: '#FFF7ED' };

/**
 * Tiroir d'aperçu panier partagé — extrait du CartDrawer historique de
 * HanoutPage.jsx (qui embarquait aussi le formulaire de commande). Ce
 * composant ne fait plus qu'afficher/éditer le panier : "{t('marketplace.cart.checkout')}" ferme
 * le tiroir et navigue vers /checkout, la page de commande unifiée
 * (CheckoutPage.jsx) qui branche déjà sur `cart.module` — c'est ce qui
 * matérialise "même interface graphique" pour resto/hanout/pharmacie plutôt
 * que de dupliquer un 2ᵉ tunnel de commande par commerce.
 *
 * Props :
 *   open        : boolean
 *   onClose()
 *   cart        : { items, remove(key), update(key,qty), total, clear() } —
 *                 même forme que le retour de useHanoutCart()/useCart() adapté
 *   businessName: string — affiché dans l'en-tête (facultatif)
 *   theme       : { primary, dark, light } — couleurs du commerce
 */
export function CartPreviewDrawer({ open, onClose, cart, businessName, theme = BRAND_THEME }) {
  const navigate = useNavigate();
  const { t, formatCurrency } = useI18n();
  const { items, remove, update, total, clear } = cart;

  function goToCheckout() {
    onClose();
    navigate('/checkout');
  }

  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 700, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: Math.min(440, window.innerWidth - 16), background: '#fff', zIndex: 701, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,.2)', animation: 'hn-slideIn .25s' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 10 }}>
          <PremiumIcon name="cart" size={20} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{t('marketplace.cart.title')}{businessName ? ` — ${businessName}` : ''}</h3>
          {items.length > 0 && <span style={{ marginLeft: 'auto', fontSize: 12, color: theme.primary, fontWeight: 700 }}>{t('marketplace.cart.itemCount', { count: items.reduce((s, i) => s + i.quantity, 0) })}</span>}
          <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 14, color: '#6B7280' }}aria-label={t('common.close')}>✕</button>
        </div>

        {items.length > 0 && (
          <div style={{ padding: '8px 20px 0', textAlign: 'right' }}>
            <button onClick={() => { if (window.confirm(t('marketplace.cart.clearConfirm'))) clear(); }} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
              <PremiumIcon name="trash" size={14} /> {t('marketplace.cart.clear')}
            </button>
          </div>
        )}

        {/* Panier vide */}
        {items.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#9CA3AF' }}>
            <div style={{ display: 'grid', placeItems: 'center', color: '#9CA3AF' }}><PremiumIconBadge name="cart" size={34} /></div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{t('marketplace.cart.empty')}</div>
          </div>
        )}

        {/* Liste articles */}
        {items.length > 0 && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(item => {
              const lineTotal = item.unit_price * item.quantity;
              const choiceOpts = (item.selected_options || []).filter(o => o.option_type === 'single_choice' || o.option_type === 'multi_choice');
              const qtyOpt    = (item.selected_options || []).find(o => o.option_type === 'quantity' || o.option_type === 'weight');
              const textOpts  = (item.selected_options || []).filter(o => o.option_type === 'text' || o.option_type === 'date_slot');
              const itemKey = item._key ?? item.id;
              return (
                <div key={itemKey} style={{ padding: '10px 12px', borderRadius: 12, background: '#F9FAFB', border: '1px solid #F3F4F6' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{item.libelle || item.name}</div>
                      {qtyOpt && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{qtyOpt.numeric_value} {item.unit} × {formatCurrency(Number(item.price ?? item.unit_price))}</div>}
                      {choiceOpts.map((o, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
                          <span style={{ color: '#9CA3AF' }}>{o.option_name}: </span>{o.value_label}
                          {Number(o.extra_price) > 0 && <span style={{ color: theme.primary }}> +{Number(o.extra_price).toFixed(2)}</span>}
                        </div>
                      ))}
                      {textOpts.map((o, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
                          <span style={{ color: '#9CA3AF' }}>{o.option_name}: </span>
                          <em>{(o.text_value || '').substring(0, 40)}{o.text_value?.length > 40 ? '…' : ''}</em>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {!qtyOpt && <>
                        <button onClick={() => update(itemKey, item.quantity - 1)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>−</button>
                        <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                        <button onClick={() => update(itemKey, item.quantity + 1)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: theme.primary, color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>+</button>
                      </>}
                      <div style={{ fontSize: 13, fontWeight: 700, minWidth: 56, textAlign: 'right' }}>{formatCurrency(lineTotal)}</div>
                      <button onClick={() => remove(itemKey)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 16, padding: 2 }}><PremiumIcon name="trash" size={16} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer — récap + CTA vers le checkout unifié */}
        {items.length > 0 && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #E5E7EB', background: '#FAFAFA' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, fontSize: 16, fontWeight: 800 }}>
              <span>{t('marketplace.cart.subtotal')}</span><span style={{ color: theme.primary }}>{formatCurrency(total)}</span>
            </div>
            <button onClick={goToCheckout} style={{ width: '100%', padding: '13px', background: `linear-gradient(135deg,${theme.primary},${theme.dark})`, border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              {t('marketplace.cart.checkout')}
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes hn-slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>
    </>
  );
}
