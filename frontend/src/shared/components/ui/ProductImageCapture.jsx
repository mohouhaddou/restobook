import React, { useRef, useState } from 'react';
import { compressImage } from '../../utils/imageCompress';
import { LiveCameraCapture } from './LiveCameraCapture';
import { PremiumIcon } from './PremiumIcon';

/**
 * Ajoute une photo produit — switch pour choisir entre "Fichier" (sélecteur
 * classique de l'appareil) et "Caméra" (vue caméra live dans l'app, via
 * LiveCameraCapture) — plus fiable que <input capture="environment">, dont le
 * comportement varie trop selon navigateur/OS (ouvre parfois un simple
 * sélecteur de fichiers au lieu de la caméra).
 *
 * Dans les deux cas : aperçu local avec reprise possible avant upload.
 * N'affiche pas l'image déjà enregistrée du produit (gérée par le formulaire
 * parent) — uniquement le flux d'ajout d'une nouvelle photo.
 *
 * Props :
 *   uploadFn(file) => Promise<url>  — réutilise l'endpoint d'upload existant de la page
 *   onImageReady(url)               — appelé une fois l'upload terminé
 *   accentColor                     — couleur du bouton principal (cohérence par module)
 */
export function ProductImageCapture({ uploadFn, onImageReady, accentColor = '#FF8A00', disabled = false }) {
  const [mode, setMode] = useState('file'); // 'file' | 'camera'
  const [cameraOpen, setCameraOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    setError('');
    const compressed = await compressImage(file);
    setPreviewFile(compressed);
    setPreviewUrl(URL.createObjectURL(compressed));
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewUrl(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function confirmUpload() {
    if (!previewFile) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadFn(previewFile);
      onImageReady?.(url);
      reset();
    } catch (e) {
      setError(e.message || "Échec de l'envoi de l'image");
    }
    setUploading(false);
  }

  if (previewFile) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <img src={previewUrl} alt="Aperçu" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 10, border: '1.5px solid #E5E7EB' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button type="button" onClick={confirmUpload} disabled={uploading}
              style={{ padding: '8px 14px', background: accentColor, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 12, cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
              {uploading ? 'Envoi…' : <><PremiumIcon name="check" size={13} /> Utiliser cette photo</>}
            </button>
            <button type="button" onClick={reset} disabled={uploading}
              style={{ padding: '8px 14px', background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 8, color: '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
              <><PremiumIcon name="refresh" size={13} /> Reprendre</>
            </button>
          </div>
        </div>
        {error && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 6 }}>{error}</div>}
      </div>
    );
  }

  return (
    <div>
      {/* Switch Fichier / Caméra */}
      <div style={{ display: 'inline-flex', border: `1.5px solid ${accentColor}55`, borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
        <button type="button" onClick={() => setMode('file')} disabled={disabled}
          style={{ padding: '5px 12px', border: 'none', background: mode === 'file' ? accentColor : '#fff', color: mode === 'file' ? '#fff' : accentColor, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
          <><PremiumIcon name="folder" size={13} /> Fichier</>
        </button>
        <button type="button" onClick={() => setMode('camera')} disabled={disabled}
          style={{ padding: '5px 12px', border: 'none', background: mode === 'camera' ? accentColor : '#fff', color: mode === 'camera' ? '#fff' : accentColor, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
          <><PremiumIcon name="camera" size={13} /> Caméra</>
        </button>
      </div>

      {mode === 'file' ? (
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '14px', border: `2px dashed ${accentColor}55`, borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer', background: `${accentColor}10`, color: accentColor, fontWeight: 600, fontSize: 12, opacity: disabled ? 0.6 : 1 }}>
          <><PremiumIcon name="folder" size={18} />Choisir une image</>
          <input ref={fileInputRef} type="file" accept="image/*" disabled={disabled} style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
        </label>
      ) : (
        <button type="button" onClick={() => setCameraOpen(true)} disabled={disabled}
          style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '14px', border: `2px dashed ${accentColor}55`, borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer', background: `${accentColor}10`, color: accentColor, fontWeight: 600, fontSize: 12, opacity: disabled ? 0.6 : 1 }}>
          <><PremiumIcon name="camera" size={18} />Ouvrir la caméra</>
        </button>
      )}

      {error && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 6 }}>{error}</div>}

      {cameraOpen && (
        <LiveCameraCapture
          onCapture={(file) => { setCameraOpen(false); handleFile(file); }}
          onClose={() => setCameraOpen(false)}
          onUnavailable={() => setMode('file')}
        />
      )}
    </div>
  );
}
