/**
 * Script de migration douce vers l'architecture multi-tenant.
 * Exécuter une seule fois : node scripts/migrate.js
 * Idempotent : peut être relancé sans risque (IF NOT EXISTS, INSERT IGNORE).
 */
'use strict';

require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

const seq = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',
    logging: (msg) => console.log('[SQL]', msg),
  }
);

async function run() {
  await seq.authenticate();
  console.log('✓ DB connected');

  const qi = seq.getQueryInterface();

  // ─── 1. Table organizations ───────────────────────────────────────────────
  await seq.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug          VARCHAR(64)  NOT NULL,
      name          VARCHAR(191) NOT NULL,
      type          ENUM('canteen','restaurant') NOT NULL DEFAULT 'canteen',
      plan          ENUM('trial','starter','pro','enterprise') NOT NULL DEFAULT 'trial',
      plan_expires_at DATETIME   NULL,
      active        TINYINT(1)   NOT NULL DEFAULT 1,
      settings      JSON         NULL,
      created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_org_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ Table organizations prête');

  // ─── 2. Organisation par défaut pour les données existantes ───────────────
  await seq.query(`
    INSERT IGNORE INTO organizations (id, slug, name, type, plan, active)
    VALUES (1, 'default', 'Organisation par défaut', 'canteen', 'pro', 1);
  `);
  console.log('✓ Organisation par défaut insérée (id=1)');

  // ─── 3. Ajouter organization_id aux tables existantes (NULL d'abord) ──────
  const tables = [
    { table: 'users',           after: 'actif' },
    { table: 'menu_items',      after: 'actif' },
    { table: 'daily_menus',     after: 'locked' },
    { table: 'reservations',    after: 'picked_at' },
    { table: 'settings',        after: 'value' },
    { table: 'notifications',   after: 'read_at' },
  ];

  for (const { table, after } of tables) {
    // Vérifier si la colonne existe déjà
    const [rows] = await seq.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = '${table}'
        AND COLUMN_NAME  = 'organization_id'
    `);

    if (rows.length === 0) {
      await seq.query(`
        ALTER TABLE \`${table}\`
        ADD COLUMN organization_id INT UNSIGNED NULL
        AFTER \`${after}\`;
      `);
      console.log(`✓ Colonne organization_id ajoutée à ${table}`);
    } else {
      console.log(`  (déjà présente) organization_id dans ${table}`);
    }
  }

  // ─── 4. Remplir organization_id = 1 pour les lignes existantes ──────────
  const updateTables = ['users', 'menu_items', 'daily_menus', 'reservations', 'settings', 'notifications'];
  for (const table of updateTables) {
    await seq.query(`
      UPDATE \`${table}\` SET organization_id = 1 WHERE organization_id IS NULL;
    `);
    console.log(`✓ Données existantes de ${table} associées à l'org 1`);
  }

  // ─── 5. Contrainte UNIQUE daily_menus : (date_jour + organization_id) ─────
  // Supprimer l'ancienne contrainte unique sur date_jour seul, si elle existe
  try {
    await seq.query(`ALTER TABLE daily_menus DROP INDEX date_jour;`);
    console.log('✓ Ancien UNIQUE date_jour supprimé');
  } catch { console.log('  (pas de UNIQUE date_jour à supprimer)'); }

  try {
    await seq.query(`
      ALTER TABLE daily_menus
      ADD UNIQUE KEY uq_daily_menu_org_date (organization_id, date_jour);
    `);
    console.log('✓ UNIQUE (organization_id, date_jour) ajouté');
  } catch { console.log('  (UNIQUE déjà présent)'); }

  // ─── 6. Contrainte UNIQUE settings : (key + organization_id) ─────────────
  try {
    await seq.query(`ALTER TABLE settings DROP INDEX key;`);
    console.log('✓ Ancien UNIQUE key supprimé dans settings');
  } catch { console.log('  (pas de UNIQUE key à supprimer dans settings)'); }

  try {
    await seq.query(`
      ALTER TABLE settings
      ADD UNIQUE KEY uq_setting_org_key (organization_id, \`key\`);
    `);
    console.log('✓ UNIQUE (organization_id, key) ajouté dans settings');
  } catch { console.log('  (UNIQUE déjà présent dans settings)'); }

  // ─── 7. Étendre ENUM role dans users ─────────────────────────────────────
  // Vérifier la valeur actuelle de l'ENUM
  const [roleRows] = await seq.query(`
    SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'role'
  `);
  const currentEnum = roleRows[0]?.COLUMN_TYPE || '';
  if (!currentEnum.includes('superadmin')) {
    await seq.query(`
      ALTER TABLE users
      MODIFY COLUMN role
        ENUM('superadmin','owner','admin','manager','staff','user')
        NOT NULL DEFAULT 'user';
    `);
    console.log("✓ ENUM role étendu (superadmin, owner, staff ajoutés)");
  } else {
    console.log('  (ENUM role déjà étendu)');
  }

  // ─── 8. Créer le compte superadmin global ────────────────────────────────
  const bcrypt = require('bcryptjs');
  const superPwd = await bcrypt.hash('super123', 10);
  await seq.query(`
    INSERT IGNORE INTO users (matricule, nom, email, role, hash_mdp, actif, organization_id)
    VALUES ('superadmin', 'Super Administrateur', 'superadmin@restobook.local',
            'superadmin', '${superPwd}', 1, NULL);
  `);
  console.log('✓ Compte superadmin créé (matricule: superadmin / MDP: super123)');

  console.log('\n✅ Migration terminée avec succès.');
  await seq.close();
}

run().catch(err => {
  console.error('❌ Erreur migration :', err.message);
  process.exit(1);
});
