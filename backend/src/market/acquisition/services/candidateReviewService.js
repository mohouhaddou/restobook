'use strict';

const { Op } = require('sequelize');
const { Business, Organization } = require('../../../../models');
const { audit, exec, json, one, query, sequelize } = require('./repository');

// orgType est contraint par l'ENUM Organization.type (8 valeurs seulement :
// canteen/restaurant/snack/dark_kitchen/bakery/cafe/pharmacie/hanout) — bien
// plus grossier que business_type (24 valeurs). Les nouvelles categories sans
// bucket dedie sont rattachees au plus proche existant (ex: patisserie/glacier
// -> bakery/cafe, epicerie/supermarche/boucherie/primeur -> hanout), meme
// principe que bakery/boulangerie deja en place.
const TYPE_MAP = {
  restaurant: { businessType: 'restaurant', orgType: 'restaurant', module: 'resto' },
  cafe: { businessType: 'cafe', orgType: 'cafe', module: 'resto' },
  snack: { businessType: 'snack', orgType: 'snack', module: 'resto' },
  fast_food: { businessType: 'fast_food', orgType: 'snack', module: 'resto' },
  glacier: { businessType: 'glacier', orgType: 'cafe', module: 'resto' },
  bakery: { businessType: 'boulangerie', orgType: 'bakery', module: 'resto' },
  boulangerie: { businessType: 'boulangerie', orgType: 'bakery', module: 'resto' },
  patisserie: { businessType: 'patisserie', orgType: 'bakery', module: 'resto' },
  pharmacie: { businessType: 'pharmacie', orgType: 'pharmacie', module: 'pharmacie' },
  epicerie: { businessType: 'epicerie', orgType: 'hanout', module: 'hanout' },
  supermarche: { businessType: 'supermarche', orgType: 'hanout', module: 'hanout' },
  boucherie: { businessType: 'boucherie', orgType: 'hanout', module: 'hanout' },
  primeur: { businessType: 'primeur', orgType: 'hanout', module: 'hanout' },
};

function slugify(value) {
  return String(value || 'commerce')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'commerce';
}

async function uniqueSlug(base) {
  let slug = base;
  let index = 2;
  while (await Organization.findOne({ where: { slug } })) {
    slug = `${base}-${index}`;
    index += 1;
  }
  return slug;
}

function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

async function listCandidates({ campaignId = null, status = null, q = null, limit = 100 } = {}) {
  const where = [];
  const replacements = { limit: Math.min(Number(limit) || 100, 300) };
  if (campaignId) { where.push('dc.campaign_id = :campaignId'); replacements.campaignId = campaignId; }
  if (status && status !== 'all') { where.push('dc.status = :status'); replacements.status = status; }
  if (q) {
    where.push('(dc.raw_name LIKE :q OR dc.raw_address LIKE :q OR dc.normalized_category LIKE :q)');
    replacements.q = `%${q}%`;
  }
  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return query(
    `SELECT dc.*, b.id AS published_business_id, o.slug AS published_slug
     FROM discovery_candidates dc
     LEFT JOIN businesses b ON b.acquisition_candidate_id = dc.id
     LEFT JOIN organizations o ON o.id = b.organization_id
     ${sqlWhere}
     ORDER BY dc.updated_at DESC, dc.id DESC
     LIMIT :limit`,
    replacements
  );
}

async function getCandidate(id) {
  return one(
    `SELECT dc.*, b.id AS published_business_id, o.slug AS published_slug
     FROM discovery_candidates dc
     LEFT JOIN businesses b ON b.acquisition_candidate_id = dc.id
     LEFT JOIN organizations o ON o.id = b.organization_id
     WHERE dc.id = :id`,
    { id }
  );
}

async function approveCandidate(id, { userId = null, notes = null } = {}) {
  const candidate = await getCandidate(id);
  if (!candidate) throw new Error('Candidat introuvable');
  if (!['eligible', 'approved'].includes(candidate.status)) {
    throw new Error(`Statut non validable: ${candidate.status}`);
  }
  await exec("UPDATE discovery_candidates SET status='approved', updated_at=NOW() WHERE id=:id", { id });
  await audit({
    userId,
    campaignId: candidate.campaign_id,
    sourceId: candidate.source_id,
    action: 'HUMAN_APPROVED',
    newValue: { candidateId: id, notes },
  });
  return getCandidate(id);
}

async function rejectCandidate(id, { userId = null, reason = null } = {}) {
  const candidate = await getCandidate(id);
  if (!candidate) throw new Error('Candidat introuvable');
  if (candidate.status === 'published') throw new Error('Impossible de rejeter une fiche déjà publiée');
  await exec("UPDATE discovery_candidates SET status='rejected', updated_at=NOW() WHERE id=:id", { id });
  await audit({
    userId,
    campaignId: candidate.campaign_id,
    sourceId: candidate.source_id,
    action: 'HUMAN_REJECTED',
    reason,
    newValue: { candidateId: id },
  });
  return getCandidate(id);
}

