'use strict';

/**
 * Introspection MySQL — via la connexion Sequelize existante de l'app
 * (utilisateur `restouser`, droits scopés à la base `restobook`, confirmé en
 * direct : SHOW STATUS/VARIABLES/information_schema fonctionnent tous).
 * LIMITE HONNÊTE : SHOW PROCESSLIST ne verra que les connexions de cette app,
 * pas l'ensemble du serveur (pas de privilège PROCESS global) — reflété dans
 * `limitations` plutôt que présenté comme une vue serveur complète.
 */
const { sequelize } = require('../../../../models');

let lastQuestions = null; // { value, ts } — pour calculer un débit requêtes/s par delta

async function statusVar(name) {
  const [rows] = await sequelize.query('SHOW GLOBAL STATUS LIKE ?', { replacements: [name] });
  return rows[0] ? Number(rows[0].Value) : null;
}
async function variableVar(name) {
  const [rows] = await sequelize.query('SHOW VARIABLES LIKE ?', { replacements: [name] });
  return rows[0] ? rows[0].Value : null;
}

async function getDatabaseMetrics() {
  try {
    const [[versionRow]] = await sequelize.query('SELECT VERSION() AS v');
    const connections = await statusVar('Threads_connected');
    const maxConnections = await variableVar('max_connections');
    const slowQueries = await statusVar('Slow_queries');
    const uptimeS = await statusVar('Uptime');
    const questions = await statusVar('Questions');
    const innodbLockWaits = await statusVar('Innodb_row_lock_current_waits');

    let queriesPerSec = null;
    const now = Date.now();
    if (lastQuestions && questions != null) {
      const elapsedS = (now - lastQuestions.ts) / 1000;
      if (elapsedS > 0) queriesPerSec = Number(((questions - lastQuestions.value) / elapsedS).toFixed(2));
    }
    if (questions != null) lastQuestions = { value: questions, ts: now };

    const [tableRows] = await sequelize.query(`
      SELECT TABLE_NAME AS name, TABLE_ROWS AS row_count,
             (DATA_LENGTH + INDEX_LENGTH) AS size_bytes
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY size_bytes DESC
      LIMIT 10
    `);
    const [[totalRow]] = await sequelize.query(`
      SELECT SUM(DATA_LENGTH + INDEX_LENGTH) AS total_bytes, COUNT(*) AS table_count
      FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
    `);

    return {
      status: 'up',
      version: versionRow?.v || null,
      connections,
      max_connections: maxConnections != null ? Number(maxConnections) : null,
      queries_per_sec: queriesPerSec,
      slow_queries: slowQueries,
      locks_current: innodbLockWaits,
      uptime_s: uptimeS,
      size_bytes: totalRow?.total_bytes ? Number(totalRow.total_bytes) : 0,
      table_count: totalRow?.table_count || 0,
      tables: tableRows.map(t => ({ name: t.name, rows: Number(t.row_count) || 0, size_bytes: Number(t.size_bytes) || 0 })),
      limitations: [
        "Connexions et processus limités à ceux de cette application (droit MySQL scopé à la base restobook, pas de vue serveur globale)."
      ],
    };
  } catch (e) {
    return { status: 'down', error: e.message, limitations: [] };
  }
}

module.exports = { getDatabaseMetrics };
