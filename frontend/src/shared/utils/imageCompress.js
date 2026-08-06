/**
 * Compresse/redimensionne une image côté client avant upload, via <canvas>
 * (pas de dépendance supplémentaire). Utilisé par ProductImageCapture pour
 * les photos prises à la caméra (souvent très lourdes) comme pour les fichiers
 * choisis classiquement.
 *
 * Ne bloque jamais le flux : si la compression échoue pour une raison
 * quelconque (format non supporté par le canvas, navigateur restreint…),
 * renvoie le fichier original tel quel plutôt que d'empêcher l'upload.
 */
export async function compressImage(file, { maxWidth = 1280, maxHeight = 1280, quality = 0.82 } = {}) {
  if (!file || !file.type?.startsWith('image/')) return file;

  try {
    const bitmap = await loadImage(file);
    const { width, height } = fitDimensions(bitmap.width, bitmap.height, maxWidth, maxHeight);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;

    const compressedName = file.name.replace(/\.\w+$/, '') + '.jpg';
    return new File([blob], compressedName, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function fitDimensions(width, height, maxWidth, maxHeight) {
  let w = width, h = height;
  if (w > maxWidth) { h = Math.round(h * (maxWidth / w)); w = maxWidth; }
  if (h > maxHeight) { w = Math.round(w * (maxHeight / h)); h = maxHeight; }
  return { width: w, height: h };
}
