#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  buildGroupedQuery,
  categoriesForQuery,
  normalizedCategoryFromTags,
  subdividePlan,
} = require('../src/market/acquisition/services/overpassQueryPlanner');
const { parseElements } = require('../src/market/acquisition/services/osmBatchConnector');
const endpointManager = require('../src/market/acquisition/services/overpassEndpointManager');
const { findCellForPoint, isInsideRadius } = require('../src/market/acquisition/services/utils');

function run() {
  const bbox = { south: 33.82, west: -7.06, north: 33.87, east: -7.00 };
  const query = buildGroupedQuery({ bbox, categories: ['restaurant', 'cafe', 'bakery'] });
  assert(query.includes('nwr["amenity"~"^(restaurant|cafe|fast_food|food_court)$"]'));
  assert(query.includes('nwr["shop"="bakery"]'));
  assert.strictEqual(categoriesForQuery(['restaurant', 'cafe', 'bakery']).includes('snack'), true);

  const elements = parseElements({
    elements: [
      { type: 'node', id: 1, lat: 33.849, lon: -7.031, tags: { name: 'Cafe A', amenity: 'cafe' } },
      { type: 'way', id: 2, center: { lat: 33.85, lon: -7.032 }, tags: { name: 'Snack B', amenity: 'fast_food', phone: '+212600000000' } },
      { type: 'relation', id: 3, center: { lat: 33.851, lon: -7.033 }, tags: { name: 'Bakery C', shop: 'bakery' } },
      { type: 'node', id: 4, lat: 33.851, lon: -7.033, tags: { amenity: 'restaurant' } },
      { type: 'way', id: 5, tags: { name: 'No Center', amenity: 'restaurant' } },
    ],
  }, ['restaurant', 'cafe', 'bakery']);
  assert.strictEqual(elements[0].osmType, 'node');
  assert.strictEqual(elements[1].osmType, 'way');
  assert.strictEqual(elements[2].osmType, 'relation');
  assert.strictEqual(elements[0].completenessStatus, 'incomplete');
  assert.strictEqual(elements[3].rejectReason, 'MISSING_NAME');
  assert.strictEqual(elements[4].rejectReason, 'MISSING_COORDINATES');
  assert.strictEqual(normalizedCategoryFromTags({ amenity: 'food_court' }, ['restaurant']), 'snack');

  assert.deepStrictEqual(parseElements({ elements: [] }, ['restaurant']), []);
  assert.strictEqual(isInsideRadius({ type: 'radius', centerLat: 33.849, centerLng: -7.031, radiusKm: 3 }, 33.849, -7.031), true);
  assert.strictEqual(isInsideRadius({ type: 'radius', centerLat: 33.849, centerLng: -7.031, radiusKm: 3 }, 34.1, -7.3), false);
  assert.strictEqual(findCellForPoint([{ id: 1, boundary: bbox }], 33.849, -7.031).id, 1);

  const childPlans = subdividePlan({ cellIds: [1, 2, 3, 4], categories: ['restaurant'], sourceId: 'openstreetmap' }, [
    { id: 1, boundary: bbox },
    { id: 2, boundary: bbox },
    { id: 3, boundary: bbox },
    { id: 4, boundary: bbox },
  ]);
  assert.strictEqual(childPlans.length, 2);
  assert.strictEqual(childPlans[0].mode, 'CELL_BATCH');

  endpointManager.resetEndpointStats();
  const selected = endpointManager.selectEndpoint();
  endpointManager.recordError(selected.url, 'HTTP_504', 100);
  endpointManager.recordError(selected.url, 'HTTP_504', 100);
  endpointManager.recordError(selected.url, 'HTTP_504', 100);
  assert.strictEqual(endpointManager.getEndpointStats()[0].state, 'COOLDOWN');

  const loadedModules = Object.keys(require.cache).join('\n');
  assert(!loadedModules.includes('/openai'));
  assert(!loadedModules.includes('AIService'));
  assert(!loadedModules.includes('Business.create'));
}

run();
console.log('acquisition_overpass tests ok');
