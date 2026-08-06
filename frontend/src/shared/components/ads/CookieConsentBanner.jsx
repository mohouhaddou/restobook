import React from 'react';
import { useConsent } from '../../context/ConsentContext';
import { useI18n } from '../../../i18n/config';

// Bannière minimale — pas un CMP complet, juste le point d'accroche
// fonctionnel requis pour gater AdSense derrière un consentement explicite.
export function CookieConsentBanner() {
  const { hasDecided, acceptAll, rejectAll } = useConsent();
  const { t } = useI18n();
  if (hasDecided) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      style={{
        position: 'fixed', insetInline: 12, bottom: 12, zIndex: 3000,
        maxWidth: 640, margin: '0 auto', background: '#0F1B2D', color: '#fff',
        borderRadius: 14, padding: '16px 18px', display: 'flex', flexWrap: 'wrap',
        alignItems: 'center', gap: 12, boxShadow: '0 12px 32px rgba(0,0,0,.25)',
      }}
    >
      <div style={{ flex: 1, minWidth: 220, fontSize: 13, lineHeight: 1.5 }}>
        {t('ads.consent.message')}
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={rejectAll}
          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.35)', color: '#fff', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
        >
          {t('ads.consent.rejectAll')}
        </button>
        <button
          onClick={acceptAll}
          style={{ background: '#FF6A00', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
        >
          {t('ads.consent.acceptAll')}
        </button>
      </div>
    </div>
  );
}
