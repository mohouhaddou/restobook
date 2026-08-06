'use strict';

/**
 * Liste des process PM2 — shell out vers le binaire CLI `pm2` (aucun package
 * npm `pm2` programmatique n'est installé, et il n'est pas nécessaire d'en
 * ajouter un rien que pour lire un `jlist`). `execFile` uniquement (jamais de
 * chaîne shell interpolée) et FILTRE ALLOWLIST STRICT en sortie : le JSON brut
 * de `pm2 jlist` contient `pm2_env.env` avec le JWT_SECRET et d'autres
 * secrets en clair (vérifié en direct pendant la recherche) — ce module ne
 * les fait jamais transiter, ni vers l'API, ni vers un log.
 */
const { execFile } = require('child_process');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

function toSafeProcess(p) {
  const env = p.pm2_env || {};
  return {
    id: p.pm_id,
    name: p.name,
    pid: p.pid || null,
    status: env.status || 'unknown',
    cpu_pct: p.monit ? p.monit.cpu : null,
    mem_bytes: p.monit ? p.monit.memory : null,
    restarts: env.restart_time ?? 0,
    uptime_s: env.pm_uptime ? Math.max(0, Math.round((Date.now() - env.pm_uptime) / 1000)) : null,
    version: env.version || null,
    exec_mode: env.exec_mode || null,
    node_version: env.node_version || null,
    // JAMAIS env.env, JAMAIS env.PM2_HOME, etc. — allowlist stricte ci-dessus uniquement.
  };
}

async function getProcessList() {
  const out = await run('pm2', ['jlist']);
  let parsed;
  try { parsed = JSON.parse(out); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  return parsed.map(toSafeProcess);
}

module.exports = { getProcessList };
