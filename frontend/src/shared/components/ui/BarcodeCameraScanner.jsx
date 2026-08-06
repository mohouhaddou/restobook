import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { playBeep } from '../../utils/beep';
import { Portal } from './Portal';
import { PremiumIcon } from './PremiumIcon';

const SCAN_ELEMENT_ID = 'barcode-camera-scanner-viewport';
const SAME_CODE_COOLDOWN_MS = 1500; // ignore les re-détections du même code pendant que l'objet reste dans le cadre

/**
 * Scan code-barres par caméra — complément du scan douchette USB/Bluetooth
 * (clavier) déjà géré par <BarcodeInput/>. Repose sur html5-qrcode, qui gère
 * le cycle de vie caméra (permission, démarrage/arrêt) et utilise l'API
 * native BarcodeDetector du navigateur quand elle est disponible
 * (useBarCodeDetectorIfSupported), avec repli automatique sur son propre
 * décodeur ZXing sinon.
 *
 * Un bip sonore confirme chaque détection (scanner physique ou caméra).
 *
 * Ne bloque jamais : en cas de refus de permission ou de caméra indisponible,
 * affiche un message clair et laisse la saisie manuelle (BarcodeInput) prendre
 * le relais — onUnavailable() prévient l'appelant sans lever d'exception.
 *
 * Props :
 *   onDetected(barcode)  — appelé à chaque code détecté
 *   onClose()            — fermeture (bouton ✕ ou clic hors modale)
 *   onUnavailable(error)
 *   continuous           — si true (POS), la caméra reste ouverte après une
 *                           détection pour scanner plusieurs produits à la
 *                           suite ; ne se ferme que sur onClose (fermeture
 *                           manuelle). Par défaut false (formulaires produit :
 *                           une seule valeur à remplir, fermeture après scan).
 *   includeQr            — ajoute QR_CODE aux formats reconnus (carte iFilino
 *                           notamment) ; false par défaut (codes-barres produit uniquement).
 *   title / hintText      — personnalisation du texte de la modale (autre cas d'usage que les produits).
 *
 * Multi-caméra (smartphone/tablette avant+arrière, ou plusieurs objectifs) :
 * la liste des caméras est énumérée via Html5Qrcode.getCameras() ; un bouton
 * de bascule n'apparaît que si l'appareil en expose plus d'une. Le choix
 * explicite (cameraId) prend le pas sur le simple facingMode par défaut.
 */
