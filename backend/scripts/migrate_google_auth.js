'use strict';

/**
 * Migration Google Auth — Idempotente
 *
 * 1. Ajoute google_id, auth_provider, last_login_at sur `users` (si absentes)
 * 2. Ajoute un index unique sur google_id
 * 3. Ajoute un index unique sur email (garde-fou : refuse si des doublons
 *    existent déjà — à nettoyer manuellement avant de relancer)
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

async function columnExists(table, column) {
  const [rows] = await seq.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    { replacements: [table, column] }
  );
  return rows.length > 0;
}

async function indexExists(table, indexName) {
  const [rows] = await seq.query(
    `SELECT DISTINCT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    { replacements: [table, indexName] }
  );
  return rows.length > 0;
}

async function addColumnIfMissing(table, column, definition, afterCol) {
  if (await columnExists(table, column)) {
    console.log(`  · ${table}.${column} déjà présent`);
    return;
  }
  const after = afterCol ? `AFTER \`${afterCol}\`` : '';
  await seq.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition} ${after}`);
  console.log(`  ✓ ${table}.${column} ajouté`);
}

async function addUniqueIndexIfMissing(table, indexName, column) {
  if (await indexExists(table, indexName)) {
    console.log(`  · index ${indexName} déjà présent`);
    return;
  }
  try {
    await seq.query(`ALTER TABLE \`${table}\` ADD UNIQUE INDEX \`${indexName}\` (\`${column}\`)`);
    console.log(`  ✓ index unique ${indexName} créé`);
  } catch (e) {
    console.warn(`  ! index ${indexName} non créé (probable doublon sur ${column}) : ${e.message}`);
    console.warn(`    → identifiez et corrigez les doublons puis relancez ce script.`);
  }
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── users ────────────────────────────────────────────────────────');
  await addColumnIfMissing('users', 'google_id', 'VARCHAR(255) NULL', 'email_verification_expires');
  await addColumnIfMissing('users', 'auth_provider', "ENUM('local','google') NOT NULL DEFAULT 'local'", 'google_id');
  await addColumnIfMissing('users', 'last_login_at', 'DATETIME NULL', 'auth_provider');

  console.log('\n── index uniques ────────────────────────────────────────────────');
  await addUniqueIndexIfMissing('users', 'uq_users_google_id', 'google_id');

  // email est nullable (staff sans email) — MySQL autorise plusieurs NULL
  // sous un index unique, donc pas d'impact sur les comptes existants sans email.
  const [dupEmails] = await seq.query(
    `SELECT email FROM users WHERE email IS NOT NULL AND email <> '' GROUP BY email HAVING COUNT(*) > 1`
  );
  if (dupEmails.length) {
    console.warn(`  ! ${dupEmails.length} email(s) en doublon détecté(s), index unique email NON créé :`);
    dupEmails.forEach(r => console.warn(`    - ${r.email}`));
  } else {
    await addUniqueIndexIfMissing('users', 'uq_users_email', 'email');
  }

  console.log('\n✓ Migration Google Auth terminée.');
  await seq.close();
}

run().catch(e => {
  console.error('ERREUR migration Google Auth :', e);
  process.exit(1);
});
