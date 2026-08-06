'use strict';

const { bboxForRadius } = require('./utils');

const QUERY_VERSION = 'overpass-grouped-v2';

const IFILINO_OSM_CATEGORY_MAP = {
  restaurant: [{ key: 'amenity', values: ['restaurant'] }],
  cafe: [{ key: 'amenity', values: ['cafe'] }],
  snack: [{ key: 'amenity', values: ['fast_food', 'food_court'] }],
  fast_food: [{ key: 'amenity', values: ['fast_food'] }],
  glacier: [{ key: 'amenity', values: ['ice_cream'] }],
  pharmacie: [{ key: 'amenity', values: ['pharmacy'] }],
  boulangerie: [{ key: 'shop', values: ['bakery'] }],
  bakery: [{ key: 'shop', values: ['bakery'] }], // alias historique, campagnes creees avant le renommage en 'boulangerie'
  patisserie: [{ key: 'shop', values: ['pastry'] }],
  epicerie: [{ key: 'shop', values: ['convenience'] }],
  supermarche: [{ key: 'shop', values: ['supermarket'] }],
  boucherie: [{ key: 'shop', values: ['butcher'] }],
  primeur: [{ key: 'shop', values: ['greengrocer'] }],
};

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function bboxFromCells(cells) {
  return cells.reduce((acc, cell) => {
    const boundary = typeof cell.boundary === 'string' ? JSON.parse(cell.boundary) : cell.boundary;
    if (!acc) return { ...boundary };
    return {
      south: Math.min(acc.south, boundary.south),
      west: Math.min(acc.west, boundary.west),
      north: Math.max(acc.north, boundary.north),
      east: Math.max(acc.east, boundary.east),
    };
  }, null);
}

function bboxForCampaign(campaign) {
  const scope = typeof campaign.geographic_scope === 'string' ? JSON.parse(campaign.geographic_scope) : campaign.geographic_scope;
  if (!scope || scope.type !== 'radius') throw new Error('Seul geographicScope.type=radius est supporté');
  return bboxForRadius(scope.centerLat, scope.centerLng, scope.radiusKm);
}

function categoriesForQuery(categories = []) {
  const requested = unique(categories);
  const effective = requested.includes('restaurant') && !requested.includes('snack')
    ? [...requested, 'snack']
    : requested;
  return effective.filter(category => IFILINO_OSM_CATEGORY_MAP[category]);
}

function sourceCategoryFromTags(tags = {}) {
  if (tags.amenity) return `amenity:${tags.amenity}`;
  if (tags.shop) return `shop:${tags.shop}`;
  return null;
}

function normalizedCategoryFromTags(tags = {}, allowedCategories = []) {
  const categories = categoriesForQuery(allowedCategories);
  for (const category of categories) {
    for (const rule of IFILINO_OSM_CATEGORY_MAP[category]) {
      if (rule.values.includes(tags[rule.key])) return category;
    }
  }
  return null;
}

function classificationTags(tags = {}) {
  const out = {};
  if (tags.amenity) out.amenity = tags.amenity;
  if (tags.shop) out.shop = tags.shop;
  return out;
}

function buildGroupedQuery({ bbox, categories, timeoutSeconds = Number(process.env.OVERPASS_QUERY_TIMEOUT_SECONDS || 40) }) {
  const effective = categoriesForQuery(categories);
  const amenityValues = unique(effective.flatMap(category =>
    IFILINO_OSM_CATEGORY_MAP[category].filter(rule => rule.key === 'amenity').flatMap(rule => rule.values)
  ));
  const shopValues = unique(effective.flatMap(category =>
    IFILINO_OSM_CATEGORY_MAP[category].filter(rule => rule.key === 'shop').flatMap(rule => rule.values)
  ));
  const bounds = `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`;
  const clauses = [];
  if (amenityValues.length) clauses.push(`  nwr["amenity"~"^(${amenityValues.join('|')})$"]${bounds};`);
  for (const value of shopValues) clauses.push(`  nwr["shop"="${value}"]${bounds};`);

  return `[out:json][timeout:${timeoutSeconds}];

(
${clauses.join('\n')}
);

out center tags;`;
}

function fingerprint({ campaignId, sourceId, cellIds = [], categories = [], mode }) {
  const sortedCells = [...cellIds].map(String).sort().join(',');
  const sortedCategories = categoriesForQuery(categories).sort().join(',');
  return `${campaignId}:${sourceId}:${mode}:${sortedCells || 'campaign'}:${sortedCategories}:${QUERY_VERSION}`;
}

function initialPlan({ campaign, cells, sourceId }) {
  const categories = typeof campaign.categories === 'string' ? JSON.parse(campaign.categories) : campaign.categories;
  const cellIds = cells.map(cell => Number(cell.id));
  return {
    mode: 'CAMPAIGN_BBOX',
    sourceId,
    cellIds,
    categories: categoriesForQuery(categories),
    bbox: bboxForCampaign(campaign),
    queryVersion: QUERY_VERSION,
    fingerprint: fingerprint({ campaignId: campaign.id, sourceId, cellIds, categories, mode: 'CAMPAIGN_BBOX' }),
  };
}

function subdividePlan(plan, cells) {
  const selected = cells.filter(cell => plan.cellIds.includes(Number(cell.id)));
  if (selected.length <= 1) return [];
  const midpoint = Math.ceil(selected.length / 2);
  return [selected.slice(0, midpoint), selected.slice(midpoint)]
    .filter(group => group.length)
    .map(group => {
      const mode = group.length === 1 ? 'SINGLE_CELL' : 'CELL_BATCH';
      const cellIds = group.map(cell => Number(cell.id));
      return {
        mode,
        sourceId: plan.sourceId,
        cellIds,
        categories: plan.categories,
        bbox: bboxFromCells(group),
        queryVersion: QUERY_VERSION,
      };
    });
}

module.exports = {
  IFILINO_OSM_CATEGORY_MAP,
  QUERY_VERSION,
  bboxForCampaign,
  bboxFromCells,
  buildGroupedQuery,
  categoriesForQuery,
  classificationTags,
  fingerprint,
  initialPlan,
  normalizedCategoryFromTags,
  sourceCategoryFromTags,
  subdividePlan,
};
