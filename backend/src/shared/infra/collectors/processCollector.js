'use strict';

/**
 * Nombre de process système + uptime machine — comptage des sous-dossiers
 * numériques de /proc (= un PID chacun), lecture directe sans shell-out.
 */
const fs = require('fs');
const os = require('os');

function getProcessCount() {
  try {
    return fs.readdirSync('/proc').filter(name => /^\d+$/.test(name)).length;
  } catch { return null; }
}

function getSystemUptime() {
  return Math.round(os.uptime());
}

module.exports = { getProcessCount, getSystemUptime };
