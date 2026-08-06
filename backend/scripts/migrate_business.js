'use strict';

/**
 * migrate_business.js
 *
 * Migration prudente : crée la table `businesses` et peuple depuis `organizations`.
 *
 * Stratégie :
 *   1. CREATE TABLE businesses si elle n'existe pas (safe)
 *   2. INSERT INTO businesses depuis organizations (idempotent via INSERT IGNORE)
 *   3. Rapport final
 *
 * SAFE : aucune table existante n'est modifiée ou supprimée.
 *
 * Usage : node scripts/migrate_business.js [--dry-run]
 */

require('dotenv').config();
const { sequelize, Organization, Business } = require('../models');

const isDryRun = process.argv.includes('--dry-run');

/* ── Mapping organization.type → business_type ─────────────────────────────── */
function toBizType(orgType) {
  const map = {
    restaurant:   'restaurant',
    snack:        'restaurant',
    dark_kitchen: 'restaurant',
    cafe:         'cafe',
    bakery:       'boulangerie',
    canteen:      'cantine',
  };
  return map[orgType] || 'autre';
}

/* ── Mapping organization.type → module Ifighak ────────────────────────────── */
function toModule(orgType) {
  if (orgType === 'canteen') return 'cantine';
  return 'resto';
}

/* ── Mapping active + is_marketplace → status ──────────────────────────────── */
function toStatus(org) {
  if (!org.active)                           return 'suspended';
  if (org.active && org.is_marketplace)      return 'approved';
  if (org.active && org.is_internal)         return 'draft';
  return 'draft';
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  migrate_business.js');
  console.log(isDryRun ? '  MODE : DRY RUN (aucune écriture)' : '  MODE : RÉEL');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  console.log('[DB] Connexion OK');

  // ── Étape 1 : Créer la table si nécessaire ────────────────────────────────
  console.log('\n[1/3] Synchronisation du modèle Business (CREATE TABLE IF NOT EXISTS)…');
  if (!isDryRun) {
    await Business.sync({ alter: false });
    console.log('[OK] Table `businesses` prête');
  } else {
    console.log('[DRY] CREATE TABLE businesses (skipped)');
  }

  // ── Étape 2 : Lire les organizations ─────────────────────────────────────
  console.log('\n[2/3] Lecture des organizations…');
  const orgs = await Organization.findAll({ order: [['id', 'ASC']] });
  console.log(`[OK] ${orgs.length} organisation(s) trouvée(s)`);

  const report = { created: 0, skipped: 0, errors: [] };

  for (const org of orgs) {
    const payload = {
      organization_id: org.id,
      name:            org.name,
      business_type:   toBizType(org.type),
      module:          toModule(org.type),
      status:          toStatus(org),
      description:     org.description  || null,
      address:         org.address      || null,
      city:            org.city         || null,
      district:        org.district     || null,
      latitude:        org.latitude     || null,
      longitude:       org.longitude    || null,
      phone:           org.phone        || null,
      whatsapp:        null,
      email:           org.email        || null,
      logo:            org.logo_url     || null,
      cover_image:     org.cover_url    || null,
      opening_hours:   org.opening_hours || null,
      is_public:       Boolean(org.is_marketplace),
    };

    console.log(
      `  org#${String(org.id).padEnd(3)} ${org.type.padEnd(12)} → ` +
      `biz_type=${payload.business_type.padEnd(12)} ` +
      `module=${payload.module.padEnd(10)} ` +
      `status=${payload.status}` +
      (isDryRun ? ' [DRY]' : '')
    );

    if (!isDryRun) {
      try {
        await Business.findOrCreate({
          where: { organization_id: org.id },
          defaults: payload,
        });
        report.created++;
      } catch (err) {
        console.error(`  [ERREUR] org#${org.id}: ${err.message}`);
        report.errors.push({ org_id: org.id, error: err.message });
      }
    } else {
      report.created++; // simulate
    }
  }

  // ── Étape 3 : Rapport ─────────────────────────────────────────────────────
  console.log('\n[3/3] Rapport final :');
  console.log(`  Organisations traitées : ${orgs.length}`);
  console.log(`  Business créés/trouvés  : ${report.created}`);
  console.log(`  Erreurs                : ${report.errors.length}`);
  if (report.errors.length > 0) {
    report.errors.forEach(e => console.error(`    - org#${e.org_id}: ${e.error}`));
  }

  if (!isDryRun) {
    const count = await Business.count();
    console.log(`\n  Total businesses en DB : ${count}`);

    const sample = await Business.findAll({
      include: [{ association: 'organization', attributes: ['slug', 'type'] }],
      order: [['id', 'ASC']],
      limit: 15,
    });
    console.log('\n  Aperçu :');
    sample.forEach(b => {
      console.log(
        `    #${String(b.id).padEnd(3)} ${b.name.padEnd(35)} ` +
        `[${b.business_type.padEnd(12)}] [${b.module.padEnd(10)}] [${b.status}]`
      );
    });
  }

  console.log('\n══════════════════════════════════════════');
  console.log(isDryRun ? '  DRY RUN terminé — aucune données modifiées' : '  Migration terminée ✓');
  console.log('══════════════════════════════════════════\n');
  process.exit(0);
}

run().catch(err => {
  console.error('\n[FATAL]', err.message);
  console.error(err.stack);
  process.exit(1);
});
