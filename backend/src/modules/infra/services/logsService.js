'use strict';

/**
 * Explorateur de logs — lit directement les fichiers PM2 réels
 * (~/.pm2/logs/<app>-out.log / -error.log, confirmés lisibles par
 * l'utilisateur applicatif). L'app n'utilise aucun logger structuré
 * (pas de winston/pino, vérifié) : le niveau est déduit heuristiquement du
 * fichier d'origine (-error.log → ERROR par défaut, -out.log → INFO) puis
 * affiné par mots-clés présents dans la ligne — jamais fabriqué.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const LOG_DIR = path.join(os.homedir(), '.pm2', 'logs');
const TAIL_BYTES = 300 * 1024; // ~300KB suffisent pour quelques centaines de lignes récentes

function detectLevel(line, defaultLevel) {
  const upper = line.toUpperCase();
  if (upper.includes('CRITICAL') || upper.includes('FATAL')) return 'CRITICAL';
  if (upper.includes('ERROR') || upper.includes('ERREUR') || upper.includes('EXCEPTION')) return 'ERROR';
  if (upper.includes('WARN')) return 'WARNING';
  if (upper.includes('INFO')) return 'INFO';
  return defaultLevel;
}

function readTail(filePath) {
  const stat = fs.statSync(filePath);
  const start = Math.max(0, stat.size - TAIL_BYTES);
  const fd = fs.openSync(filePath, 'r');
  const length = stat.size - start;
  const buffer = Buffer.alloc(length);
  fs.readSync(fd, buffer, 0, length, start);
  fs.closeSync(fd);
  const text = buffer.toString('utf8');
  const lines = text.split('\n');
  if (start > 0) lines.shift(); // première ligne probablement tronquée
  return lines.filter(Boolean);
}

function listApps() {
  if (!fs.existsSync(LOG_DIR)) return [];
  const files = fs.readdirSync(LOG_DIR);
  const apps = new Set();
  files.forEach(f => {
    const m = f.match(/^(.+)-(out|error)\.log$/);
    if (m) apps.add(m[1]);
  });
  return [...apps].sort();
}

function getLogs({ app, level, search, limit = 200 } = {}) {
  const apps = app ? [app] : listApps();
  let lines = [];

  for (const appName of apps) {
    for (const kind of ['out', 'error']) {
      const filePath = path.join(LOG_DIR, `${appName}-${kind}.log`);
      if (!fs.existsSync(filePath)) continue;
      const defaultLevel = kind === 'error' ? 'ERROR' : 'INFO';
      try {
        const raw = readTail(filePath);
        raw.forEach(text => {
          const tsMatch = text.match(/^\[([\d\-T:.Z]+)\]/);
          lines.push({
            app: appName,
            source: kind,
            level: detectLevel(text, defaultLevel),
            ts: tsMatch ? tsMatch[1] : null,
            text: text.slice(0, 2000),
          });
        });
      } catch { /* fichier illisible — ignoré */ }
    }
  }

  if (level) lines = lines.filter(l => l.level === level.toUpperCase());
  if (search) {
    const q = search.toLowerCase();
    lines = lines.filter(l => l.text.toLowerCase().includes(q));
  }

  // Les lignes horodatées sont triées chronologiquement ; celles sans
  // timestamp reconnu gardent leur ordre de lecture (fin de fichier = plus récent).
  lines.sort((a, b) => {
    if (a.ts && b.ts) return a.ts.localeCompare(b.ts);
    return 0;
  });

  return lines.slice(-Math.min(limit, 1000));
}

module.exports = { getLogs, listApps };
