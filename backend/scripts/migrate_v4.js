'use strict';

/**
 * Migration v4 — Customer Journey + QR Smart Ordering
 * Idempotente : peut être relancée sans risque.
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');
const crypto = require('crypto');

const seq = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql', logging: false }
);

async function tableExists(name) {
  const [r] = await seq.query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='${name}'`);
  return r.length > 0;
}
async function addColumnIfMissing(table, column, definition, afterColumn) {
  const [rows] = await seq.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='${table}' AND COLUMN_NAME='${column}'`);
  if (rows.length === 0) {
    const after = afterColumn ? `AFTER \`${afterColumn}\`` : '';
    await seq.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition} ${after}`);
    console.log(`  ✓ ${table}.${column} ajouté`);
  } else {
    console.log(`  · ${table}.${column} déjà présent`);
  }
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  // ════════════════════════════════════════════════════════════════
  // 1. TABLE restaurant_tables
  // ════════════════════════════════════════════════════════════════
  console.log('── 1. restaurant_tables ─────────────────────────────────────');
  if (!(await tableExists('restaurant_tables'))) {
    await seq.query(`
      CREATE TABLE restaurant_tables (
        id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id INT UNSIGNED NOT NULL,
        label           VARCHAR(50)  NOT NULL,
        qr_token        VARCHAR(64)  NOT NULL UNIQUE,
        capacity        TINYINT UNSIGNED NOT NULL DEFAULT 2,
        floor           VARCHAR(30)  DEFAULT NULL,
        active          TINYINT(1)   NOT NULL DEFAULT 1,
        created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_rt_org (organization_id),
        UNIQUE KEY uq_rt_org_label (organization_id, label)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ restaurant_tables créée');
  } else {
    console.log('  · restaurant_tables déjà présente');
  }

  // ════════════════════════════════════════════════════════════════
  // 2. TABLE loyalty_points
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 2. loyalty_points ────────────────────────────────────────');
  if (!(await tableExists('loyalty_points'))) {
    await seq.query(`
      CREATE TABLE loyalty_points (
        id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id         INT UNSIGNED NOT NULL,
        organization_id INT UNSIGNED DEFAULT NULL,
        points          INT NOT NULL DEFAULT 0,
        total_earned    INT NOT NULL DEFAULT 0,
        total_spent     INT NOT NULL DEFAULT 0,
        updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_lp_user_org (user_id, organization_id),
        KEY idx_lp_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ loyalty_points créée');
  } else {
    console.log('  · loyalty_points déjà présente');
  }

  // ════════════════════════════════════════════════════════════════
  // 3. TABLE loyalty_transactions
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 3. loyalty_transactions ──────────────────────────────────');
  if (!(await tableExists('loyalty_transactions'))) {
    await seq.query(`
      CREATE TABLE loyalty_transactions (
        id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id         INT UNSIGNED NOT NULL,
        organization_id INT UNSIGNED DEFAULT NULL,
        order_id        INT UNSIGNED DEFAULT NULL,
        type            ENUM('earn','spend','expire','bonus') NOT NULL DEFAULT 'earn',
        points          INT NOT NULL,
        balance_after   INT NOT NULL,
        description     VARCHAR(200) DEFAULT NULL,
        created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_lt_user (user_id),
        KEY idx_lt_order (order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ loyalty_transactions créée');
  } else {
    console.log('  · loyalty_transactions déjà présente');
  }

  // ════════════════════════════════════════════════════════════════
  // 4. USERS — colonnes customer profile
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 4. users — colonnes customer ─────────────────────────────');
  await addColumnIfMissing('users', 'preferred_language', "VARCHAR(5) NOT NULL DEFAULT 'fr'", 'avatar_url');
  await addColumnIfMissing('users', 'loyalty_points',     'INT NOT NULL DEFAULT 0',           'preferred_language');
  await addColumnIfMissing('users', 'onboarding_done',    'TINYINT(1) NOT NULL DEFAULT 0',    'loyalty_points');

  // ════════════════════════════════════════════════════════════════
  // 5. MENU_ITEMS — colonnes nutrionnelles/allergènes (optionnel)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 5. menu_items — allergènes & nutrition ───────────────────');
  await addColumnIfMissing('menu_items', 'allergens',        'JSON DEFAULT NULL',              'is_available');
  await addColumnIfMissing('menu_items', 'calories',         'SMALLINT UNSIGNED DEFAULT NULL', 'allergens');
  await addColumnIfMissing('menu_items', 'preparation_time', 'TINYINT UNSIGNED DEFAULT NULL',  'calories');
  await addColumnIfMissing('menu_items', 'is_vegetarian',    'TINYINT(1) NOT NULL DEFAULT 0',  'preparation_time');
  await addColumnIfMissing('menu_items', 'is_vegan',         'TINYINT(1) NOT NULL DEFAULT 0',  'is_vegetarian');
  await addColumnIfMissing('menu_items', 'is_spicy',         'TINYINT(1) NOT NULL DEFAULT 0',  'is_vegan');

  // ════════════════════════════════════════════════════════════════
  // 6. ORDERS — table_id pour QR ordering
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 6. orders — table_id ─────────────────────────────────────');
  await addColumnIfMissing('orders', 'table_id', 'INT UNSIGNED DEFAULT NULL', 'table_label');

  // ════════════════════════════════════════════════════════════════
  // 7. Initialiser QR tokens pour les orgs restaurant qui ont des tables configurées
  // ════════════════════════════════════════════════════════════════
  console.log('\n── 7. Tables par défaut pour restaurants actifs ─────────────');
  const [orgs] = await seq.query(`
    SELECT id FROM organizations
    WHERE type IN ('restaurant','snack','dark_kitchen','bakery','cafe')
    AND active = 1
  `);
  for (const org of orgs) {
    const [existing] = await seq.query(`SELECT COUNT(*) as c FROM restaurant_tables WHERE organization_id=${org.id}`);
    if (existing[0].c > 0) {
      console.log(`  · Org ${org.id} : tables déjà présentes`);
      continue;
    }
    // Créer 6 tables par défaut
    for (let i = 1; i <= 6; i++) {
      const token = crypto.randomBytes(16).toString('hex');
      await seq.query(`
        INSERT INTO restaurant_tables (organization_id, label, qr_token, capacity, floor)
        VALUES (${org.id}, 'T${i}', '${token}', ${i <= 4 ? 2 : 4}, 'Salle')
        ON DUPLICATE KEY UPDATE qr_token=qr_token
      `);
    }
    console.log(`  ✓ Org ${org.id} : 6 tables créées`);
  }

  console.log('\n✅ Migration v4 terminée !');
  await seq.close();
}

run().catch(err => {
  console.error('❌', err.message);
  console.error(err.stack);
  process.exit(1);
});
