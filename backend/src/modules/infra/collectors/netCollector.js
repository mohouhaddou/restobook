'use strict';

/**
 * Débit réseau — /proc/net/dev (confirmé lisible sans privilège), delta entre
 * deux lectures pour obtenir un débit en octets/s. Même logique stateful que
 * cpuMemCollector.js. "Top IPs/pays/endpoints" ne sont PAS calculables ici —
 * rien ne journalise l'IP source par requête aujourd'hui (voir InfraNetworkPage,
 * qui affiche cette limitation honnêtement plutôt que de l'inventer).
 */
const fs = require('fs');

let lastSample = null; // { ts, interfaces: { eth0: {rx,tx}, ... } }

function readProcNetDev() {
  const raw = fs.readFileSync('/proc/net/dev', 'utf8');
  const lines = raw.split('\n').slice(2); // 2 lignes d'en-tête
  const interfaces = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [name, rest] = trimmed.split(':');
    if (!rest) continue;
    const cols = rest.trim().split(/\s+/).map(Number);
    // Format: rx_bytes rx_packets rx_errs rx_drop ... tx_bytes tx_packets ...
    interfaces[name.trim()] = { rx_bytes: cols[0] || 0, tx_bytes: cols[8] || 0 };
  }
  return interfaces;
}

function getNetworkThroughput() {
  const now = Date.now();
  let current;
  try { current = readProcNetDev(); } catch { return { interfaces: [] }; }

  if (!lastSample) {
    lastSample = { ts: now, interfaces: current };
    return {
      interfaces: Object.keys(current)
        .filter(name => name !== 'lo')
        .map(name => ({ name, rx_bytes_total: current[name].rx_bytes, tx_bytes_total: current[name].tx_bytes, rx_rate_bps: null, tx_rate_bps: null })),
    };
  }

  const elapsedS = Math.max(0.001, (now - lastSample.ts) / 1000);
  const interfaces = Object.keys(current)
    .filter(name => name !== 'lo')
    .map(name => {
      const prev = lastSample.interfaces[name];
      const rx_rate_bps = prev ? Math.max(0, Math.round(((current[name].rx_bytes - prev.rx_bytes) * 8) / elapsedS)) : null;
      const tx_rate_bps = prev ? Math.max(0, Math.round(((current[name].tx_bytes - prev.tx_bytes) * 8) / elapsedS)) : null;
      return { name, rx_bytes_total: current[name].rx_bytes, tx_bytes_total: current[name].tx_bytes, rx_rate_bps, tx_rate_bps };
    });

  lastSample = { ts: now, interfaces: current };
  return { interfaces };
}

module.exports = { getNetworkThroughput };
