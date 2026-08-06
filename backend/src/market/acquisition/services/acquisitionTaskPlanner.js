'use strict';

const { json } = require('./repository');
const { fingerprint, initialPlan } = require('./overpassQueryPlanner');

async function createInitialDiscoveryTasks({ sequelize, transaction, campaignId, payload, persistedCells }) {
  for (const sourceId of payload.sourceIds) {
    const plan = initialPlan({
      campaign: { id: campaignId, categories: payload.categories, geographic_scope: payload.geographicScope },
      cells: persistedCells,
      sourceId,
    });
    const batchFingerprint = fingerprint({
      campaignId,
      sourceId,
      cellIds: plan.cellIds,
      categories: plan.categories,
      mode: plan.mode,
    });
    await sequelize.query(
      `INSERT IGNORE INTO acquisition_tasks
       (campaign_id, cell_id, source_id, depth, task_type, unique_fingerprint, payload, max_attempts, priority, status)
       VALUES (:campaignId, NULL, :sourceId, 0, 'osm_discovery_batch', :fingerprint, CAST(:taskPayload AS JSON), :maxAttempts, 10, 'queued')`,
      {
        replacements: {
          campaignId,
          sourceId,
          fingerprint: batchFingerprint,
          taskPayload: json(plan),
          maxAttempts: payload.limits.maxRetriesPerTask,
        },
        transaction,
      }
    );
  }
}

module.exports = { createInitialDiscoveryTasks };
