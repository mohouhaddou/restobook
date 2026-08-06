import React from 'react';

// Écran "Bientôt disponible" soigné pour les fonctionnalités Phase 2
// (Espace Famille, Cartes cadeaux) — même langage visuel que le reste du
// dashboard, pas un stub générique.
export function ComingSoonCard({ icon, title, description, features = [] }) {
  return (
    <div className="mk-card" style={{ padding: '36px 24px', textAlign: 'center', maxWidth: 480, margin: '20px auto' }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, margin: '0 auto 18px',
        background: 'linear-gradient(135deg, var(--mk-orange), #FF5D00)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
      }}>{icon}</div>
      <div style={{
        display: 'inline-block', fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
        color: 'var(--mk-orange)', background: 'var(--mk-orange-light)', padding: '4px 12px', borderRadius: 20, marginBottom: 12,
      }}>Bientôt disponible</div>
      <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--mk-text)', margin: '0 0 8px' }}>{title}</h2>
      <p style={{ fontSize: 13, color: 'var(--mk-muted)', lineHeight: 1.5, margin: '0 0 20px' }}>{description}</p>
      {features.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {features.map(f => (
            <li key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--mk-text2)' }}>
              <span style={{ color: 'var(--mk-orange)', flexShrink: 0 }}>✦</span>{f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
