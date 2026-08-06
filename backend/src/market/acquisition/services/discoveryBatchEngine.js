'use strict';

const { audit, exec, json, one, parseJsonFields, query, sequelize } = require('./repository');
const { assertCanRun } = require('./budgetGuard');
const { completeIfDone, getCampaign, getCampaignCells } = require('./campaignService');
const { getEnabledSource, getLatestApprovedSnapshot } = require('./sourceRegistry');
const osmBatchConnector = require('./osmBatchConnector');
const {
  fingerprint,
  subdividePlan,
} = require('./overpassQueryPlanner');
const {
  findCellForPoint,
  haversineKm,
  isInsideRadius,
  normalizeAddress,
  normalizePhone,
  normalizeText,
  similarityScore,
} = require('./utils');

async function nextQueuedTask(campaignId) {
  return one(
    `SELECT * FROM acquisition_tasks
     WHERE campaign_id=:campaignId AND status='queued'
     ORDER BY priority ASC, id ASC
     LIMIT 1`,
    { campaignId }
  );
}

function duplicateScore(candidate, existing) {
  let score = 0;
  if (candidate.phone && existing.phone && normalizePhone(candidate.phone) === normalizePhone(existing.phone)) score += 50;
  if (candidate.externalId && existing.external_id && candidate.externalId === existing.external_id) score += 60;
  if (candidate.website && existing.website) {
    try {
      if (new URL(candidate.website).hostname.replace(/^www\./, '') === new URL(existing.website).hostname.replace(/^www\./, '')) score += 50;
    } catch {}
  }
  if (candidate.normalizedAddress && existing.normalized_address && candidate.normalizedAddress === existing.normalized_address) score += 35;
  if (candidate.latitude && candidate.longitude && existing.latitude && existing.longitude) {
    const meters = haversineKm(Number(candidate.latitude), Number(candidate.longitude), Number(existing.latitude), Number(existing.longitude)) * 1000;
    if (meters < 30) score += 30;
    else if (meters < 100) score += 15;
  }
  if (similarityScore(candidate.rawName, existing.raw_name) >= 0.75) score += 25;
  if (candidate.normalizedCategory && existing.normalized_category === candidate.normalizedCategory) score += 10;
  return Math.min(score, 100);
}

async function findDuplicate(campaignId, candidate) {
  const rows = await query(
    `SELECT * FROM discovery_candidates
     WHERE campaign_id=:campaignId
       AND status IN ('new','eligible','duplicate')
       AND (:externalId IS NULL OR external_id <> :externalId)
     ORDER BY id ASC
     LIMIT 300`,
    { campaignId, externalId: candidate.externalId || null }
  );

  let best = null;
  for (const row of rows) {
    const score = duplicateScore(candidate, row);
    if (!best || score > best.score) best = { row, score };
  }
  return best && best.score >= 80 ? best : null;
}