export function BarcodeCameraScanner({
  onDetected, onClose, onUnavailable, continuous = false, includeQr = false,
  title = 'Scanner un code-barres', hintText = 'Scannez vos produits les uns après les autres — fermez quand vous avez terminé.',
}) {
  const stopFnRef = useRef(() => Promise.resolve());
  const camerasFetchedRef = useRef(false);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);
  const [lastScanned, setLastScanned] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [activeCameraId, setActiveCameraId] = useState(null); // null = facingMode par défaut (arrière)

  useEffect(() => {
    let cancelled = false;
    let stopped = false; // évite un double stop() (callback succès + démontage React), qui lève une exception synchrone dans html5-qrcode
    let lastCode = null;
    let lastTime = 0;

    const scanner = new Html5Qrcode(SCAN_ELEMENT_ID, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        ...(includeQr ? [Html5QrcodeSupportedFormats.QR_CODE] : []),
      ],
      useBarCodeDetectorIfSupported: true,
      verbose: false,
    });

    const safeStop = async () => {
      if (stopped) return;
      stopped = true;
      try { if (scanner.isScanning) await scanner.stop(); } catch { /* déjà arrêté */ }
      try { scanner.clear(); } catch { /* déjà nettoyé */ }
    };
    stopFnRef.current = safeStop;

    async function run() {
      // Énumération des caméras — une seule fois (permission déjà accordée
      // dès le premier start() ci-dessous, pas besoin de la redemander).
      if (!camerasFetchedRef.current) {
        try {
          const cams = await Html5Qrcode.getCameras();
          if (!cancelled && Array.isArray(cams)) setCameras(cams);
        } catch { /* énumération indisponible — reste sur le facingMode par défaut, pas bloquant */ }
        camerasFetchedRef.current = true;
      }
      if (cancelled) return;

      scanner.start(
        activeCameraId || { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          if (cancelled) return;
          const now = Date.now();
          if (decodedText === lastCode && now - lastTime < SAME_CODE_COOLDOWN_MS) return; // même code encore dans le cadre
          lastCode = decodedText;
          lastTime = now;

          playBeep();

          if (continuous) {
            setLastScanned(decodedText);
            onDetected?.(decodedText);
          } else {
            cancelled = true;
            safeStop().finally(() => onDetected?.(decodedText));
          }
        },
        () => { /* échec de décodage sur une frame donnée — normal tant qu'aucun code n'est dans le cadre */ }
      ).then(() => {
        if (!cancelled) setStarting(false);
      }).catch((err) => {
        if (cancelled) return;
        setStarting(false);
        setError('Caméra indisponible ou accès refusé — utilisez la saisie manuelle ci-dessous.');
        onUnavailable?.(err);
      });
    }
    setStarting(true);
    run();

    return () => {
      cancelled = true;
      safeStop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continuous, activeCameraId]);

  function switchCamera() {
    if (cameras.length < 2) return;
    const currentIdx = cameras.findIndex(c => c.id === activeCameraId);
    const nextIdx = (currentIdx + 1) % cameras.length;
    setActiveCameraId(cameras[nextIdx].id);
  }

  useEffect(() => {
    if (!lastScanned) return;
    const t = setTimeout(() => setLastScanned(null), 1200);
    return () => clearTimeout(t);
  }, [lastScanned]);

  function handleClose() {
    stopFnRef.current().finally(() => onClose?.());
  }

  return (
    <Portal>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={handleClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 16, width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, flex: 1 }}>{title}</h3>
          {cameras.length > 1 && (
            <button
              onClick={switchCamera}
              title="Changer de caméra"
              style={{ background: '#F3F4F6', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}
            ><PremiumIcon name="refresh" size={14} /></button>
          )}
          <button onClick={handleClose} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}><PremiumIcon name="close" size={14} /></button>
        </div>

        {error ? (
          <div style={{ padding: '24px 10px', textAlign: 'center', color: '#DC2626', fontSize: 13 }}>{error}</div>
        ) : (
          <div style={{ position: 'relative' }}>
            <div id={SCAN_ELEMENT_ID} style={{ width: '100%', borderRadius: 10, overflow: 'hidden', background: '#000', minHeight: 240 }} />
            {cameras.length > 1 && !starting && (
              <div style={{
                position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,.55)', color: '#fff',
                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, pointerEvents: 'none',
              }}>
                Caméra {Math.max(0, cameras.findIndex(c => c.id === activeCameraId)) + 1}/{cameras.length}
              </div>
            )}
            {!starting && (
              <div style={{
                position: 'absolute', top: '50%', left: '6%', right: '6%', height: 2,
                background: '#EF4444', boxShadow: '0 0 8px 2px rgba(239,68,68,.8)',
                transform: 'translateY(-50%)', animation: 'barcode-scan-line-blink 1s ease-in-out infinite',
                pointerEvents: 'none', borderRadius: 2,
              }} />
            )}
            {lastScanned && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(16,185,129,.85)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, padding: 12, textAlign: 'center' }}>
                Scanné : {lastScanned}
              </div>
            )}
          </div>
        )}
        <style>{`
          @keyframes barcode-scan-line-blink {
            0%, 100% { opacity: 1; }
            50% { opacity: .15; }
          }
        `}</style>

        {starting && !error && (
          <div style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>Ouverture de la caméra…</div>
        )}
        {continuous && !error && (
          <div style={{ textAlign: 'center', fontSize: 12, color: '#059669', fontWeight: 600, marginTop: 8 }}>
            {hintText}
          </div>
        )}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#9CA3AF', marginTop: 10 }}>
          La saisie manuelle du code-barres reste toujours disponible.
        </div>
      </div>
    </div>
    </Portal>
  );
}
