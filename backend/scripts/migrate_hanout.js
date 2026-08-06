#!/usr/bin/env node
'use strict';
/**
 * Migration Hanout — crée les tables hanout_categories, hanout_products,
 * hanout_orders, hanout_order_items si elles n'existent pas.
 *
 * Usage : node backend/scripts/migrate_hanout.js [--force]
 * --force : ALTER TABLE (ajoute colonnes manquantes) — prudent en prod
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { sequelize, HanoutCategory, HanoutProduct, HanoutOrder, HanoutOrderItem } = require('../models');

const force = process.argv.includes('--force');
const alter = process.argv.includes('--alter');

async function main() {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connectée');

    // Sync dans l'ordre des FK
    await HanoutCategory.sync({ force, alter });
    console.log('✅ hanout_categories OK');

    await HanoutProduct.sync({ force, alter });
    console.log('✅ hanout_products OK');

    await HanoutOrder.sync({ force, alter });
    console.log('✅ hanout_orders OK');

    await HanoutOrderItem.sync({ force, alter });
    console.log('✅ hanout_order_items OK');

    console.log('\n🎉 Migration Hanout terminée\n');
    process.exit(0);
  } catch (e) {
    console.error('❌ Erreur migration :', e.message);
    process.exit(1);
  }
}

main();