async function saveCandidate({ campaign, task, sourceSnapshot, raw, cells, queryVersion }) {
  if (raw.rejected) {
    await audit({
      campaignId: campaign.id,
      taskId: task.id,
      sourceId: task.source_id,
      action: 'CANDIDATE_TECHNICAL_REJECT',
      result: raw.rejectReason,
      newValue: raw,
    });
    return { status: 'technical_reject', saved: false };
  }

  const scope = typeof campaign.geographic_scope === 'string' ? JSON.parse(campaign.geographic_scope) : campaign.geographic_scope;
  const cell = findCellForPoint(cells, raw.latitude, raw.longitude);
  const normalizedName = normalizeText(raw.rawName);
  const normalizedPhone = normalizePhone(raw.phone);
  const normalizedAddress = normalizeAddress(raw.rawAddress);
  const candidate = {
    ...raw,
    normalizedName,
    normalizedAddress,
    phone: normalizedPhone,
  };

  let status = 'eligible';
  let duplicate = null;
  if (!isInsideRadius(scope, raw.latitude, raw.longitude) || !cell) {
    status = 'out_of_scope';
  } else {
    duplicate = await findDuplicate(campaign.id, candidate);
    if (duplicate) status = 'duplicate';
  }

  await exec(
    `INSERT INTO discovery_candidates
     (campaign_id, cell_id, source_id, source_license_snapshot_id, external_id, osm_type, osm_id,
      raw_name, normalized_name, raw_address, normalized_address, latitude, longitude,
      probable_category, source_category, normalized_category, classification_tags, raw_osm_tags,
      query_version, completeness_status, phone, website, source_url, duplicate_score, duplicate_of_id, status)
     VALUES
     (:campaignId, :cellId, :sourceId, :snapshotId, :externalId, :osmType, :osmId,
      :rawName, :normalizedName, :rawAddress, :normalizedAddress, :latitude, :longitude,
      :probableCategory, :sourceCategory, :normalizedCategory, CAST(:classificationTags AS JSON), CAST(:rawOsmTags AS JSON),
      :queryVersion, :completenessStatus, :phone, :website, :sourceUrl, :duplicateScore, :duplicateOfId, :status)
     ON DUPLICATE KEY UPDATE
      raw_name=VALUES(raw_name), normalized_name=VALUES(normalized_name), raw_address=VALUES(raw_address),
      normalized_address=VALUES(normalized_address), latitude=VALUES(latitude), longitude=VALUES(longitude),
      probable_category=VALUES(probable_category), source_category=VALUES(source_category), normalized_category=VALUES(normalized_category),
      classification_tags=VALUES(classification_tags), raw_osm_tags=VALUES(raw_osm_tags), query_version=VALUES(query_version),
      completeness_status=VALUES(completeness_status), phone=VALUES(phone), website=VALUES(website),
      source_url=VALUES(source_url), duplicate_score=VALUES(duplicate_score), duplicate_of_id=VALUES(duplicate_of_id),
      status=VALUES(status), updated_at=NOW()`,
    {
      campaignId: campaign.id,
      cellId: cell?.id || task.cell_id || null,
      sourceId: task.source_id,
      snapshotId: sourceSnapshot?.id || null,
      externalId: raw.externalId || null,
      osmType: raw.osmType || null,
      osmId: raw.osmId || null,
      rawName: raw.rawName,
      normalizedName,
      rawAddress: raw.rawAddress || null,
      normalizedAddress,
      latitude: raw.latitude || null,
      longitude: raw.longitude || null,
      probableCategory: raw.normalizedCategory || raw.probableCategory || null,
      sourceCategory: raw.sourceCategory || null,
      normalizedCategory: raw.normalizedCategory || null,
      classificationTags: json(raw.classificationTags || {}),
      rawOsmTags: json(raw.rawOsmTags || {}),
      queryVersion,
      completenessStatus: raw.completenessStatus || 'complete',
      phone: normalizedPhone,
      website: raw.website || null,
      sourceUrl: raw.sourceUrl || null,
      duplicateScore: duplicate?.score || 0,
      duplicateOfId: duplicate?.row?.id || null,
      status,
    }
  );

  await audit({
    campaignId: campaign.id,
    taskId: task.id,
    sourceId: task.source_id,
    action: status === 'out_of_scope' ? 'CANDIDATE_OUT_OF_SCOPE' : status === 'duplicate' ? 'DUPLICATE_DETECTED' : 'CANDIDATE_DISCOVERED',
    newValue: { name: raw.rawName, status, sourceUrl: raw.sourceUrl, osmType: raw.osmType, osmId: raw.osmId },
    result: status,
  });
  return { status, saved: true };
}

async function enqueueSubtasks({ campaignId, sourceId, parentTaskId, parentDepth, parentPlan, cells }) {
  const plans = subdividePlan(parentPlan, cells);
  for (const plan of plans) {
    const uniqueFingerprint = fingerprint({
      campaignId,
      sourceId,
      cellIds: plan.cellIds,
      categories: plan.categories,
      mode: plan.mode,
    });
    plan.fingerprint = uniqueFingerprint;
    await exec(
      `INSERT IGNORE INTO acquisition_tasks
       (campaign_id, cell_id, source_id, parent_task_id, depth, task_type, unique_fingerprint, payload, max_attempts, priority, status)
       VALUES (:campaignId, :cellId, :sourceId, :parentTaskId, :depth, 'osm_discovery_batch', :fingerprint,
        CAST(:payload AS JSON), :maxAttempts, :priority, 'queued')`,
      {
        campaignId,
        cellId: plan.cellIds.length === 1 ? plan.cellIds[0] : null,
        sourceId,
        parentTaskId,
        depth: parentDepth + 1,
        fingerprint: uniqueFingerprint,
        payload: json(plan),
        maxAttempts: 1,
        priority: 20 + parentDepth,
      }
    );
  }
  return plans.length;
}

