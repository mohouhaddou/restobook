import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../../i18n/config';
import { useAdSlot } from '../../hooks/useAdSlot';
import { AdSenseUnit } from './AdSenseUnit';

/**
 * <AdSlot placement="below_header" /> — composant réutilisable pour tous les
 * emplacements publicitaires. Ne rend RIEN (pas même un conteneur vide) quand
 * aucune publicité n'est éligible, pour éviter tout espace vide (spec §6).
 */
export function AdSlot({ placement, platform, route, language, authToken, style }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { ad, loading, recordImpression, recordClick } = useAdSlot({ placement, platform, route, language, authToken });
  const containerRef = useRef(null);

  // Une impression n'est comptée que lorsque la publicité devient réellement
  // visible (seuil 50%), jamais au simple montage du composant.
  useEffect(() => {
    if (!ad || !containerRef.current) return undefined;
    const el = containerRef.current;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) { recordImpression(); observer.disconnect(); }
    }, { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ad]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !ad) return null;

  const isAdSense = ad.source_type === 'adsense';
  const aspect = ad.recommended_desktop_size?.match(/^(\d+)x(\d+)$/);

  function handleClick() {
    recordClick();
    if (!ad.destination_url) return;
    if (ad.open_in_new_tab) window.open(ad.destination_url, '_blank', 'noopener,noreferrer');
    else navigate(ad.destination_url);
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative', width: '100%', maxWidth: '100%', overflow: 'hidden',
        borderRadius: 12, background: ad.background_color || 'transparent',
        ...(aspect ? { aspectRatio: `${aspect[1]} / ${aspect[2]}` } : {}),
        ...style,
      }}
    >
      {ad.sponsored && (
        <span style={{
          position: 'absolute', top: 6, insetInlineStart: 8, zIndex: 2, fontSize: 10, fontWeight: 700,
          padding: '2px 8px', borderRadius: 20, background: 'rgba(15,27,45,.65)', color: '#fff', letterSpacing: .3,
        }}>
          {t('ads.sponsoredLabel')}
        </span>
      )}

      {isAdSense ? (
        <AdSenseUnit adsense={ad.adsense} />
      ) : (
        <button
          onClick={handleClick}
          style={{
            all: 'unset', cursor: ad.destination_url ? 'pointer' : 'default', display: 'block', width: '100%',
            boxSizing: 'border-box', color: ad.background_color ? '#111' : 'inherit',
          }}
        >
          {(ad.mobile_image_url || ad.desktop_image_url) && (
            <picture>
              {ad.mobile_image_url && <source media="(max-width: 640px)" srcSet={ad.mobile_image_url} />}
              <img
                src={ad.desktop_image_url || ad.mobile_image_url}
                alt={ad.alt_text || ad.title || ''}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </picture>
          )}
          {(ad.title || ad.button_text) && (
            <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              {ad.title && <span style={{ fontSize: 13.5, fontWeight: 700 }}>{ad.title}</span>}
              {ad.button_text && (
                <span style={{ fontSize: 12.5, fontWeight: 700, padding: '6px 12px', borderRadius: 8, background: '#FF6A00', color: '#fff', whiteSpace: 'nowrap' }}>
                  {ad.button_text}
                </span>
              )}
            </div>
          )}
        </button>
      )}
    </div>
  );
}
