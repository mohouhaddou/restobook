import { API } from '../../../api';

// Déclenche un téléchargement authentifié — partagé par DigitalProductCard.jsx (page d'un livre)
// et KidsPurchasesPage.jsx ("Mes achats"), jamais dupliqué. Un <a href> classique ne fonctionnerait
// pas ici : le token client vit dans l'en-tête Authorization (CustomerAuthContext), jamais un
// cookie — il faut donc fetch() + blob plutôt qu'une navigation directe.
export async function downloadDigitalProductFile(productId, token) {
  const res = await fetch(API(`/digital-products/${productId}/download`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || 'download';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  URL.revokeObjectURL(url);
}