async function runTask(task) {
  const campaign = await getCampaign(task.campaign_id);
  if (!campaign || campaign.status !== 'running') return { skipped: true, reason: 'campaign_not_running' };
  campaign.id = task.campaign_id;
  await assertCanRun(campaign, task);

  const source = await getEnabledSource(task.source_id);
  if (!source) throw new Error('STOP_SOURCE_DISABLED');
  const sourceSnapshot = await getLatestApprovedSnapshot(task.source_id);
  if (!sourceSnapshot) throw new Error('STOP_LICENSE_INVALID');

  const allCells = (await getCampaignCells(campaign.id)).map(cell => parseJsonFields(cell, ['boundary']));
  const plan = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload;

  await exec("UPDATE acquisition_tasks SET status='running', attempts=attempts+1, started_at=NOW() WHERE id=:id", { id: task.id });
  const started = Date.now();
  try {
    await audit({
      campaignId: campaign.id,
      taskId: task.id,
      sourceId: task.source_id,
      action: 'SOURCE_REQUESTED',
      newValue: { mode: plan.mode, categories: plan.categories, cellIds: plan.cellIds, queryVersion: plan.queryVersion },
    });
    const response = await osmBatchConnector.executePlan(plan);
    let saved = 0;
    const stats = { eligible: 0, out_of_scope: 0, duplicate: 0, incomplete: 0, technical_reject: 0 };
    for (const raw of response.elements) {
      await assertCanRun(campaign, task);
      const result = await saveCandidate({
        campaign,
        task,
        sourceSnapshot,
        raw,
        cells: allCells,
        queryVersion: plan.queryVersion,
      });
      if (result.saved) saved += 1;
      if (raw.completenessStatus === 'incomplete') stats.incomplete += 1;
      stats[result.status] = (stats[result.status] || 0) + 1;
    }

    await exec("UPDATE acquisition_tasks SET status='completed', completed_at=NOW(), error_code=NULL WHERE id=:id", { id: task.id });
    await exec(
      `UPDATE geographic_cells gc
       SET acquisition_status='completed', last_scanned_at=NOW(),
           discovered_entities_count=(SELECT COUNT(*) FROM discovery_candidates WHERE cell_id=gc.id)
       WHERE gc.id IN (:cellIds)`,
      { cellIds: plan.cellIds }
    );
    await audit({
      campaignId: campaign.id,
      taskId: task.id,
      sourceId: task.source_id,
      action: 'TASK_COMPLETED',
      newValue: { saved, rawCount: response.rawCount, stats, endpoint: response.endpoint, mode: plan.mode },
      durationMs: Date.now() - started,
    });
    await completeIfDone(campaign.id);
    return { saved, rawCount: response.rawCount, stats };
  } catch (error) {
    const errorCode = error.code || String(error.message || 'TASK_FAILED').slice(0, 80);
    if (error.reducible && Array.isArray(plan.cellIds) && plan.cellIds.length > 1) {
      const selectedCells = allCells.filter(cell => plan.cellIds.includes(Number(cell.id)));
      const childCount = await enqueueSubtasks({
        campaignId: campaign.id,
        sourceId: task.source_id,
        parentTaskId: task.id,
        parentDepth: Number(task.depth || 0),
        parentPlan: plan,
        cells: selectedCells,
      });
      await exec(
        "UPDATE acquisition_tasks SET status='skipped', stop_reason=:reason, error_code=:errorCode, completed_at=NOW() WHERE id=:id",
        { id: task.id, reason: 'SUBDIVIDED_AFTER_OVERPASS_FAILURE', errorCode }
      );
      await audit({
        campaignId: campaign.id,
        taskId: task.id,
        sourceId: task.source_id,
        action: 'TASK_SUBDIVIDED',
        result: errorCode,
        errorCode,
        newValue: { childCount, cellIds: plan.cellIds },
        durationMs: Date.now() - started,
      });
      return { saved: 0, rawCount: 0, subdivided: childCount };
    }

    const taskAfter = await one('SELECT attempts, max_attempts FROM acquisition_tasks WHERE id=:id', { id: task.id });
    const permanent = error.permanent || Number(taskAfter.attempts) >= Number(taskAfter.max_attempts);
    const nextStatus = permanent ? 'failed' : 'queued';
    await exec(
      permanent
        ? "UPDATE acquisition_tasks SET status=:status, error_code=:errorCode, completed_at=NOW() WHERE id=:id"
        : "UPDATE acquisition_tasks SET status=:status, error_code=:errorCode WHERE id=:id",
      { id: task.id, status: nextStatus, errorCode }
    );
    await audit({
      campaignId: campaign.id,
      taskId: task.id,
      sourceId: task.source_id,
      action: 'TASK_FAILED',
      result: 'error',
      errorCode,
      durationMs: Date.now() - started,
      newValue: { message: error.message, status: error.status || null },
    });
    await completeIfDone(campaign.id);
    throw error;
  }
}

async function runCampaign(campaignId, { maxTasks = null } = {}) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error('Campagne introuvable');
  const concurrency = typeof campaign.concurrency === 'string' ? JSON.parse(campaign.concurrency) : campaign.concurrency;
  const taskLimit = maxTasks || concurrency.maxConcurrentTasks || 1;
  const summary = { processed: 0, saved: 0, rawCount: 0, errors: [], subdivided: 0, stats: {} };
  const delayMs = Number(process.env.ACQUISITION_TASK_DELAY_MS || 1000);

  while (summary.processed < taskLimit) {
    const current = await getCampaign(campaignId);
    if (!current || current.status !== 'running') break;
    const task = await nextQueuedTask(campaignId);
    if (!task) break;
    try {
      const result = await runTask(task);
      summary.saved += result.saved || 0;
      summary.rawCount += result.rawCount || 0;
      summary.subdivided += result.subdivided || 0;
      for (const [key, value] of Object.entries(result.stats || {})) {
        summary.stats[key] = (summary.stats[key] || 0) + value;
      }
      summary.processed += 1;
    } catch (error) {
      summary.errors.push(error.message);
      summary.processed += 1;
      if (String(error.message || '').startsWith('STOP_')) break;
    }
    if (summary.processed < taskLimit) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  await completeIfDone(campaignId);
  return summary;
}

module.exports = { runCampaign, runTask };
