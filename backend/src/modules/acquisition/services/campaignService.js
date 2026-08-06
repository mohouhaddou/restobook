'use strict';

const { audit, exec, json, one, parseJsonFields, query, sequelize } = require('./repository');
const { generateGridCells } = require('./utils');
const { getEnabledSource, seedOpenStreetMapSource } = require('./sourceRegistry');
const { createInitialDiscoveryTasks } = require('./acquisitionTaskPlanner');

const DEFAULT_LIMITS = {
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
};

const DEFAULT_CONCURRENCY = {
  maxConcurrentCells: 2,
  maxConcurrentSources: 1,
  maxConcurrentTasks: 3,
};

const DEFAULT_REVIEW_POLICY = {
  humanReviewRequired: true,
};

function normalizeCampaignPayload(input) {
  return {
    name: input.name,
    description: input.description || null,
    countryCode: input.countryCode || input.country_code,
    region: input.region || null,
    province: input.province || null,
    city: input.city || null,
    district: input.district || null,
    geographicScope: input.geographicScope || input.geographic_scope,
    entityTypes: input.entityTypes || input.entity_types || ['business'],
    categories: input.categories || [],
    sourceIds: input.sourceIds || input.source_ids || [],
    limits: { ...DEFAULT_LIMITS, ...(input.limits || {}) },
    concurrency: { ...DEFAULT_CONCURRENCY, ...(input.concurrency || {}) },
    reviewPolicy: { ...DEFAULT_REVIEW_POLICY, ...(input.reviewPolicy || input.review_policy || {}) },
    schedule: input.schedule || null,
  };
}

function validateCampaign(payload) {
  if (!payload.name) throw new Error('name requis');
  if (!payload.countryCode) throw new Error('countryCode requis');
  if (!payload.city && !payload.district) throw new Error('Une campagne nationale est interdite : city ou district requis');
  if (!payload.geographicScope) throw new Error('geographicScope requis');
  if (payload.geographicScope.type !== 'radius') throw new Error('Seul le scope radius est activé pour le pilote');
  if (!payload.geographicScope.centerLat || !payload.geographicScope.centerLng || !payload.geographicScope.radiusKm) {
    throw new Error('centerLat, centerLng et radiusKm requis');
  }
  if (payload.geographicScope.radiusKm > 5) throw new Error('Le rayon pilote ne peut pas dépasser 5 km');
  if (!payload.entityTypes.includes('business')) throw new Error('Phase 1/2 limitée aux commerces locaux');
  if (payload.categories.length < 1) throw new Error('Au moins une catégorie est requise');
  if (payload.categories.length > 3) throw new Error('Le pilote limite les catégories à 3');
  if (payload.sourceIds.length < 1) throw new Error('Au moins une source est requise');
  if (payload.sourceIds.length > payload.limits.maxSources) throw new Error('STOP_MAX_SOURCES');
  if (payload.concurrency.maxConcurrentCells > 2) throw new Error('MAX_CONCURRENT_CELLS pilote = 2');
  if (payload.reviewPolicy.humanReviewRequired !== true) throw new Error('humanReviewRequired doit rester true en Phase 1/2');
}

async function ensureSourcesAllowed(sourceIds) {
  await seedOpenStreetMapSource();
  for (const sourceId of sourceIds) {
    const source = await getEnabledSource(sourceId);
    if (!source) throw new Error(`STOP_SOURCE_DISABLED: ${sourceId}`);
    if (!source.usage_policy.discoveryAllowed || !source.usage_policy.storageAllowed) {
      throw new Error(`STOP_LICENSE_INVALID: ${sourceId}`);
    }
  }
}

