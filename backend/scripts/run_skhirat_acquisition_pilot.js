#!/usr/bin/env node
'use strict';

/**
 * Lance une campagne pilote limitée à Skhirat centre, sans enrichissement IA.
 *
 * Par défaut le script exécute 3 tâches OSM au maximum pour rester prudent.
 * Variables utiles :
 *   PILOT_MAX_TASKS=6
 *   PILOT_CREATE_ONLY=1
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const sequelize = require('../models/db');
const campaignService = require('../src/market/acquisition/services/campaignService');
const { runCampaign } = require('../src/market/acquisition/services/discoveryEngine');
const { seedOpenStreetMapSource } = require('../src/market/acquisition/services/sourceRegistry');
const { generateGridCells } = require('../src/market/acquisition/services/utils');
const { buildGroupedQuery, initialPlan } = require('../src/market/acquisition/services/overpassQueryPlanner');
const { executePlan } = require('../src/market/acquisition/services/osmBatchConnector');
const endpointManager = require('../src/market/acquisition/services/overpassEndpointManager');

const pilot = {
  name: 'Pilote commerces Skhirat centre',
  countryCode: 'MA',
  region: 'Rabat-Salé-Kénitra',
  province: 'Skhirat-Témara',
  city: 'Skhirat',
  geographicScope: {
    type: 'radius',
    centerLat: 33.849,
    centerLng: -7.031,
    radiusKm: 3,
  },
  entityTypes: ['business'],
  categories: ['restaurant', 'cafe', 'bakery'],
  sourceIds: ['openstreetmap'],
  limits: {
    maxCells: 20,
    maxSources: 2,
    maxRequests: 300,
    maxRequestsPerSource: 250,
    maxPagesPerSource: 20,
    maxPagesPerDomain: 5,
    maxEntitiesDiscovered: 150,
    maxEntitiesEnriched: 60,
    maxEntitiesPublished: 30,
    maxRuntimeMinutes: 60,
    maxAiTokens: 0,
    maxAiCostAmount: 0,
    maxStorageMb: 200,
    maxRetriesPerTask: 2,
    maxTaskDepth: 2,
  },
  concurrency: {
    maxConcurrentCells: Number(process.env.MAX_CONCURRENT_CELLS || 1),
    maxConcurrentSources: 1,
    maxConcurrentTasks: Number(process.env.MAX_CONCURRENT_TASKS || 1),
  },
  reviewPolicy: {
    humanReviewRequired: true,
  },
};

async function runDryQuery() {
  const debugDir = path.join(__dirname, '..', 'storage', 'acquisition', 'debug');
  fs.mkdirSync(debugDir, { recursive: true });
  const cells = generateGridCells(pilot.geographicScope, pilot.limits.maxCells).map((cell, index) => ({ ...cell, id: index + 1 }));
  const plan = initialPlan({ campaign: { id: 'dry-skhirat', categories: pilot.categories, geographic_scope: pilot.geographicScope }, cells, sourceId: 'openstreetmap' });
  const query = buildGroupedQuery({ bbox: plan.bbox, categories: plan.categories });
  fs.writeFileSync(path.join(debugDir, 'skhirat-query.overpassql'), query);
  console.log('Dry query bbox:', plan.bbox);
  console.log('Dry query categories:', plan.categories);
  console.log('Dry query endpoint:', endpointManager.selectEndpoint().url);
  try {
    const response = await executePlan(plan);
    fs.writeFileSync(path.join(debugDir, 'skhirat-response.json'), JSON.stringify(response.rawPayload, null, 2));
    fs.writeFileSync(path.join(debugDir, 'skhirat-response-meta.json'), JSON.stringify({ ...response.meta, rawCount: response.rawCount, parsedCount: response.elements.length, endpointStats: endpointManager.getEndpointStats() }, null, 2));
    console.log('Dry query OK: ' + response.rawCount + ' éléments bruts, ' + response.elements.length + ' éléments parsés');
  } catch (error) {
    fs.writeFileSync(path.join(debugDir, 'skhirat-error.json'), JSON.stringify({ message: error.message, code: error.code || null, status: error.status || null, endpointStats: endpointManager.getEndpointStats() }, null, 2));
    throw error;
  }
}

async function run() {
  if (process.argv.includes('--dry-query')) {
    await runDryQuery();
    return;
  }

  await sequelize.authenticate();
  await seedOpenStreetMapSource();

  const estimate = await campaignService.estimateCampaign(pilot);
  console.log('Estimation pilote Skhirat:', estimate);

  const campaign = await campaignService.createCampaign(pilot, { userId: null });
  console.log(`Campagne créée: #${campaign.id} (${campaign.status})`);

  if (process.env.PILOT_CREATE_ONLY === '1') {
    await sequelize.close();
    return;
  }

  await campaignService.startCampaign(campaign.id);
  const maxTasks = Number(process.env.PILOT_MAX_TASKS || 4);
  const summary = await runCampaign(campaign.id, { maxTasks });
  const metrics = await campaignService.getMetrics(campaign.id);
  const candidates = await campaignService.getCampaignCandidates(campaign.id);

  console.log('Résumé discovery:', summary);
  console.log('Métriques:', metrics);
  console.log(`Candidats collectés: ${candidates.length}`);
  for (const candidate of candidates.slice(0, 10)) {
    console.log(`- [${candidate.status}] ${candidate.raw_name} (${candidate.probable_category || 'n/a'}) ${candidate.source_url || ''}`);
  }

  await sequelize.close();
}

run().catch(async (error) => {
  console.error('Pilote Skhirat échoué:', error.stack || error.message);
  try { await sequelize.close(); } catch {}
  process.exit(1);
});
