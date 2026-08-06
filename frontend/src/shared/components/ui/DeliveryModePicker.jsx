import React from 'react';
import { PremiumIcon } from './PremiumIcon';

const MODES = [
  { value: 'disabled', icon: 'ban', label: 'Désactivé', desc: 'Pas de dispatch automatique — vos livraisons restent dans le pool partagé, prises au premier livreur disponible.' },
  { value: 'network', icon: 'globe', label: 'Réseau iFilino', desc: 'Vos livraisons sont proposées automatiquement aux livreurs iFilino disponibles à proximité.' },
  { value: 'own_fleet', icon: 'delivery', label: 'Flotte propre', desc: 'Seuls vos propres livreurs reçoivent vos livraisons — les livreurs du réseau n’y ont pas accès.' },
];

export function DeliveryModePicker({ value, onChange }) {
  const current = value || 'disabled';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {MODES.map(m => {
        const active = current === m.value;
        return (
          <div
            key={m.value}
            role="radio"
            aria-checked={active}
            tabIndex={0}
            onClick={() => onChange(m.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onChange(m.value); }}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 12,
              border: `1.5px solid ${active ? 'var(--rb-orange,#FF8A00)' : '#E5E7EB'}`,
              background: active ? '#FFF7ED' : '#fff', cursor: 'pointer', transition: 'all .15s',
            }}
          >
            <span style={{ width: 30, height: 30, borderRadius: 10, background: active ? 'rgba(255,138,0,.12)' : '#F8FAFC', color: active ? 'var(--rb-orange,#FF8A00)' : '#64748B', display: 'grid', placeItems: 'center', flexShrink: 0 }}><PremiumIcon name={m.icon} size={17} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                {m.label}
                {active && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--rb-orange,#FF8A00)' }}>ACTIF</span>}
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{m.desc}</div>
            </div>
          </div>
        );
      })}
      {current === 'own_fleet' && (
        <div style={{ fontSize: 11.5, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '8px 12px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><PremiumIcon name="alert" size={14} /> La création de comptes livreurs propres à votre établissement se fait pour l'instant via le support iFilino — contactez-nous pour ajouter vos livreurs.</span>
        </div>
      )}
    </div>
  );
}
