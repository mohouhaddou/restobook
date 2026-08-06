#!/usr/bin/env node
'use strict';

/**
 * Etend l'ENUM articles.rubrique avec les nouvelles rubriques editoriales
 * iFilino Discover. Idempotent : relance possible sans effet secondaire.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Sequelize } = require('sequelize');

const seq = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306), dialect: 'mysql', logging: false }
);

const RUBRIQUE_ENUM = "ENUM("
  + "'restaurants_food','courses_epiceries','boucheries','boulangeries',"
  + "'patisseries','cafes','sante_pharmacies','beaute_bien_etre',"
  + "'sport_forme','famille_enfants','maison_deco','sorties_loisirs',"
  + "'shopping','evenements','villes','maroc','conseils_astuces','promotions'"
  + ")";

async function run() {
  await seq.authenticate();
  await seq.query('ALTER TABLE `articles` MODIFY COLUMN `rubrique` ' + RUBRIQUE_ENUM + " NOT NULL DEFAULT 'conseils_astuces'");
  console.log('✓ articles.rubrique etendu avec les nouvelles rubriques magazine');
  await seq.close();
}

run().catch(async e => {
  console.error('❌', e.message);
  try { await seq.close(); } catch {}
  process.exit(1);
});
