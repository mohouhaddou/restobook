'use strict';

const { exec, one } = require('./repository');

async function getCounts(campaignId, sourceId = null) {
  const totalRequests = await one(
    "SELECT COUNT(*) AS count FROM acquisition_audit_logs WHERE campaign_id=:campaignId AND action='SOURCE_REQUESTED'",
    { campaignId }
  );
  const sourceRequests = sourceId ? await one(
    "SELECT COUNT(*) AS count FROM acquisition_audit_logs WHERE campaign_id=:campaignId AND source_id=:sourceId AND action='SOURCE_REQUESTED'",
    { campaignId, sourceId }
  ) : { count: 0 };
  const discovered = await one(
    'SELECT COUNT(*) AS count FROM discovery_candidates WHERE campaign_id=:campaignId',
    { campaignId }
  );
  const enriched = await one(
    "SELECT COUNT(*) AS count FROM discovery_candidates WHERE campaign_id=:campaignId AND status='enriched'",
    { campaignId }
  );
  const cells = await one(
    "SELECT COUNT(DISTINCT cell_id) AS count FROM acquisition_tasks WHERE campaign_id=:campaignId AND status='completed'",
    { campaignId }
  );
  const runtime = await one(
    'SELECT TIMESTAMPDIFF(MINUTE, COALESCE(started_at, created_at), NOW()) AS minutes FROM acquisition_campaigns WHERE id=:campaignId',
    { campaignId }
  );
  return {
    totalRequests: Number(totalRequests.count),
    sourceRequests: Number(sourceRequests.count),
    discovered: Number(discovered.count),
    enriched: Number(enriched.count),
    cells: Number(cells.count),
    runtimeMinutes: Number(runtime?.minutes || 0),
  };
}

async function assertCanRun(campaign, task = null) {
  const limits = typeof campaign.limits === 'string' ? JSON.parse(campaign.limits) : campaign.limits;
  const counts = await getCounts(campaign.id, task?.source_id);
  let stopReason = null;

  if (counts.totalRequests >= limits.maxRequests) stopReason = 'STOP_MAX_REQUESTS';
  else if (task?.source_id && counts.sourceRequests >= limits.maxRequestsPerSource) stopReason = 'STOP_SOURCE_REQUEST_LIMIT';
  else if (counts.cells >= limits.maxCells) stopReason = 'STOP_MAX_CELLS';
  else if (counts.discovered >= limits.maxEntitiesDiscovered) stopReason = 'STOP_MAX_DISCOVERED';
  else if (counts.enriched >= limits.maxEntitiesEnriched) stopReason = 'STOP_MAX_ENRICHED';
  else if (counts.runtimeMinutes >= limits.maxRuntimeMinutes) stopReason = 'STOP_MAX_RUNTIME';
  else if (task && Number(task.depth || 0) > limits.maxTaskDepth) stopReason = 'STOP_MAX_TASK_DEPTH';

  if (stopReason) {
    await exec(
      "UPDATE acquisition_campaigns SET status='stopped', stop_reason=:stopReason, completed_at=NOW() WHERE id=:campaignId",
      { campaignId: campaign.id, stopReason }
    );
    throw new Error(stopReason);
  }
}

module.exports = { assertCanRun, getCounts };
