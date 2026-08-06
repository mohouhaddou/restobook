import React, { useEffect, useState } from 'react';
import { X, ShoppingCart, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../../../i18n/config';
import { useCustomerAuth } from '../../marketplace/CustomerAuthContext';
import { API, ASSET } from '../../../api';
import { PayPalButton } from '../../../shared/components/payments/PayPalButton';
import { PaddleButton } from '../../../shared/components/payments/PaddleButton';

/**
 * Modale d'achat — "Simuler l'achat" (remplace BookPurchaseModal.tsx "bientôt disponible") reste
 * toujours disponible pour les démos/tests sans compte de paiement réel. Les moyens de paiement
 * réels (PayPal, Paddle, d'autres demain) s'affichent EN PLUS, jamais à la place, uniquement s'ils
 * sont activés par le SuperAdmin (GET /payments/providers) — voir backend/src/modules/payments/.
 * Ni le SDK ni l'API d'un provider ne sont jamais appelés directement ici : chaque bouton
 * (PayPalButton.jsx, PaddleButton.jsx) relaie tout vers nos propres routes backend, qui seules
 * parlent à PaymentProvider.
 */
export function PurchaseModal({ product, onClose, onPurchased }) {
  const { t } = useI18n();
  const { token } = useCustomerAuth();
  const [step, setStep] = useState('confirm'); // 'confirm' | 'success' | 'error'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [realProviders, setRealProviders] = useState([]);

  useEffect(() => {
    setStep('confirm'); setError('');
    if (!product) return;
    fetch(API('/payments/providers')).then(r => r.json()).then(d => setRealProviders(d.providers || [])).catch(() => setRealProviders([]));
  }, [product]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!product) return null;

  const paypalProvider = realProviders.find(p => p.provider === 'paypal');
  const paddleProvider = realProviders.find(p => p.provider === 'paddle');

  function handlePaymentSuccess() {
    setStep('success');
    onPurchased();
  }
  function handlePaymentError(message) {
    setError(message || t('kids.digitalProducts.purchase.error'));
  }

  async function simulatePurchase() {
    setLoading(true); setError('');
    try {
      const res = await fetch(API(`/digital-products/${product.id}/purchase`), {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Purchase failed');
      setStep('success');
      onPurchased();
    } catch {
      setError(t('kids.digitalProducts.purchase.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="book-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="digital-product-purchase-title" onClick={onClose}>
      <div className="book-modal digital-product-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="book-modal-close" onClick={onClose} aria-label={t('common.close')}><X size={18}/></button>

        {step === 'success' ? (
          <>
            <span className="book-modal-icon digital-product-modal-success-icon" aria-hidden="true"><CheckCircle2 size={26}/></span>
            <h3 id="digital-product-purchase-title">{t('kids.digitalProducts.purchase.successTitle')}</h3>
            <p className="book-modal-text">{t('kids.digitalProducts.purchase.successText')}</p>
            <button type="button" className="book-modal-btn" onClick={onClose}>{t('common.close')}</button>
          </>
        ) : (
          <>
            <span className="book-modal-icon" aria-hidden="true"><ShoppingCart size={22}/></span>
            <h3 id="digital-product-purchase-title">{t('kids.digitalProducts.purchase.title')}</h3>
            {product.coverImageUrl && (
              <img className="digital-product-modal-illustration" src={ASSET(product.coverImageUrl)} alt=""/>
            )}
            <p className="digital-product-modal-name">{product.title}</p>
            {product.description && <p className="book-modal-text">{product.description}</p>}
            <p className="book-modal-price">{Number(product.price).toFixed(2)} {product.currency}</p>
            {error && <p className="digital-product-card-error">{error}</p>}

            {paypalProvider && (
              <>
                <div className="digital-product-modal-paypal">
                  <PayPalButton
                    productId={product.id}
                    clientId={paypalProvider.config?.client_id}
                    currency={product.currency}
                    token={token}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                </div>
                <div className="digital-product-modal-divider"><span>{t('common.or')}</span></div>
              </>
            )}

            {paddleProvider && (
              <>
                <div className="digital-product-modal-paddle">
                  <PaddleButton
                    productId={product.id}
                    clientToken={paddleProvider.config?.client_token}
                    sandbox={paddleProvider.mode !== 'production'}
                    token={token}
                    label={t('kids.digitalProducts.purchase.payWithPaddle')}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                </div>
                <div className="digital-product-modal-divider"><span>{t('common.or')}</span></div>
              </>
            )}

            <p className="book-modal-text">{t('kids.digitalProducts.purchase.simulationNotice')}</p>
            <div className="digital-product-modal-actions">
              <button type="button" className="digital-product-modal-cancel" onClick={onClose} disabled={loading}>
                {t('common.cancel')}
              </button>
              <button type="button" className="book-modal-btn" onClick={simulatePurchase} disabled={loading}>
                {loading ? t('kids.digitalProducts.purchase.simulating') : t('kids.digitalProducts.purchase.simulate')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
