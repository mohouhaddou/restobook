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

  await addColumnIfMissing(qi, 'reviews', 'item_ratings', { type: Sequelize.JSON, allowNull: true });
  await addColumnIfMissing(qi, 'reviews', 'sentiment', { type: Sequelize.ENUM('positive', 'neutral', 'negative'), allowNull: true });
  await addColumnIfMissing(qi, 'reviews', 'sentiment_score', { type: Sequelize.DECIMAL(5, 2), allowNull: true });
  await addColumnIfMissing(qi, 'reviews', 'issue_tags', { type: Sequelize.JSON, allowNull: true });
  await addColumnIfMissing(qi, 'reviews', 'ai_summary', { type: Sequelize.JSON, allowNull: true });
  await addColumnIfMissing(qi, 'reviews', 'analyzed_at', { type: Sequelize.DATE, allowNull: true });

  console.log('Satisfaction schema OK');
  await seq.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
