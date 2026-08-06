import React, { useEffect, useRef, useState } from 'react';
import { normalizeBarcode, validateBarcode } from '../../utils/barcode';
import { BarcodeCameraScanner } from './BarcodeCameraScanner';
import { PremiumIcon } from './PremiumIcon';

/**
 * Champ code-barres réutilisable — switch explicite entre deux modes :
 *   - "Saisie / Douchette" : champ texte, douchette USB/Bluetooth (tape les
 *     chiffres puis envoie Enter, comme un clavier) ou saisie manuelle.
 *   - "Caméra" : ouvre BarcodeCameraScanner (si aucune douchette disponible).
 * Après une détection caméra, repasse en mode "Saisie" pour montrer/permettre
 * de corriger la valeur détectée.
 *
 * Props :
 *   value        : string
 *   onChange     : (raw) => void — appelé à chaque frappe (édition libre dans un formulaire)
 *   onDetected   : (normalizedBarcode) => void — appelé sur Enter (douchette/saisie) ou sur détection caméra
 *   autoFocus    : boolean — pour l'écran POS (focus permanent sur le champ de scan)
 *   showWarning  : boolean — affiche l'avertissement de format sous le champ (défaut true)
 *   enableCamera : boolean — affiche le switch/mode caméra (défaut true)
 */
export function BarcodeInput({
  value = '', onChange, onDetected, autoFocus = false, disabled = false,
  placeholder = 'Scanner ou saisir un code-barres…', showWarning = true, enableCamera = true, style,
}) {
  const inputRef = useRef(null);
  const [mode, setMode] = useState('manual'); // 'manual' | 'camera'
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    if (autoFocus && mode === 'manual') inputRef.current?.focus();
  }, [autoFocus, mode]);

  function handleKeyDown(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault(); // évite de soumettre un <form> englobant par accident
    const normalized = normalizeBarcode(value);
    if (normalized.length < 3) return; // ignore un Enter accidentel sur un champ ~vide
    onDetected?.(normalized);
  }

  function handleBlur() {
    if (value) onChange?.(normalizeBarcode(value));
  }

  function handleCameraDetected(code) {
    setCameraOpen(false);
    setMode('manual');
    const normalized = normalizeBarcode(code);
    onChange?.(normalized);
    onDetected?.(normalized);
  }

  const normalized = normalizeBarcode(value);
  const { warning } = normalized ? validateBarcode(normalized) : { warning: null };

  return (
    <div>
      {enableCamera && (
        <div style={{ display: 'inline-flex', border: '1.5px solid var(--il-border, #E5E7EB)', borderRadius: 'var(--il-radius-sm, 8px)', overflow: 'hidden', marginBottom: 6 }}>
          <button type="button" onClick={() => setMode('manual')} disabled={disabled}
            style={{ padding: '4px 10px', border: 'none', background: mode === 'manual' ? 'var(--il-primary, #FF8A00)' : '#fff', color: mode === 'manual' ? '#fff' : 'var(--il-primary, #FF8A00)', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
            <><PremiumIcon name="keyboard" size={13} /> Saisie / Douchette</>
          </button>
          <button type="button" onClick={() => setMode('camera')} disabled={disabled}
            style={{ padding: '4px 10px', border: 'none', background: mode === 'camera' ? 'var(--il-primary, #FF8A00)' : '#fff', color: mode === 'camera' ? '#fff' : 'var(--il-primary, #FF8A00)', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
            <><PremiumIcon name="camera" size={13} /> Caméra</>
          </button>
        </div>
      )}

      {mode === 'manual' ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={e => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          style={{ width: '100%', ...style }}
        />
      ) : (
        <button type="button" onClick={() => setCameraOpen(true)} disabled={disabled}
          style={{ width: '100%', padding: '10px 12px', border: '1.5px dashed var(--il-primary, #FF8A00)', borderRadius: 'var(--il-radius-sm, 8px)', background: 'var(--il-primary-lighter, #FFF7ED)', color: 'var(--il-primary, #FF8A00)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          <><PremiumIcon name="camera" size={15} /> Ouvrir la caméra pour scanner</>
        </button>
      )}

      {showWarning && warning && (
        <div style={{ fontSize: 11, color: 'var(--il-warning, #F59E0B)', marginTop: 4 }}><span className="premium-inline-icon"><PremiumIcon name="alert" size={13} />{warning}</span></div>
      )}
      {cameraOpen && (
        <BarcodeCameraScanner
          onDetected={handleCameraDetected}
          onClose={() => setCameraOpen(false)}
          onUnavailable={() => setMode('manual')}
        />
      )}
    </div>
  );
}
