'use strict';

require('dotenv').config();
const { Sequelize } = require('sequelize');

const seq = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',
    logging: false,
  }
);

async function addColumnIfMissing(qi, table, column, definition) {
  const columns = await qi.describeTable(table);
  if (columns[column]) {
    console.log(`  (deja presente) ${table}.${column}`);
    return;
  }
  await qi.addColumn(table, column, definition);
  console.log(`✓ Colonne ajoutee: ${table}.${column}`);
}

async function run() {
  await seq.authenticate();
  const qi = seq.getQueryInterface();

  await addColumnIfMissing(qi, 'menu_items', 'proteines_g', { type: Sequelize.DECIMAL(8, 2), allowNull: true });
  await addColumnIfMissing(qi, 'menu_items', 'glucides_g', { type: Sequelize.DECIMAL(8, 2), allowNull: true });
  await addColumnIfMissing(qi, 'menu_items', 'lipides_g', { type: Sequelize.DECIMAL(8, 2), allowNull: true });
  await addColumnIfMissing(qi, 'menu_items', 'health_score', { type: Sequelize.INTEGER, allowNull: true });
  await addColumnIfMissing(qi, 'menu_items', 'nutrition_analysis', { type: Sequelize.JSON, allowNull: true });
  await addColumnIfMissing(qi, 'menu_items', 'nutrition_analyzed_at', { type: Sequelize.DATE, allowNull: true });

  console.log('Nutrition AI schema OK');
  await seq.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
