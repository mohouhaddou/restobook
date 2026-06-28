// src/api.js

// Base API:
// - En prod (Vite build), on lit VITE_API_URL (que tu fixes à "/api")
// - En dev (vite --port 5173, par ex.), tu peux mettre VITE_API_URL="http://localhost:3001/api"
const API_BASE =
  (import.meta && import.meta.env && import.meta.env.VITE_API_URL) ||
  '/restobook/api/';

// Construit une URL correcte en évitant les doubles / :
const join = (base, p = '') => {
  const normalizedBase = String(base || '').replace(/\/+$/, '');
  const normalizedPath = String(p || '').replace(/^\/+/, '');
  if (!normalizedPath) return normalizedBase || '/';
  return `${normalizedBase}/${normalizedPath}`;
};

// Appels API (fetch/axios utiliseront cette base)
export const API = (p = '') => join(API_BASE, p);

// Assets (images, fichiers) :
// - Si p est déjà une URL absolue (http/https), on la renvoie telle quelle
// - Sinon on retourne un chemin relatif à **la même origine** (front + Nginx).
//   À toi de décider si tes assets sont servis par le backend sous /uploads.
//   Dans ce cas, fais pointer vers "/uploads/..." (et proxy côté Nginx).
export const ASSET = (p) => {
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  // Variante 1 (recommandée si tu proxifies /uploads vers le backend) :
  // return join('/uploads', p);

  // Variante 2 (si tes URLs en base sont déjà du type "/uploads/xyz.jpg") :
  return p.startsWith('/') ? p : '/' + p;
};

