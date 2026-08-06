import React from 'react';
import { useI18n } from '../../../i18n/config';
import { NEED_CATEGORIES } from '../../../config/needCategories';

/**
 * Ligne de catégories "besoin" (Repas, Viandes, Produits laitiers...) —
 * remplace la logique par TYPE DE COMMERCE sur la page d'accueil. Icônes SVG
 * en ligne (voir shared/icons/categories), recolorées via currentColor pour
 * suivre le thème clair/sombre automatiquement.
 */
export function NeedCategoryRow({ active, onSelect }) {
  const { t } = useI18n();
  return (
    <div className="mk-scroll" style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '4px 0 14px', scrollbarWidth: 'none' }}>
      {NEED_CATEGORIES.map(cat => {
        const isActive = active === cat.id;
        const Icon = cat.icon;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(isActive ? null : cat.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 18px',
              borderRadius: 18, border: `2px solid ${isActive ? 'var(--mk-orange)' : 'var(--mk-border)'}`,
              background: isActive ? 'var(--mk-orange)' : 'var(--mk-surface)',
              cursor: 'pointer', transition: 'all .2s', flexShrink: 0, minWidth: 84,
              boxShadow: isActive ? '0 6px 20px rgba(255,138,0,.3)' : 'none',
            }}
          >
            <Icon size={26} color={isActive ? '#fff' : 'var(--mk-muted)'} />
            <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', color: isActive ? '#fff' : 'var(--mk-text2)' }}>{t(cat.labelKey) || cat.label}</span>
          </button>
        );
      })}
    </div>
  );
}
