import React from 'react';
import { PremiumIconBadge } from '../ui/PremiumIcon';
import { Portal } from '../ui/Portal';
import { useI18n } from '../../../i18n/config';

/**
 * Modale affichée quand le panier resto contient déjà des articles d'un autre
 * commerce (un panier = un seul vendeur, comme Glovo/Uber Eats/Deliveroo —
 * voir CartContext.addItem). Remplace l'ancien window.confirm() natif.
 */
export function CartConflictModal({ show, currentOrgName, targetOrgName, onCancel, onConfirm }) {
  const { t } = useI18n();
  if (!show) return null;

  return (
    <Portal>
    {/* stopPropagation : ce composant peut être imbriqué dans une carte cliquable
        (ProductCard) — sans ça, cliquer Annuler/Confirmer déclencherait aussi le
        onClick de la carte parente (navigation vers la fiche commerce). Le
        Portal, lui, corrige un bug distinct : .mk-card a will-change:transform,
        qui confine tout position:fixed descendant à la carte au lieu du
        viewport (même cause que PresetPickerModal/BestStoreResultSheet). */}
    <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)', animation: 'mk-fadeIn .2s' }}>
      <div style={{ background: 'var(--mk-surface)', borderRadius: 20, padding: 28, maxWidth: 360, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'grid', placeItems: 'center', marginBottom: 12, color: 'var(--mk-orange)' }}><PremiumIconBadge name="cart" size={28} /></div>
        <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: 'var(--mk-text)', textAlign: 'center' }}>
          {t('marketplace.cart.conflictTitle')}
        </h3>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--mk-muted)', lineHeight: 1.5, textAlign: 'center' }}>
          {t('marketplace.cart.conflictMessage', { currentOrgName, targetOrgName })}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '12px', border: '1.5px solid var(--mk-border)', borderRadius: 12, background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--mk-text)' }}>{t('common.cancel')}</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '12px', border: 'none', borderRadius: 12, background: 'var(--mk-orange)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>{t('marketplace.cart.clearAndOrder')}</button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
