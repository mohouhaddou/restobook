'use strict';

/**
 * Migration : ajoute is_marketplace + is_internal à organizations
 *
 * is_marketplace = true  → visible dans la marketplace publique (restaurants, snacks, cafés…)
 * is_internal    = true  → accès restreint, usage privé (cantines d'entreprises, scolaires…)
 *
 * Règle appliquée aux données existantes :
 *   type = 'canteen'                     → is_marketplace=false, is_internal=true
 *   type IN (restaurant|snack|cafe|…)    → is_marketplace=true,  is_internal=false
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const sequelize = require('../models/db');
const { QueryTypes } = require('sequelize');

async function run() {
  const qi = sequelize.getQueryInterface();

  // ── 1. Ajouter les colonnes si elles n'existent pas ─────────────────────
  const [cols] = await sequelize.query("SHOW COLUMNS FROM organizations LIKE 'is_marketplace'", { type: QueryTypes.SELECT });

  if (!cols) {
    console.log('📦 Ajout colonne is_marketplace...');
    await qi.addColumn('organizations', 'is_marketplace', {
      type: 'TINYINT(1) NOT NULL DEFAULT 0',
      after: 'is_featured',
    });
  } else {
    console.log('ℹ️  Colonne is_marketplace déjà présente.');
  }

  const [cols2] = await sequelize.query("SHOW COLUMNS FROM organizations LIKE 'is_internal'", { type: QueryTypes.SELECT });

  if (!cols2) {
    console.log('📦 Ajout colonne is_internal...');
    await qi.addColumn('organizations', 'is_internal', {
      type: 'TINYINT(1) NOT NULL DEFAULT 0',
      after: 'is_marketplace',
    });
  } else {
    console.log('ℹ️  Colonne is_internal déjà présente.');
  }

  // ── 2. Mettre à jour les données existantes ──────────────────────────────
  console.log('🔄 Mise à jour is_marketplace pour les restaurants/snacks/cafés...');
  const [updatedResto] = await sequelize.query(`
    UPDATE organizations
    SET is_marketplace = 1, is_internal = 0
    WHERE type IN ('restaurant', 'snack', 'dark_kitchen', 'bakery', 'cafe')
  `);
  console.log(`   → ${updatedResto.affectedRows} organisations marquées is_marketplace=true`);

  console.log('🔄 Mise à jour is_internal pour les cantines...');
  const [updatedCanteen] = await sequelize.query(`
    UPDATE organizations
    SET is_marketplace = 0, is_internal = 1
    WHERE type = 'canteen'
  `);
  console.log(`   → ${updatedCanteen.affectedRows} organisations marquées is_internal=true`);

  // ── 3. Vérification ────────────────────────────────────────────────────
  const stats = await sequelize.query(`
    SELECT type, is_marketplace, is_internal, COUNT(*) as count
    FROM organizations
    GROUP BY type, is_marketplace, is_internal
    ORDER BY type
  `, { type: QueryTypes.SELECT });

  console.log('\n📊 État final des organisations :');
  console.table(stats);

  console.log('\n✅ Migration is_marketplace terminée.');
  process.exit(0);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