async function estimateCampaign(input) {
  const payload = normalizeCampaignPayload(input);
  validateCampaign(payload);
  await ensureSourcesAllowed(payload.sourceIds);
  const cells = generateGridCells(payload.geographicScope, payload.limits.maxCells);
  return {
    scope: payload.geographicScope,
    cells: cells.length,
    maxRequests: Math.min(payload.limits.maxRequests, payload.sourceIds.length),
    worstCaseAdaptiveRequests: Math.min(payload.limits.maxRequests, cells.length * payload.sourceIds.length),
    previousCellCategoryRequests: cells.length * payload.categories.length * payload.sourceIds.length,
    maxCandidates: payload.limits.maxEntitiesDiscovered,
    categories: payload.categories,
    sourceIds: payload.sourceIds,
    humanReviewRequired: true,
  };
}

async function findActiveCampaignNearby(payload) {
  if (!payload.city) return null;
  const candidates = await query(
    "SELECT id, status, city, geographic_scope FROM acquisition_campaigns WHERE status IN ('ready','running','paused') AND LOWER(city)=LOWER(:city)",
    { city: payload.city }
  );
  const centerLat = payload.geographicScope.centerLat;
  const centerLng = payload.geographicScope.centerLng;
  for (const row of candidates) {
    const scope = typeof row.geographic_scope === 'string' ? JSON.parse(row.geographic_scope) : row.geographic_scope;
    if (Math.abs(Number(scope.centerLat) - centerLat) < 0.01 && Math.abs(Number(scope.centerLng) - centerLng) < 0.01) {
      return row;
    }
  }
  return null;
}

