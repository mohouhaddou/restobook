import React from 'react';
import { useI18n } from '../../../i18n/config';

/**
 * Bouton "Ajouter au panier" unifié — resto/hanout/pharmacie/tout futur type
 * de commerce. stopPropagation + preventDefault intégrés une fois pour
 * toutes : partout où ce bouton est utilisé à l'intérieur d'une carte
 * cliquable (ouverture fiche produit au clic sur la carte), un clic ici
 * n'ouvre jamais la fiche détail.
 */
export function AddToCartButton({ label, addedLabel, unavailableLabel, added = false, disabled = false, onClick, color = '#FF8A00', style }) {
  const { t } = useI18n();
  const isDisabled = disabled && !added;
  const finalLabel = label || t('marketplace.cart.add');
  const finalAddedLabel = addedLabel || t('marketplace.cart.added');
  const finalUnavailableLabel = unavailableLabel || t('marketplace.product.unavailable');
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); e.preventDefault(); if (!isDisabled) onClick?.(); }}
      disabled={isDisabled}
      style={{
        width: '100%', padding: '13px 20px', borderRadius: 14, border: 'none',
        background: isDisabled ? '#E5E7EB' : (added ? '#16A34A' : color),
        color: isDisabled ? '#9CA3AF' : '#fff',
        fontWeight: 800, fontSize: 15, cursor: isDisabled ? 'default' : 'pointer',
        transition: 'background .2s, transform .1s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        ...style,
      }}
    >
      {disabled ? finalUnavailableLabel : (added ? finalAddedLabel : finalLabel)}
    </button>
  );
}
