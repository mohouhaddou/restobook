import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { getTierDisplay } from '../../config/loyaltyTiers';

// Carte iFilino — glassmorphism, réutilise le système de tiers existant
// (Bronze/Argent/Or/Platine → iFilino/iFilino+/Premium/Famille, voir
// shared/config/loyaltyTiers.js). Utilisée sur l'Accueil (aperçu compact)
// et sur IfilinoCardPage (pleine page).
export function IfilinoCard({ user, tier, points = 0, compact = false }) {
  const [qr, setQr] = useState(null);
  const display = getTierDisplay(tier);
  // Tant que `user` n'est pas encore chargé, ne PAS retomber sur un id
  // fictif (0) : le QR encoderait "IFILINO-0", un code qui n'existe pour
  // aucun client et que le POS rejette en "Client introuvable" — et que le
  // client pourrait scanner/enregistrer avant que ses vraies données arrivent.
  const cardValue = user?.id ? `IFILINO-${user.id}` : null;

  useEffect(() => {
    if (!cardValue) { setQr(null); return; }
    QRCode.toDataURL(cardValue, { width: compact ? 96 : 128, margin: 1, color: { dark: '#0F172A', light: '#FFFFFF00' } })
      .then(setQr).catch(() => {});
  }, [cardValue, compact]);

  return (
    <div style={{
      position: 'relative', overflow: 'hidden', boxSizing: 'border-box',
      background: display.gradient,
      // Proportions d'une vraie carte bancaire (ISO/IEC 7810 ID-1 : 85.60 × 53.98 mm)
      width: '100%', maxWidth: compact ? 300 : 380, aspectRatio: '85.6 / 53.98', margin: compact ? 0 : '0 auto',
      borderRadius: compact ? 14 : 18, padding: compact ? 16 : 22,
      color: '#fff', boxShadow: '0 12px 40px rgba(0,0,0,.22)',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      {/* Reflets glassmorphism */}
      <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,.14)' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.08)' }} />

      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', opacity: .85, textTransform: 'uppercase' }}>Carte</div>
          <div style={{ fontSize: compact ? 20 : 26, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
            {display.icon} {display.displayName}
          </div>
        </div>
        {qr && (
          <div style={{ background: '#fff', borderRadius: 10, padding: 5, flexShrink: 0 }}>
            <img src={qr} alt="QR code carte" width={compact ? 48 : 64} height={compact ? 48 : 64} />
          </div>
        )}
      </div>

      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, opacity: .8 }}>{user?.nom || 'Client iFilino'}</div>
          <div style={{ fontSize: 12, opacity: .7, letterSpacing: '.04em', fontFamily: 'monospace' }}>{cardValue || 'Chargement…'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: compact ? 18 : 22, fontWeight: 900 }}>{points.toLocaleString('fr-FR')}</div>
          <div style={{ fontSize: 10, opacity: .8, textTransform: 'uppercase', letterSpacing: '.05em' }}>points</div>
        </div>
      </div>
    </div>
  );
}
