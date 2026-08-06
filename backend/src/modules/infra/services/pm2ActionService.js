'use strict';

/**
 * Actions PM2 (restart/stop/reload) — TOUJOURS revalidées contre un `pm2
 * jlist` frais avant exécution : le nom de process reçu du client n'est
 * jamais interpolé directement dans une commande, il doit d'abord matcher un
 * process réellement présent dans la liste actuelle. `execFile` uniquement
 * (jamais de chaîne shell) — élimine toute possibilité d'injection.
 */
const { execFile } = require('child_process');
const { getProcessList } = require('../collectors/pm2Collector');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 15000 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

class PosError extends Error {}

async function assertKnownProcess(name) {
  const list = await getProcessList();
  const found = list.find(p => p.name === name);
  if (!found) {
    const err = new PosError('SERVICE_NOT_FOUND');
    err.statusCode = 404;
    throw err;
  }
  return found;
}

async function restartProcess(name) {
  await assertKnownProcess(name);
  await run('pm2', ['restart', name]);
  const [after] = (await getProcessList()).filter(p => p.name === name);
  return { ok: true, name, pid: after?.pid || null, status: after?.status || null };
}

async function stopProcess(name) {
  await assertKnownProcess(name);
  await run('pm2', ['stop', name]);
  return { ok: true, name, status: 'stopped' };
}

async function reloadProcess(name) {
  await assertKnownProcess(name);
  await run('pm2', ['reload', name]);
  const [after] = (await getProcessList()).filter(p => p.name === name);
  return { ok: true, name, pid: after?.pid || null, status: after?.status || null };
}

module.exports = { restartProcess, stopProcess, reloadProcess, PosError };
