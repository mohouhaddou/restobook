'use strict';

const OVERPASS_URL = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const OVERPASS_TIMEOUT_MS = Number(process.env.OVERPASS_TIMEOUT_MS || 20000);

function tagFilters(key, value) {
  return [`node["${key}"="${value}"]`, `way["${key}"="${value}"]`, `relation["${key}"="${value}"]`];
}

const CATEGORY_FILTERS = {
  restaurant: tagFilters('amenity', 'restaurant'),
  cafe: tagFilters('amenity', 'cafe'),
  fast_food: tagFilters('amenity', 'fast_food'),
  glacier: tagFilters('amenity', 'ice_cream'),
  pharmacie: tagFilters('amenity', 'pharmacy'),
  boulangerie: tagFilters('shop', 'bakery'),
  patisserie: tagFilters('shop', 'pastry'),
  epicerie: tagFilters('shop', 'convenience'),
  supermarche: tagFilters('shop', 'supermarket'),
  boucherie: tagFilters('shop', 'butcher'),
  primeur: tagFilters('shop', 'greengrocer'),
};
// Alias conserve pour les campagnes existantes creees avant le renommage
// 'bakery' -> 'boulangerie' (alignement sur la taxonomie business_type du
// marketplace, voir PUBLIC_BIZ_TYPES dans marketplace/routes.js).
CATEGORY_FILTERS.bakery = CATEGORY_FILTERS.boulangerie;

function buildQuery({ bbox, category }) {
  const filters = CATEGORY_FILTERS[category] || [];
  if (!filters.length) throw new Error(`Catégorie OSM non supportée: ${category}`);
  const bounds = `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`;
  return `[out:json][timeout:25];
(
  ${filters.map(filter => `${filter}${bounds};`).join('\n  ')}
);
out center tags;`;
}

function addressFromTags(tags = {}) {
  return [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:neighbourhood'],
    tags['addr:city'],
  ].filter(Boolean).join(' ');
}

function websiteFromTags(tags = {}) {
  return tags.website || tags['contact:website'] || null;
}

function phoneFromTags(tags = {}) {
  return tags.phone || tags['contact:phone'] || null;
}

function sourceUrlFor(element) {
  return `https://www.openstreetmap.org/${element.type}/${element.id}`;
}

async function discover({ bbox, category }) {
  const query = buildQuery({ bbox, category });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'user-agent': 'iFilino-Knowledge-Acquisition-Engine/0.1 contact:admin@ifilino.local',
    },
    body: new URLSearchParams({ data: query }),
      signal: controller.signal,
    });
  } catch (error) {
    const wrapped = new Error(error.name === 'AbortError' ? 'Overpass timeout' : error.message);
    wrapped.code = error.name === 'AbortError' ? 'OSM_OVERPASS_TIMEOUT' : 'OSM_OVERPASS_ERROR';
    throw wrapped;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(`Overpass HTTP ${response.status}`);
    error.code = 'OSM_OVERPASS_ERROR';
    error.details = body.slice(0, 500);
    throw error;
  }

  const payload = await response.json();
  return (payload.elements || [])
    .map(element => {
      const tags = element.tags || {};
      const lat = element.lat ?? element.center?.lat;
      const lng = element.lon ?? element.center?.lon;
      if (!tags.name || lat == null || lng == null) return null;
      return {
        externalId: `${element.type}/${element.id}`,
        rawName: tags.name,
        rawAddress: addressFromTags(tags) || null,
        latitude: Number(lat),
        longitude: Number(lng),
        probableCategory: category,
        phone: phoneFromTags(tags),
        website: websiteFromTags(tags),
        sourceUrl: sourceUrlFor(element),
      };
    })
    .filter(Boolean);
}

module.exports = { discover };
