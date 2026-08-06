import React, { useEffect } from 'react';
import { useConsent } from '../../context/ConsentContext';
import { ensureAdSenseScriptLoaded, pushAdSenseUnit, isAdSenseEnabledClientSide } from './adSenseLoader';

// Rend UNIQUEMENT le balisage AdSense whitelisté (publisherId/adSlotId/format/
// responsive/fullWidthResponsive) — jamais de script arbitraire venant de la
// base de données. N'affiche rien si AdSense est désactivé côté client ou si
// le consentement "advertising" n'est pas accordé (spec §14).
export function AdSenseUnit({ adsense }) {
  const { consent } = useConsent();
  const canLoad = isAdSenseEnabledClientSide() && consent.advertising && adsense?.publisherId && adsense?.adSlotId;

  useEffect(() => {
    if (!canLoad) return;
    ensureAdSenseScriptLoaded(adsense.publisherId);
    pushAdSenseUnit();
  }, [canLoad, adsense?.publisherId, adsense?.adSlotId]);

  if (!canLoad) return null;

  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block', width: '100%' }}
      data-ad-client={adsense.publisherId}
      data-ad-slot={adsense.adSlotId}
      data-ad-format={adsense.format || 'auto'}
      data-full-width-responsive={adsense.fullWidthResponsive ? 'true' : 'false'}
    />
  );
}
