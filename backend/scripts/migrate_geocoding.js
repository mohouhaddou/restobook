'use strict';

/**
 * Migration geocoding — Idempotente
 *
 * 1. MODIFY latitude/longitude pour plus de précision (DECIMAL 10,8 / 11,8)
 * 2. Ajoute formatted_address, geocoding_source, geocoding_updated_at
 *    sur les tables organizations et businesses (si absentes)
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

async function addColumnIfMissing(table, column, definition, afterCol) {
  const exists = await columnExists(table, column);
  if (exists) {
    console.log(`  · ${table}.${column} déjà présent`);
    return;
  }
  const after = afterCol ? `AFTER \`${afterCol}\`` : '';
  await seq.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition} ${after}`);
  console.log(`  ✓ ${table}.${column} ajouté`);
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  for (const table of ['organizations', 'businesses']) {
    console.log(`── ${table} ─────────────────────────────────────────────────────────`);

    // 1. MODIFY latitude / longitude pour augmenter la précision
    console.log(`  → MODIFY latitude/longitude sur ${table}…`);
    try {
      await seq.query(
        `ALTER TABLE \`${table}\`
           MODIFY COLUMN \`latitude\`  DECIMAL(10,8) NULL,
           MODIFY COLUMN \`longitude\` DECIMAL(11,8) NULL`
      );
      console.log(`  ✓ latitude/longitude modifiés`);
    } catch (e) {
      console.warn(`  ! MODIFY échoué (peut-être colonne absente) : ${e.message}`);
    }

    // 2. formatted_address
    await addColumnIfMissing(table, 'formatted_address', 'VARCHAR(500) NULL', 'longitude');

    // 3. geocoding_source
    await addColumnIfMissing(table, 'geocoding_source', "ENUM('nominatim','manual','gps') NULL", 'formatted_address');

    // 4. geocoding_updated_at
    await addColumnIfMissing(table, 'geocoding_updated_at', 'DATETIME NULL', 'geocoding_source');

    console.log('');
  }

  console.log('✓ Migration geocoding terminée.');
  await seq.close();
}

run().catch(e => {
  console.error('ERREUR migration geocoding :', e);
  process.exit(1);
});
