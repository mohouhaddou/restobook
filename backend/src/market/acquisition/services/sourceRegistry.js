'use strict';

const crypto = require('crypto');
const { exec, json, one, query } = require('./repository');

const OSM_USAGE_POLICY = {
  discoveryAllowed: true,
  automatedAccessAllowed: true,
  storageAllowed: true,
  modificationAllowed: true,
  redistributionAllowed: true,
  commercialUseAllowed: true,
  businessIdentityAllowed: true,
  addressAllowed: true,
  coordinatesAllowed: true,
  phoneAllowed: true,
  emailAllowed: false,
  openingHoursAllowed: true,
  descriptionsAllowed: false,
  imagesAllowed: false,
  reviewsAllowed: false,
  ratingsAllowed: false,
  menusAllowed: false,
  pricesAllowed: false,
  attributionRequired: true,
  attributionText: '© OpenStreetMap contributors',
};

const OSM_CRAWL_POLICY = {
  robotsTxtRequired: false,
  maxDepth: 0,
  maxPagesPerDomain: 0,
  maxLinksPerPage: 0,
  allowedPaths: [],
  blockedPaths: [],
};

async function seedOpenStreetMapSource({ reviewerId = null } = {}) {
  await exec(
    `INSERT INTO source_registries
      (id, name, source_type, base_url, api_documentation_url, license_name, license_url, terms_url,
       license_version, policy_reviewed_at, usage_policy, crawl_policy, rate_limits, enabled, requires_manual_approval)
     VALUES
      ('openstreetmap', 'OpenStreetMap / Overpass API', 'open_data', 'https://www.openstreetmap.org',
       'https://wiki.openstreetmap.org/wiki/Overpass_API', 'Open Database License', 'https://opendatacommons.org/licenses/odbl/',
       'https://operations.osmfoundation.org/policies/api/', 'ODbL-1.0', NOW(),
       CAST(:usagePolicy AS JSON), CAST(:crawlPolicy AS JSON), CAST(:rateLimits AS JSON), 1, 0)
     ON DUPLICATE KEY UPDATE
       name=VALUES(name), source_type=VALUES(source_type), base_url=VALUES(base_url),
       api_documentation_url=VALUES(api_documentation_url), license_name=VALUES(license_name),
       license_url=VALUES(license_url), terms_url=VALUES(terms_url), license_version=VALUES(license_version),
       policy_reviewed_at=VALUES(policy_reviewed_at), usage_policy=VALUES(usage_policy),
       crawl_policy=VALUES(crawl_policy), rate_limits=VALUES(rate_limits), enabled=VALUES(enabled),
       requires_manual_approval=VALUES(requires_manual_approval)`,
    {
      usagePolicy: json(OSM_USAGE_POLICY),
      crawlPolicy: json(OSM_CRAWL_POLICY),
      rateLimits: json({ requestsPerMinute: 10, requestsPerHour: 250, requestsPerDay: 1000 }),
    }
  );

  const policyHash = crypto
    .createHash('sha256')
    .update(json(OSM_USAGE_POLICY))
    .digest('hex');
  const existing = await one(
    `SELECT id FROM source_license_snapshots
     WHERE source_id='openstreetmap' AND policy_hash=:policyHash AND decision='approved'
     ORDER BY id DESC LIMIT 1`,
    { policyHash }
  );
  if (!existing) {
    await exec(
      `INSERT INTO source_license_snapshots
       (source_id, license_name, license_url, terms_url, snapshot_date, policy_hash, decision, reviewer_id, notes)
       VALUES ('openstreetmap', 'Open Database License', 'https://opendatacommons.org/licenses/odbl/',
       'https://operations.osmfoundation.org/policies/api/', NOW(), :policyHash, 'approved', :reviewerId,
       'Source pilote autorisée pour découverte factuelle minimale avec attribution obligatoire.')`,
      { policyHash, reviewerId }
    );
  }
}

async function getEnabledSource(sourceId) {
  const source = await one('SELECT * FROM source_registries WHERE id=:sourceId', { sourceId });
  if (!source || !source.enabled) return null;
  if (typeof source.usage_policy === 'string') source.usage_policy = JSON.parse(source.usage_policy);
  if (typeof source.crawl_policy === 'string') source.crawl_policy = JSON.parse(source.crawl_policy);
  if (typeof source.rate_limits === 'string') source.rate_limits = JSON.parse(source.rate_limits);
  return source;
}

async function getLatestApprovedSnapshot(sourceId) {
  return one(
    `SELECT * FROM source_license_snapshots
     WHERE source_id=:sourceId AND decision IN ('approved','restricted')
     ORDER BY snapshot_date DESC, id DESC LIMIT 1`,
    { sourceId }
  );
}

async function listSources() {
  return query('SELECT * FROM source_registries ORDER BY name ASC');
}

module.exports = {
  getEnabledSource,
  getLatestApprovedSnapshot,
  listSources,
  seedOpenStreetMapSource,
};
