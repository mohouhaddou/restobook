// Client léger pour le catalogue produit partagé (/api/catalog, /api/merchant/products).
// Suit le pattern authFetch déjà dupliqué dans chaque dashboard (HanoutDashboard,
// PharmacyDashboard) — pas d'authFetch partagé existant dans ce repo, on garde
// la même convention ici plutôt que d'en introduire une nouvelle.
import { API } from './api';

function authFetch(path, opts = {}) {
  const token = localStorage.getItem('rb_token');
  return fetch(API(path), {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
  });
}

async function asJson(res) {
  let json = null;
  try { json = await res.json(); } catch { /* pas de body JSON */ }
  if (!res.ok) {
    const err = new Error(json?.error || 'Erreur catalogue');
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

export function searchCatalog(q, { categoryId, brandId } = {}) {
  const qs = new URLSearchParams({ q });
  if (categoryId) qs.set('category_id', categoryId);
  if (brandId) qs.set('brand_id', brandId);
  return authFetch(`/catalog/products/search?${qs}`).then(asJson);
}

export function suggestCatalog(q) {
  const qs = new URLSearchParams({ q });
  return authFetch(`/catalog/products/suggest?${qs}`).then(asJson);
}

export function getCatalogProductByBarcode(barcode) {
  return authFetch(`/catalog/products/barcode/${encodeURIComponent(barcode)}`).then(asJson);
}

export function getCatalogProduct(id) {
  return authFetch(`/catalog/products/${id}`).then(asJson);
}

export function listCatalogCategories() {
  return authFetch('/catalog/categories').then(asJson);
}

export function createCatalogProduct(payload) {
  return authFetch('/catalog/products', { method: 'POST', body: payload }).then(asJson);
}

export function uploadCatalogImage(file) {
  const fd = new FormData();
  fd.append('image', file);
  const token = localStorage.getItem('rb_token');
  return fetch(API('/catalog/products/upload'), { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
    .then(asJson)
    .then(d => d.url);
}

export function createFromCatalog(payload) {
  return authFetch('/merchant/products/from-catalog', { method: 'POST', body: payload }).then(asJson);
}
