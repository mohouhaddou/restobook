'use strict';

const sequelize = require('../../../../models/db');

async function query(sql, replacements = {}, transaction = undefined) {
  const [rows] = await sequelize.query(sql, { replacements, transaction });
  return rows;
}

async function one(sql, replacements = {}, transaction = undefined) {
  const rows = await query(sql, replacements, transaction);
  return rows[0] || null;
}

async function exec(sql, replacements = {}, transaction = undefined) {
  return sequelize.query(sql, { replacements, transaction });
}

module.exports = { exec, one, query, sequelize };
