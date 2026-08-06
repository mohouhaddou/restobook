'use strict';

/**
 * CPU/RAM/swap/charge — lecture directe de /proc/stat et /proc/meminfo
 * (confirmés lisibles sans privilège sur ce VPS), pas de dépendance externe.
 * Le % CPU nécessite un delta entre deux lectures : ce module garde le
 * dernier échantillon en mémoire (process singleton), le premier appel
 * renvoie donc cpu_pct=null le temps d'obtenir un deuxième point de mesure.
 */
const fs = require('fs');
const os = require('os');

let lastCpuTimes = null;

function readProcStatCpuLine() {
  const stat = fs.readFileSync('/proc/stat', 'utf8');
  const line = stat.split('\n')[0]; // "cpu  user nice system idle iowait irq softirq steal guest guest_nice"
  const parts = line.trim().split(/\s+/).slice(1).map(Number);
  const [user, nice, system, idle, iowait, irq, softirq, steal] = parts;
  const idleTime = (idle || 0) + (iowait || 0);
  const totalTime = (user || 0) + (nice || 0) + (system || 0) + idleTime + (irq || 0) + (softirq || 0) + (steal || 0);
  return { idleTime, totalTime };
}

function getCpuPercent() {
  let current;
  try { current = readProcStatCpuLine(); } catch { return null; }
  if (!lastCpuTimes) { lastCpuTimes = current; return null; }
  const idleDelta = current.idleTime - lastCpuTimes.idleTime;
  const totalDelta = current.totalTime - lastCpuTimes.totalTime;
  lastCpuTimes = current;
  if (totalDelta <= 0) return null;
  const usage = 1 - idleDelta / totalDelta;
  return Math.max(0, Math.min(100, Number((usage * 100).toFixed(1))));
}

function getMemInfo() {
  const raw = fs.readFileSync('/proc/meminfo', 'utf8');
  const map = {};
  raw.split('\n').forEach(line => {
    const m = line.match(/^(\w+):\s+(\d+)\s*kB?/);
    if (m) map[m[1]] = Number(m[2]) * 1024; // kB -> bytes
  });
  const total = map.MemTotal || 0;
  const available = map.MemAvailable != null ? map.MemAvailable : (map.MemFree || 0);
  const used = Math.max(0, total - available);
  const swapTotal = map.SwapTotal || 0;
  const swapFree = map.SwapFree || 0;
  const swapUsed = Math.max(0, swapTotal - swapFree);
  return {
    total_bytes: total,
    used_bytes: used,
    free_bytes: available,
    pct: total > 0 ? Number(((used / total) * 100).toFixed(1)) : null,
    swap_total_bytes: swapTotal,
    swap_used_bytes: swapUsed,
    swap_pct: swapTotal > 0 ? Number(((swapUsed / swapTotal) * 100).toFixed(1)) : 0,
  };
}

function getLoadAvg() {
  const [load1, load5, load15] = os.loadavg();
  return { load1: Number(load1.toFixed(2)), load5: Number(load5.toFixed(2)), load15: Number(load15.toFixed(2)) };
}

// Non disponible sur ce VPS virtualisé (pas de /sys/class/thermal/thermal_zone*
// exposé — vérifié en direct) : renvoie null plutôt que d'inventer une valeur.
function getCpuTemperature() {
  try {
    const raw = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8');
    const v = Number(raw.trim());
    return Number.isFinite(v) ? Number((v / 1000).toFixed(1)) : null;
  } catch { return null; }
}

module.exports = { getCpuPercent, getMemInfo, getLoadAvg, getCpuTemperature };
