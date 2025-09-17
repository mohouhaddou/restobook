const { Sequelize } = require('sequelize');
require('dotenv').config();

const host = process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.DB_PORT || 3306);

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host,
    port,
    dialect: 'mysql',
    timezone: process.env.TZ || '+01:00',
    logging: false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    dialectOptions: { connectTimeout: 20000 }
  }
);

module.exports = sequelize;