async function createCampaign(input, { userId = null, ipAddress = null } = {}) {
  const payload = normalizeCampaignPayload(input);
  validateCampaign(payload);
  const existing = await findActiveCampaignNearby(payload);
  if (existing) {
    throw httpError(`Une campagne active existe déjà pour cette zone (#${existing.id}, statut ${existing.status}) — relancez-la plutôt que d'en créer une nouvelle.`, 409);
  }
  await ensureSourcesAllowed(payload.sourceIds);
  const cells = generateGridCells(payload.geographicScope, payload.limits.maxCells);

  const tx = await sequelize.transaction();
  try {
    await sequelize.query(
      `INSERT INTO acquisition_campaigns
       (name, description, country_code, region, province, city, district, geographic_scope, entity_types,
        categories, source_ids, limits, concurrency, review_policy, schedule, status, created_by)
       VALUES
       (:name, :description, :countryCode, :region, :province, :city, :district, CAST(:geographicScope AS JSON),
        CAST(:entityTypes AS JSON), CAST(:categories AS JSON), CAST(:sourceIds AS JSON), CAST(:limits AS JSON),
        CAST(:concurrency AS JSON), CAST(:reviewPolicy AS JSON), CAST(:schedule AS JSON), 'ready', :createdBy)`,
      {
        replacements: {
          name: payload.name,
          description: payload.description,
          countryCode: payload.countryCode,
          region: payload.region,
          province: payload.province,
          city: payload.city,
          district: payload.district,
          geographicScope: json(payload.geographicScope),
          entityTypes: json(payload.entityTypes),
          categories: json(payload.categories),
          sourceIds: json(payload.sourceIds),
          limits: json(payload.limits),
          concurrency: json(payload.concurrency),
          reviewPolicy: json(payload.reviewPolicy),
          schedule: json(payload.schedule),
          createdBy: userId,
        },
        transaction: tx,
      }
    );
    const [campaignIdRows] = await sequelize.query('SELECT LAST_INSERT_ID() AS id', { transaction: tx });
    const campaignId = campaignIdRows[0].id;

    const persistedCells = [];
    for (const cell of cells) {
      await sequelize.query(
        `INSERT INTO geographic_cells
         (cell_reference, \`system\`, boundary, center_lat, center_lng, area_km2, country_code, region, province, city, district, acquisition_status)
         VALUES
         (:ref, :system, CAST(:boundary AS JSON), :lat, :lng, :areaKm2, :countryCode, :region, :province, :city, :district, 'queued')
         ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), acquisition_status='queued', updated_at=NOW()`,
        {
          replacements: {
            ref: cell.cellReference,
            system: cell.system,
            boundary: json(cell.boundary),
            lat: cell.centerLat,
            lng: cell.centerLng,
            areaKm2: cell.areaKm2,
            countryCode: payload.countryCode,
            region: payload.region,
            province: payload.province,
            city: payload.city,
            district: payload.district,
          },
          transaction: tx,
        }
      );
      const [cellIdRows] = await sequelize.query('SELECT LAST_INSERT_ID() AS id', { transaction: tx });
      const cellId = cellIdRows[0].id;
      persistedCells.push({ id: Number(cellId), boundary: cell.boundary });
      await sequelize.query(
        `INSERT IGNORE INTO campaign_cells (campaign_id, cell_id, status) VALUES (:campaignId, :cellId, 'queued')`,
        { replacements: { campaignId, cellId }, transaction: tx }
      );
    }

    await createInitialDiscoveryTasks({ sequelize, transaction: tx, campaignId, payload, persistedCells });

    await tx.commit();
    await audit({ userId, campaignId, action: 'CAMPAIGN_CREATED', newValue: payload, ipAddress });
    return getCampaign(campaignId);
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

async function getCampaign(id) {
  const row = await one('SELECT * FROM acquisition_campaigns WHERE id=:id', { id });
  return parseJsonFields(row, ['geographic_scope', 'entity_types', 'categories', 'source_ids', 'limits', 'concurrency', 'review_policy', 'schedule']);
}

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function listCampaigns() {
  const rows = await query('SELECT * FROM acquisition_campaigns ORDER BY created_at DESC LIMIT 100');
  return rows.map(row => parseJsonFields(row, ['geographic_scope', 'entity_types', 'categories', 'source_ids', 'limits', 'concurrency', 'review_policy', 'schedule']));
}

async function startCampaign(id, { userId = null, ipAddress = null } = {}) {
  const campaign = await getCampaign(id);
  if (!campaign) throw httpError('Campagne introuvable', 404);
  if (!['ready', 'paused', 'draft', 'stopped'].includes(campaign.status)) throw httpError(`Statut non démarrable: ${campaign.status}`, 409);
  if (campaign.status === 'stopped') {
    // Un stop manuel annule les tâches en cours (voir stopCampaign) ; un arrêt
    // budgétaire (budgetGuard) les laisse 'queued' — dans les deux cas, la
    // relance doit leur redonner une chance d'être traitées.
    await exec("UPDATE acquisition_tasks SET status='queued', stop_reason=NULL WHERE campaign_id=:id AND status='cancelled'", { id });
  }
  await exec("UPDATE acquisition_campaigns SET status='running', started_at=COALESCE(started_at, NOW()), completed_at=NULL, stop_reason=NULL WHERE id=:id", { id });
  await audit({ userId, campaignId: id, action: 'CAMPAIGN_STARTED', ipAddress });
  return getCampaign(id);
}

async function stopCampaign(id, reason = 'STOP_MANUAL', { userId = null, ipAddress = null } = {}) {
  await exec("UPDATE acquisition_campaigns SET status='stopped', stop_reason=:reason, completed_at=NOW() WHERE id=:id", { id, reason });
  await exec("UPDATE acquisition_tasks SET status='cancelled', stop_reason=:reason WHERE campaign_id=:id AND status IN ('queued','running')", { id, reason });
  await audit({ userId, campaignId: id, action: 'CAMPAIGN_STOPPED', reason, ipAddress });
  return getCampaign(id);
}

async function pauseCampaign(id, reason = 'PAUSE_MANUAL', { userId = null, ipAddress = null } = {}) {
  const campaign = await getCampaign(id);
  if (!campaign) throw httpError('Campagne introuvable', 404);
  if (campaign.status !== 'running') throw httpError('Statut non pausable: ' + campaign.status, 409);
  await exec("UPDATE acquisition_campaigns SET status='paused', stop_reason=:reason WHERE id=:id", { id, reason });
  await exec("UPDATE acquisition_tasks SET status='queued', stop_reason=:reason WHERE campaign_id=:id AND status='running'", { id, reason });
  await audit({ userId, campaignId: id, action: 'CAMPAIGN_PAUSED', reason, ipAddress });
  return getCampaign(id);
}

async function resumeCampaign(id, { userId = null, ipAddress = null } = {}) {
  const campaign = await getCampaign(id);
  if (!campaign) throw httpError('Campagne introuvable', 404);
  if (campaign.status !== 'paused') throw httpError('Statut non reprenable: ' + campaign.status, 409);
  await exec("UPDATE acquisition_campaigns SET status='running', stop_reason=NULL WHERE id=:id", { id });
  await audit({ userId, campaignId: id, action: 'CAMPAIGN_RESUMED', ipAddress });
  return getCampaign(id);
}

async function completeIfDone(id) {
  const remaining = await one(
    "SELECT COUNT(*) AS count FROM acquisition_tasks WHERE campaign_id=:id AND status IN ('queued','running')",
    { id }
  );
  if (Number(remaining.count) === 0) {
    await exec("UPDATE acquisition_campaigns SET status='completed', completed_at=NOW() WHERE id=:id AND status='running'", { id });
  }
}

async function getCampaignCells(id) {
  return query(
    `SELECT gc.*, cc.status AS campaign_cell_status
     FROM campaign_cells cc
     JOIN geographic_cells gc ON gc.id=cc.cell_id
     WHERE cc.campaign_id=:id
     ORDER BY gc.id ASC`,
    { id }
  );
}

async function getCampaignTasks(id) {
  return query('SELECT * FROM acquisition_tasks WHERE campaign_id=:id ORDER BY id ASC', { id });
}

async function getCampaignCandidates(id) {
  return query('SELECT * FROM discovery_candidates WHERE campaign_id=:id ORDER BY id ASC', { id });
}

async function getMetrics(id) {
  const statusRows = await query(
    `SELECT status, COUNT(*) AS count FROM discovery_candidates WHERE campaign_id=:id GROUP BY status`,
    { id }
  );
  const taskRows = await query(
    `SELECT status, COUNT(*) AS count FROM acquisition_tasks WHERE campaign_id=:id GROUP BY status`,
    { id }
  );
  const requestRows = await query(
    `SELECT source_id, COUNT(*) AS requests
     FROM acquisition_audit_logs
     WHERE campaign_id=:id AND action='SOURCE_REQUESTED'
     GROUP BY source_id`,
    { id }
  );
  return { candidates: statusRows, tasks: taskRows, requestsBySource: requestRows };
}

async function deleteCampaign(id, { userId = null, ipAddress = null } = {}) {
  const campaign = await getCampaign(id);
  if (!campaign) throw httpError('Campagne introuvable', 404);
  const tx = await sequelize.transaction();
  try {
    // Pas de cascade en base (FK NO ACTION) : suppression manuelle dans l'ordre.
    // discovery_candidates n'est référencé par aucune autre table — une fiche
    // publiée a déjà été copiée dans Organization/Business indépendamment,
    // donc supprimer la campagne ne touche jamais une fiche marketplace en ligne.
    await sequelize.query('DELETE FROM acquisition_tasks WHERE campaign_id=:id', { replacements: { id }, transaction: tx });
    await sequelize.query('DELETE FROM campaign_cells WHERE campaign_id=:id', { replacements: { id }, transaction: tx });
    await sequelize.query('DELETE FROM discovery_candidates WHERE campaign_id=:id', { replacements: { id }, transaction: tx });
    await sequelize.query('DELETE FROM acquisition_campaigns WHERE id=:id', { replacements: { id }, transaction: tx });
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
  await audit({ userId, campaignId: id, action: 'CAMPAIGN_DELETED', ipAddress });
}

module.exports = {
  completeIfDone,
  createCampaign,
  deleteCampaign,
  estimateCampaign,
  getCampaign,
  getCampaignCandidates,
  getCampaignCells,
  getCampaignTasks,
  getMetrics,
  listCampaigns,
  pauseCampaign,
  resumeCampaign,
  startCampaign,
  stopCampaign,
};
