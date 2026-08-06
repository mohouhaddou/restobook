import React from 'react';
import { PremiumIcon } from '../ui/PremiumIcon';
import { useNavigate } from 'react-router-dom';
import { ASSET } from '../../../api';
import { useI18n } from '../../../i18n/config';

const AVAILABILITY_KEY = { in_stock: 'marketplace.product.in_stock', low_stock: 'marketplace.product.limited_stock', out_of_stock: 'marketplace.product.rupture', unknown: null };

/**
 * "Disponible chez" — comparateur de vendeurs pour un produit groupé
 * (épicerie par code-barres ou pharmacie par DCI+dosage+forme uniquement,
 * jamais pour un plat resto). Consomme le tableau `sellers[]` déjà embarqué
 * dans la réponse de recherche — pas d'appel réseau supplémentaire nécessaire
 * dans le cas courant (GET /marketplace/products/:module/:groupKey/sellers
 * ne sert que de secours pour un lien profond direct).
 */
export function SellerCompareSheet({ product, onClose }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  if (!product) return null;

  function goToSeller(seller) {
    if (!seller.business?.slug) return;
    navigate(product.module === 'hanout' ? `/h/${seller.business.slug}` : `/ph/${seller.business.slug}`);
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 900, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="mk-wrap" style={{
        background: 'var(--mk-surface)', width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto',
        borderRadius: '20px 20px 0 0', padding: '20px 18px 28px', animation: 'mk-fadeUp .25s',
      }}>
        <div style={{ width: 40, height: 4, background: 'var(--mk-border)', borderRadius: 4, margin: '0 auto 16px' }} />
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: 'var(--mk-text)' }}>{product.name}</h3>
        <div style={{ fontSize: 12, color: 'var(--mk-muted)', marginBottom: 16 }}>{t('marketplace.product.available_at', { count: product.sellers?.length || product.seller_count })}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(product.sellers || []).map(s => {
            const label = AVAILABILITY_KEY[s.availability] ? t(AVAILABILITY_KEY[s.availability]) : null;
            return (
              <button key={s.product_id} onClick={() => goToSeller(s)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14,
                border: '1px solid var(--mk-border)', background: 'var(--mk-card)', cursor: 'pointer', textAlign: 'left',
              }}>
                {s.business?.logo_url ? (
                  <img src={ASSET(s.business.logo_url)} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--mk-bg)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PremiumIcon name="store" size={24} /></div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--mk-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.business?.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--mk-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                    {s.distance_km != null && <span className="premium-inline-icon"><PremiumIcon name="mapPin" size={13} />{s.distance_km} km</span>}
                    {s.eta_range && <span>⏱ {s.eta_range}</span>}
                    {label && <span>{label}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--mk-orange)' }}>{Number(s.price).toFixed(2)} MAD</div>
                  {s.compare_price != null && s.compare_price > s.price && (
                    <div style={{ fontSize: 11, color: 'var(--mk-muted)', textDecoration: 'line-through' }}>{Number(s.compare_price).toFixed(2)}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <button onClick={onClose} style={{
          width: '100%', marginTop: 16, padding: 12, borderRadius: 12, border: '1px solid var(--mk-border)',
          background: 'transparent', color: 'var(--mk-text2)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}>{t('marketplace.common.close')}</button>
      </div>
    </div>
  );
}
