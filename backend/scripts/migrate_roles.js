'use strict';

/**
 * Migration RBAC — étend users.role avec les rôles SaaS multi-produits.
 * Idempotente : peut être relancée sans risque.
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');
const { USER_ROLE_VALUES } = require('../auth/permissions');

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

async function run() {
  await seq.authenticate();

  const enumSql = USER_ROLE_VALUES.map(role => `'${role}'`).join(',');
  await seq.query(`
    ALTER TABLE users
    MODIFY COLUMN role ENUM(${enumSql}) NOT NULL DEFAULT 'employee'
  `);

  console.log(`RBAC roles OK: ${USER_ROLE_VALUES.join(', ')}`);
  await seq.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
