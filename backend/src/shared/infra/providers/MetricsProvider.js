'use strict';

/**
 * Contrat abstrait d'un fournisseur de métriques d'infrastructure.
 *
 * AUCUNE route ni composant frontend ne doit jamais appeler un collector ou
 * une commande shell directement — tout passe par une instance de cette
 * classe, obtenue via `getMetricsProvider()` (./index.js). Cela permet de
 * brancher plus tard une autre source (Prometheus, multi-VPS, Kubernetes...)
 * en implémentant simplement une nouvelle sous-classe avec les mêmes
 * méthodes, sans toucher aux routes ni à l'UI.
 *
 * Chaque champ non mesurable par une implémentation donnée doit être renvoyé
 * comme `null`/`'unavailable'` accompagné d'une entrée dans `limitations`,
 * jamais omis ni inventé.
 */
class MetricsProvider {
  async getServerMetrics()      { throw new Error('Not implemented'); }
  async getServiceList()        { throw new Error('Not implemented'); }
  async getDatabaseMetrics()    { throw new Error('Not implemented'); }
  async getNetworkMetrics()     { throw new Error('Not implemented'); }
  async getDiskMetrics()        { throw new Error('Not implemented'); }
  async getSslStatus(domain)    { throw new Error('Not implemented'); }
  async getSecuritySnapshot()   { throw new Error('Not implemented'); }
  async restartService(name)    { throw new Error('Not implemented'); }
  async stopService(name)       { throw new Error('Not implemented'); }
  async reloadService(name)     { throw new Error('Not implemented'); }
  async getServiceLogs(name, opts) { throw new Error('Not implemented'); }
}

module.exports = MetricsProvider;
