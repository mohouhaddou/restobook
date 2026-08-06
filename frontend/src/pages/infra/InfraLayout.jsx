import React, { useState } from 'react';
import { DashboardIcon } from '../../shared/components/ui/DashboardIcon';
import { PremiumIcon } from '../../shared/components/ui/PremiumIcon';

// Enveloppe commune aux 11 pages du Centre de Supervision Infrastructure —
// porte le titre, des actions optionnelles (ex: bouton "Créer une
// sauvegarde"), et le toggle de mode sombre SCOPÉ à ce module uniquement.
//
// `.il-dark` porte déjà toutes les valeurs de --il-* en version sombre (voir
// theme-dark.css) — les composants du design system (.if-card, .if-btn, tout
// ce qui utilise var(--il-*) plutôt que des couleurs en dur) en héritent
// automatiquement par cascade CSS, sans code supplémentaire par page.
export function InfraLayout({ title, icon, actions, children }) {
  const [dark, setDark] = useState(() => localStorage.getItem('infra_dark_mode') === '1');

  function toggleDark() {
    setDark(prev => {
      const next = !prev;
      localStorage.setItem('infra_dark_mode', next ? '1' : '0');
      return next;
    });
  }

  return (
    <div
      className={dark ? 'il-dark' : ''}
      style={{
        background: dark ? 'var(--il-bg)' : 'transparent',
        borderRadius: 18,
        padding: dark ? '18px' : 0,
        margin: dark ? '-18px' : 0,
        transition: 'background .2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h4 style={{ margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--il-text, #111827)' }}>
          {icon && <DashboardIcon icon={icon} size={22} />} {title}
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {actions}
          <button
            onClick={toggleDark}
            className="if-btn if-btn-outline if-btn-sm"
            title="Mode sombre (Centre de Supervision uniquement)"
          >
            <><PremiumIcon name={dark ? 'sun' : 'moon'} size={14} /> {dark ? 'Clair' : 'Sombre'}</>
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
