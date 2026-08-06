'use strict';

/**
 * Connecteur Open Food Facts / Open Beauty Facts — sources ouvertes
 * autorisées (mission §6 : "Open Food Facts pour les produits alimentaires",
 * "bases ouvertes équivalentes pour les produits cosmétiques"). Open Beauty
 * Facts est le projet sœur d'Open Food Facts (même association, même API,
 * même licence ODbL) — nécessaire car OFF ne couvre quasiment jamais les
 * produits d'hygiène/cosmétiques (vérifié : "Dove savon" → 0 résultat sur
 * OFF, 13 sur Open Beauty Facts).
 *
 * Données sous licence ODbL, imagerie fournie par les contributeurs
 * (généralement CC-BY-SA, variable par photo — voir la fiche produit pour
 * l'attribution exacte). On référence directement l'URL d'image hébergée
 * par l'un ou l'autre projet (pas de réhébergement local) : plus simple,
 * pas d'ambiguïté de droits de republication.
 *
 * Aucun scraping : uniquement l'API publique documentée. Les deux projets
 * limitent le débit des utilisateurs anonymes (503 "Page temporarily
 * unavailable" observé en pratique sur des requêtes en rafale) — voir
 * getJson() pour le retry+backoff, et REQUEST_DELAY_MS côté appelant.
 */

const BASES = {
  food: 'https://world.openfoodfacts.org',
  beauty: 'https://world.openbeautyfacts.org',
};
const USER_AGENT = 'iFilino-CatalogEnrichment/1.0 (+https://ifilino.com)';

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * GET avec retry+backoff. Distingue :
 *   - échec réseau/HTTP persistant après retries → lève une exception
 *     (l'appelant ne doit alors PAS enregistrer de statut "not_found" et
 *     laisser une future exécution retenter) ;
 *   - réponse 200 avec zéro résultat → cas légitime, retourné normalement.
 */
async function getJson(url, { retries = 3, baseDelayMs = 800 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      // `await` ici (pas `return res.json()`) : un corps non-JSON (page HTML de
      // limitation servie avec statut 200) doit être capté par le catch et
      // déclencher un retry, pas rejeter getJson() en court-circuitant la boucle.
      if (res.ok) return await res.json();
      if (res.status === 404) return null; // ressource absente = résultat légitime
      lastErr = new Error(`HTTP ${res.status} sur ${url}`);
    } catch (e) {
      lastErr = e;
    }
    if (attempt < retries) await sleep(baseDelayMs * 2 ** attempt);
  }
  throw lastErr;
}

/**
 * Nettoie les termes de recherche : retire la quantité/unité finale (souvent
 * nuisible à la recherche simple de ces deux projets, ex: "1.5L", "400g",
 * "75ml") et déduplique les mots (la marque apparaît souvent déjà dans le nom
 * du produit saisi par le commerçant).
 */
function buildSearchTerms(name, brand) {
  const cleanedName = String(name || '').replace(/\d+([.,]\d+)?\s*(l|ml|cl|kg|g)\b/gi, '').trim();
  const words = `${brand || ''} ${cleanedName}`.toLowerCase().split(/\s+/).filter(Boolean);
  const seen = new Set();
  const dedup = [];
  for (const w of words) { if (!seen.has(w)) { seen.add(w); dedup.push(w); } }
  return dedup.join(' ');
}

/**
 * Recherche par mots-clés. `database`: 'food' (défaut) ou 'beauty'.
 * Retourne jusqu'à `limit` candidats bruts (code, product_name, brands,
 * image_front_url, image_url, countries_tags). Lève une exception après
 * épuisement des retries — ne retourne jamais silencieusement [] sur erreur.
 */
async function searchProduct({ name, brand, database = 'food', limit = 5 }) {
  const base = BASES[database] || BASES.food;
  const params = new URLSearchParams({
    search_terms: buildSearchTerms(name, brand),
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(limit),
    fields: 'code,product_name,brands,image_front_url,image_url,countries_tags',
  });
  const data = await getJson(`${base}/cgi/search.pl?${params}`);
  return data?.products || [];
}

/** Lookup exact par code-barres (fallback possible pour /catalog/products/barcode/:code). */
async function getByBarcode(barcode, database = 'food') {
  const base = BASES[database] || BASES.food;
  const data = await getJson(`${base}/api/v2/product/${encodeURIComponent(barcode)}.json`);
  return data?.status === 1 ? data.product : null;
}

function productUrl(code, database = 'food') {
  return `${BASES[database] || BASES.food}/product/${code}`;
}

const LICENSE_NOTE = 'Open Food Facts / Open Beauty Facts — données sous licence ODbL, image fournie par les contributeurs (voir la fiche produit pour l\'attribution exacte)';

module.exports = { searchProduct, getByBarcode, buildSearchTerms, productUrl, LICENSE_NOTE, BASES };
