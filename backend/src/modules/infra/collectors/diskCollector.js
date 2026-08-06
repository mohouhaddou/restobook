'use strict';

/**
 * Utilisation disque — `df` pour les partitions, `du` ciblé sur une liste
 * connue de dossiers (pas de scan récursif complet du disque, trop coûteux
 * sur ce VPS à 2 vCPU) pour les "top dossiers". Aucune privilège élevé requis.
 */
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

async function getPartitions() {
  const out = await run('df', ['-hP']);
  const lines = out.trim().split('\n').slice(1);
  return lines
    .map(line => {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 6) return null;
      const [filesystem, size, used, avail, pctStr, mount] = cols;
      // Ignore les pseudo-filesystems (tmpfs, devtmpfs, overlay de conteneurs...) sans intérêt pour le SuperAdmin
      if (['tmpfs', 'devtmpfs', 'overlay', 'squashfs'].some(fs => filesystem.startsWith(fs))) return null;
      return { filesystem, size, used, avail, pct: Number(pctStr.replace('%', '')), mount };
    })
    .filter(Boolean);
}

// Dossiers connus pertinents pour ce VPS mutualisé (voir recherche : restobook,
// farmmonitor et tts-app cohabitent sur la même machine).
const WATCHED_FOLDERS = ['/var/www/restobook', '/var/www/farmmonitor', '/var/www/tts-app'];

async function getTopFolders() {
  const results = [];
  for (const folder of WATCHED_FOLDERS) {
    if (!fs.existsSync(folder)) continue;
    try {
      const out = await run('du', ['-sb', folder]);
      const [sizeStr] = out.trim().split(/\s+/);
      results.push({ path: folder, size_bytes: Number(sizeStr) || 0 });
    } catch { /* dossier illisible — ignoré silencieusement */ }
  }
  return results.sort((a, b) => b.size_bytes - a.size_bytes);
}

// Logs PM2 volumineux (>10MB) — utile pour anticiper un futur nettoyage automatique.
async function getLargeLogs(thresholdBytes = 10 * 1024 * 1024) {
  const logDir = path.join(require('os').homedir(), '.pm2', 'logs');
  if (!fs.existsSync(logDir)) return [];
  const files = fs.readdirSync(logDir);
  return files
    .map(name => {
      try {
        const stat = fs.statSync(path.join(logDir, name));
        return { name, size_bytes: stat.size, modified_at: stat.mtime };
      } catch { return null; }
    })
    .filter(f => f && f.size_bytes > thresholdBytes)
    .sort((a, b) => b.size_bytes - a.size_bytes);
}

module.exports = { getPartitions, getTopFolders, getLargeLogs };
