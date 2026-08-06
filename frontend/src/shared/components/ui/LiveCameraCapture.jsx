import React, { useEffect, useRef, useState } from 'react';
import { PremiumIcon } from './PremiumIcon';

/**
 * Caméra live (getUserMedia) pour prendre une photo produit — plus fiable que
 * <input capture="environment">, dont le comportement varie trop selon
 * navigateur/OS (ouvre parfois un simple sélecteur de fichiers au lieu de la
 * caméra). Capture une seule image ; l'aperçu/reprise/compression restent
 * gérés par le composant appelant (ProductImageCapture), pas ici — on évite
 * ainsi de dupliquer cette étape.
 *
 * Props : { onCapture(file), onClose(), onUnavailable(error) }
 */
export function LiveCameraCapture({ onCapture, onClose, onUnavailable }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function openCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }, audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStarting(false);
      } catch (err) {
        if (cancelled) return;
        setStarting(false);
        setError('Caméra indisponible ou accès refusé — utilisez le fichier classique ci-dessous.');
        onUnavailable?.(err);
      }
    }
    openCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  function handleClose() {
    stopStream();
    onClose?.();
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      stopStream();
      onCapture?.(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={handleClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 16, width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}><PremiumIcon name="camera" size={18} /> Prendre une photo</h3>
          <button onClick={handleClose} aria-label="Fermer" style={{ background: 'none', border: 'none', cursor: 'pointer', width: 34, height: 34, display: 'grid', placeItems: 'center' }}><PremiumIcon name="close" size={18} /></button>
        </div>

        {error ? (
          <div style={{ padding: '24px 10px', textAlign: 'center', color: '#DC2626', fontSize: 13 }}>{error}</div>
        ) : (
          <video ref={videoRef} playsInline muted style={{ width: '100%', borderRadius: 10, background: '#000', minHeight: 240, objectFit: 'cover' }} />
        )}

        {starting && !error && (
          <div style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>Ouverture de la caméra…</div>
        )}

        {!error && !starting && (
          <button type="button" onClick={capture} className="if-btn if-btn-primary" style={{ width: '100%', marginTop: 12 }}>
            <PremiumIcon name="camera" size={16} /> Capturer
          </button>
        )}

        <div style={{ textAlign: 'center', fontSize: 11, color: '#9CA3AF', marginTop: 10 }}>
          L'envoi de fichier classique reste toujours disponible.
        </div>
      </div>
    </div>
  );
}
