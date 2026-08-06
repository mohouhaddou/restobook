#!/usr/bin/env node
'use strict';

/**
 * Migration code-barres — idempotente.
 * Ajoute barcode(+métadonnées) à hanout_products, et les métadonnées à
 * pharmacy_medicines (qui a déjà une colonne barcode). Ne touche jamais aux
 * plats/menus (menu_items) : hors-scope volontaire.
 *
 * Backfill : ne copie sku→barcode (hanout) que si la valeur passe la
 * validation de format EAN/UPC/GTIN — jamais de génération artificielle.
 *
 * Usage : node scripts/migrate_barcode.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Sequelize } = require('sequelize');
const { normalizeBarcode, detectBarcodeType, validateBarcode } = require('../src/shared/utils/barcode');

const seq = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql', logging: false }
);

async function colExists(table, col) {
  const [r] = await seq.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,
    { replacements: [table, col] }
  );
  return r.length > 0;
}
async function indexExists(table, name) {
  const [r] = await seq.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?`,
    { replacements: [table, name] }
  );
  return r.length > 0;
}
async function addCol(table, col, def) {
  if (await colExists(table, col)) { console.log(`  · ${table}.${col} déjà présent`); return; }
  await seq.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`);
  console.log(`  ✓ ${table}.${col} ajouté`);
}

/**
 * Cherche les doublons (organization_id, barcode) sur une table.
 * Pose un index UNIQUE si aucun doublon, sinon un index simple + avertissement.
 */
async function indexOrWarnDuplicates(table) {
  const [dupes] = await seq.query(
    `SELECT organization_id, barcode, COUNT(*) AS cnt
     FROM \`${table}\`
     WHERE barcode IS NOT NULL AND barcode <> ''
     GROUP BY organization_id, barcode
     HAVING COUNT(*) > 1`
  );

  const uniqueIndexName = `uq_${table}_org_barcode`;
  const plainIndexName  = `idx_${table}_org_barcode`;

  if (dupes.length > 0) {
    console.log(`  ⚠️  ${dupes.length} doublon(s) de code-barres détecté(s) dans ${table} — index UNIQUE non posé :`);
    for (const d of dupes) console.log(`      organization_id=${d.organization_id} barcode=${d.barcode} (${d.cnt}x)`);
    console.log(`      → Corrigez ces doublons puis relancez ce script pour poser l'index UNIQUE.`);
    if (!(await indexExists(table, plainIndexName)) && !(await indexExists(table, uniqueIndexName))) {
      await seq.query(`ALTER TABLE \`${table}\` ADD INDEX \`${plainIndexName}\` (organization_id, barcode)`);
      console.log(`  ✓ Index simple ${plainIndexName} posé (en attendant la résolution des doublons)`);
    }
  } else if (await indexExists(table, uniqueIndexName)) {
    console.log(`  · Index UNIQUE ${uniqueIndexName} déjà présent`);
  } else {
    if (await indexExists(table, plainIndexName)) {
      await seq.query(`ALTER TABLE \`${table}\` DROP INDEX \`${plainIndexName}\``);
    }
    await seq.query(`ALTER TABLE \`${table}\` ADD UNIQUE INDEX \`${uniqueIndexName}\` (organization_id, barcode)`);
    console.log(`  ✓ Index UNIQUE ${uniqueIndexName} posé (aucun doublon)`);
  }
}

async function backfillHanoutFromSku() {
  const [rows] = await seq.query(
    `SELECT id, sku FROM hanout_products WHERE sku IS NOT NULL AND sku <> '' AND (barcode IS NULL OR barcode = '')`
  );
  let migrated = 0;
  for (const row of rows) {
    const normalized = normalizeBarcode(row.sku);
    const type = detectBarcodeType(normalized);
    const { valid } = validateBarcode(normalized, type);
    // On ne migre que les formats numériques reconnus (EAN/UPC/GTIN) — jamais CODE128/UNKNOWN
    // depuis un simple champ "référence interne" pour éviter de faire passer une réf. libre pour un vrai code produit.
    if (valid && ['EAN13', 'EAN8', 'UPC_A', 'UPC_E', 'GTIN'].includes(type)) {
      await seq.query(
        `UPDATE hanout_products SET barcode=?, barcode_type=?, barcode_source='MANUAL' WHERE id=?`,
        { replacements: [normalized, type, row.id] }
      );
      migrated++;
    }
  }
  console.log(`  ✓ ${migrated}/${rows.length} sku hanout reconnus comme code-barres et migrés (les autres restent des références internes)`);
}

async function backfillPharmacyMetadata() {
  const [rows] = await seq.query(
    `SELECT id, barcode FROM pharmacy_medicines WHERE barcode IS NOT NULL AND barcode <> '' AND barcode_type IS NULL`
  );
  for (const row of rows) {
    const normalized = normalizeBarcode(row.barcode);
    const type = detectBarcodeType(normalized);
    await seq.query(
      `UPDATE pharmacy_medicines SET barcode_type=?, barcode_source='MANUAL', barcode_verified=false WHERE id=?`,
      { replacements: [type, row.id] }
    );
  }
  console.log(`  ✓ ${rows.length} code-barres pharmacie existants annotés (type détecté, source=MANUAL)`);
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── 1. hanout_products ────────────────────────────────────────');
  await addCol('hanout_products', 'barcode', 'VARCHAR(32) DEFAULT NULL');
  await addCol('hanout_products', 'barcode_type', "ENUM('EAN13','EAN8','UPC_A','UPC_E','GTIN','CODE128','UNKNOWN') DEFAULT NULL");
  await addCol('hanout_products', 'barcode_source', "ENUM('MANUAL','SCAN','IMPORT','GENERATED') DEFAULT NULL");
  await addCol('hanout_products', 'barcode_verified', 'TINYINT(1) NOT NULL DEFAULT 0');

  console.log('\n── 2. pharmacy_medicines ─────────────────────────────────────');
  await addCol('pharmacy_medicines', 'barcode_type', "ENUM('EAN13','EAN8','UPC_A','UPC_E','GTIN','CODE128','UNKNOWN') DEFAULT NULL");
  await addCol('pharmacy_medicines', 'barcode_source', "ENUM('MANUAL','SCAN','IMPORT','GENERATED') DEFAULT NULL");
  await addCol('pharmacy_medicines', 'barcode_verified', 'TINYINT(1) NOT NULL DEFAULT 0');

  console.log('\n── 3. Backfill hanout_products.sku → barcode (formats valides uniquement) ──');
  await backfillHanoutFromSku();

  console.log('\n── 4. Backfill métadonnées pharmacy_medicines.barcode ─────────');
  await backfillPharmacyMetadata();

  console.log('\n── 5. Détection de doublons + index ────────────────────────────');
  await indexOrWarnDuplicates('hanout_products');
  await indexOrWarnDuplicates('pharmacy_medicines');

  console.log('\n✅ Migration code-barres terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
