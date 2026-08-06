'use strict';

/**
 * Migration widen business_type — Idempotente
 *
 * Bug : businesses.business_type (ENUM MySQL) ne listait que 9 valeurs alors
 * que bizType()/PUBLIC_BIZ_TYPES (marketplace) en produisent/acceptent 20+
 * (snack, epicerie, droguerie, fast_food, etc.). Résultat : Business.create()
 * échouait silencieusement (WARN_DATA_TRUNCATED) pour ces precise_type — le
 * commerce (Organization + User) était bien créé, mais SANS profil Business,
 * donc invisible en marketplace même après activation superadmin (le
 * endpoint /marketplace/businesses interroge la table businesses).
 *
 * Cette migration élargit l'ENUM pour couvrir toutes les valeurs possibles.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Sequelize } = require('sequelize');

const seq = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',
    logging: false,
  }
);

const BUSINESS_TYPES = [
  'restaurant', 'cafe', 'cantine', 'hanout', 'boulangerie', 'patisserie',
  'boucherie', 'pharmacie', 'autre', 'snack', 'dark_kitchen', 'traiteur',
  'fast_food', 'epicerie', 'alimentation', 'droguerie', 'glacier',
  'juice_bar', 'salon_the', 'primeur', 'quincaillerie', 'supermarche',
  'parapharmacie', 'pharmacie_de_garde',
];

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  const enumList = BUSINESS_TYPES.map(t => `'${t}'`).join(',');
  await seq.query(`ALTER TABLE \`businesses\` MODIFY COLUMN \`business_type\` ENUM(${enumList}) NOT NULL DEFAULT 'restaurant'`);
  console.log(`✓ businesses.business_type élargi à ${BUSINESS_TYPES.length} valeurs`);

  // Backfill : organisations actives/approuvées sans profil Business (créées
  // avant cette migration, victimes du bug ci-dessus).
  const [orphans] = await seq.query(`
    SELECT o.id, o.name, o.settings
    FROM organizations o
    LEFT JOIN businesses b ON b.organization_id = o.id
    WHERE b.id IS NULL
  `);

  if (!orphans.length) {
    console.log('✓ Aucune organisation orpheline (sans Business) à corriger.');
  } else {
    console.log(`\n⚠ ${orphans.length} organisation(s) sans profil Business détectée(s) :`);
    for (const org of orphans) {
      console.log(`  - #${org.id} ${org.name}`);
    }
    console.log('  → à traiter individuellement (voir scripts/backfill_business.js ou manuellement),');
    console.log('    ce script ne devine pas le business_type/adresse à votre place.');
  }

  await seq.close();
}

run().catch(e => {
  console.error('ERREUR migration widen business_type :', e);
  process.exit(1);
});