async function publishCandidate(id, { userId = null } = {}) {
  const candidate = await getCandidate(id);
  if (!candidate) throw new Error('Candidat introuvable');
  if (candidate.published_business_id) {
    return { candidate, business: await Business.findByPk(candidate.published_business_id), alreadyPublished: true };
  }
  if (candidate.source_url) {
    const existingBySource = await Business.findOne({ where: { knowledge_source: 'openstreetmap', source_url: candidate.source_url } });
    if (existingBySource) {
      await exec("UPDATE discovery_candidates SET status='published', updated_at=NOW() WHERE id=:id", { id });
      return { candidate: await getCandidate(id), business: existingBySource, alreadyPublished: true };
    }
  }
  if (!['eligible', 'approved'].includes(candidate.status)) {
    throw new Error(`Statut non publiable: ${candidate.status}`);
  }
  if (!candidate.raw_name || !candidate.latitude || !candidate.longitude) {
    throw new Error('Nom et coordonnées requis pour publier');
  }

  const normalizedCategory = candidate.normalized_category || candidate.probable_category || 'restaurant';
  const mapping = TYPE_MAP[normalizedCategory] || TYPE_MAP.restaurant;
  // La ville reelle de la campagne (discovery_candidates n'a pas de colonne
  // city propre) — remplace le 'Skhirat' fige qui assignait cette ville a
  // TOUTE fiche publiee quelle que soit la campagne d'origine.
  const campaign = await one('SELECT city FROM acquisition_campaigns WHERE id=:id', { id: candidate.campaign_id });
  const city = campaign?.city || 'Skhirat';
  const baseSlug = `unclaimed-${slugify(candidate.raw_name)}-${candidate.id}`;
  const slug = await uniqueSlug(baseSlug);
  const settings = {
    unclaimed: true,
    source: 'openstreetmap',
    acquisition_candidate_id: Number(candidate.id),
    acquisition_campaign_id: Number(candidate.campaign_id),
    claim_status: 'unclaimed',
    source_attribution: '© OpenStreetMap contributors',
    source_url: candidate.source_url,
    osm: {
      type: candidate.osm_type,
      id: candidate.osm_id,
      source_category: candidate.source_category,
      normalized_category: candidate.normalized_category,
      classification_tags: parseJson(candidate.classification_tags, {}),
    },
  };

  const tx = await sequelize.transaction();
  try {
    const org = await Organization.create({
      slug,
      name: candidate.raw_name,
      type: mapping.orgType,
      plan: 'trial',
      active: true,
      settings,
      address: candidate.raw_address || null,
      city,
      country: 'Maroc',
      phone: candidate.phone || null,
      description: null,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      location_verified: false,
      accepts_delivery: false,
      delivery_mode: 'disabled',
      accepts_takeaway: false,
      accepts_dine_in: false,
      accepts_reservation: false,
      accepts_qr_table: false,
      is_marketplace: true,
      is_internal: false,
    }, { transaction: tx });

    const business = await Business.create({
      organization_id: org.id,
      name: candidate.raw_name,
      business_type: mapping.businessType,
      module: mapping.module,
      status: 'approved',
      description: null,
      address: candidate.raw_address || null,
      city,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      phone: candidate.phone || null,
      is_public: true,
      claim_status: 'unclaimed',
      acquisition_candidate_id: candidate.id,
      knowledge_source: 'openstreetmap',
      source_attribution: '© OpenStreetMap contributors',
      source_url: candidate.source_url || null,
      published_from_acquisition_at: new Date(),
    }, { transaction: tx });

    await sequelize.query(
      "UPDATE discovery_candidates SET status='published', updated_at=NOW() WHERE id=:id",
      { replacements: { id }, transaction: tx }
    );
    await tx.commit();

    await audit({
      userId,
      campaignId: candidate.campaign_id,
      sourceId: candidate.source_id,
      action: 'BUSINESS_PUBLISHED',
      newValue: { candidateId: id, businessId: business.id, organizationId: org.id, claimStatus: 'unclaimed' },
    });
    return { candidate: await getCandidate(id), business, organization: org, alreadyPublished: false };
  } catch (error) {
    await tx.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') {
      const existing = await Business.findOne({ where: { acquisition_candidate_id: id } });
      if (existing) return { candidate: await getCandidate(id), business: existing, alreadyPublished: true };
    }
    throw error;
  }
}

async function bulkRejectCandidates(ids, { userId = null, reason = null } = {}) {
  const succeeded = [];
  const failed = [];
  for (const id of ids) {
    try {
      succeeded.push(await rejectCandidate(id, { userId, reason }));
    } catch (error) {
      failed.push({ id, error: error.message });
    }
  }
  return { succeeded, failed };
}

async function bulkPublishCandidates(ids, { userId = null } = {}) {
  const succeeded = [];
  const failed = [];
  for (const id of ids) {
    try {
      succeeded.push(await publishCandidate(id, { userId }));
    } catch (error) {
      failed.push({ id, error: error.message });
    }
  }
  return { succeeded, failed };
}

async function candidateStats() {
  const rows = await query('SELECT status, COUNT(*) AS count FROM discovery_candidates GROUP BY status ORDER BY status');
  const published = await Business.count({ where: { claim_status: { [Op.in]: ['unclaimed', 'claim_pending'] } } });
  return { candidates: rows, unclaimedBusinesses: published };
}

module.exports = {
  approveCandidate,
  bulkPublishCandidates,
  bulkRejectCandidates,
  candidateStats,
  getCandidate,
  listCandidates,
  publishCandidate,
  rejectCandidate,
};
