import React, { useEffect, useState } from 'react';
import { Portal } from '../../../shared/components/ui/Portal';
import { useMkTheme } from '../../../shared/hooks/useMkTheme';

/**
 * "✨ Générer une liste" — présets curés à la main (décision verrouillée :
 * pas de génération par IA/LLM réel, aucun n'existe dans ce codebase).
 */
export function PresetPickerModal({ presets, onPick, onClose, generating }) {
  const [theme] = useMkTheme();
  return (
    <Portal>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 900, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className={`mk-wrap mk-${theme}`} style={{
        background: 'var(--mk-surface)', width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto',
        borderRadius: '20px 20px 0 0', padding: '20px 18px 28px', animation: 'mk-fadeUp .25s',
      }}>
        <div style={{ width: 40, height: 4, background: 'var(--mk-border)', borderRadius: 4, margin: '0 auto 16px' }} />
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: 'var(--mk-text)' }}>✨ Générer une liste</h3>
        <div style={{ fontSize: 12, color: 'var(--mk-muted)', marginBottom: 16 }}>Une sélection curée d'articles prête à ajuster.</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {presets.map(p => (
            <button key={p.key} disabled={!!generating} onClick={() => onPick(p.key)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 10px',
              borderRadius: 14, border: '1px solid var(--mk-border)', background: 'var(--mk-card)',
              cursor: generating ? 'default' : 'pointer', opacity: generating ? .6 : 1,
            }}>
              <span style={{ fontSize: 28 }}>{p.icon}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--mk-text)', textAlign: 'center' }}>{p.name}</span>
              <span style={{ fontSize: 10.5, color: 'var(--mk-muted)' }}>{p.items_count} articles</span>
            </button>
          ))}
        </div>

        {generating && <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12.5, color: 'var(--mk-muted)' }}>Génération en cours…</div>}

        <button onClick={onClose} style={{
          width: '100%', marginTop: 16, padding: 12, borderRadius: 12, border: '1px solid var(--mk-border)',
          background: 'transparent', color: 'var(--mk-text2)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}>Fermer</button>
      </div>
    </div>
    </Portal>
  );
}
