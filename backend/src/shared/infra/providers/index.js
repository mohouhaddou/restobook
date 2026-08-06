'use strict';

/**
 * Point d'accès UNIQUE à un fournisseur de métriques — routes/pollers ne
 * doivent jamais importer LocalProcMetricsProvider (ni aucune future
 * implémentation) directement. Basculer vers Prometheus/multi-VPS plus tard
 * ne touchera que ce fichier.
 */
const LocalProcMetricsProvider = require('./LocalProcMetricsProvider');

let instance = null;

function getMetricsProvider() {
  if (!instance) {
    // process.env.METRICS_PROVIDER réservé pour une future bascule (ex: 'prometheus')
    instance = new LocalProcMetricsProvider();
  }
  return instance;
}

module.exports = { getMetricsProvider };
