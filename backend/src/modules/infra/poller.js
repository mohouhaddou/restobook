'use strict';

/**
 * Collecte centralisée temps réel — UN SEUL intervalle rapide et UN SEUL
 * intervalle lent tournent pour tout le serveur, peu importe le nombre de
 * SuperAdmin connectés en même temps (diffusion via la room Socket.IO
 * 'superadmin:infra'). Essentiel sur ce VPS à 2 vCPU / 1.9 Go RAM : jamais un
 * poll par client.
 *
 * Boucle rapide (6s)  : CPU/RAM/services — tout est lecture /proc + `pm2
 *   jlist`, peu coûteux — + évaluation des règles d'alerte.
 * Boucle lente (5min) : DB/réseau/disque/SSL (introspection plus coûteuse) +
 *   persistance d'une ligne d'historique (infra_metric_snapshots) + purge
 *   des lignes de plus de 400 jours.
 */
const { Op } = require('sequelize');
const { getMetricsProvider } = require('./providers');
const { computeHealthScore } = require('./services/healthScoreService');
const alertEngineService = require('./services/alertEngineService');
const { InfraMetricSnapshot } = require('../../../models');

const FAST_INTERVAL_MS = 6000;
const SLOW_INTERVAL_MS = 5 * 60 * 1000;
const SNAPSHOT_RETENTION_DAYS = 400;

let started = false;

// État "meilleure valeur connue" partagé entre les deux boucles — le score de
// santé et les alertes combinent toujours le dernier échantillon rapide
// (CPU/RAM) avec le dernier échantillon lent (disque/BD/SSL), plutôt que de
// tout re-mesurer à chaque tick.
const state = {
  fast: { cpu_pct: null, mem_pct: null, swap_pct: null, load1: null },
  slow: { disk_pct: null, db_up: null, db_size_bytes: null, ssl_days_remaining: null, net: null },
};

function currentHealth(servicesOnline, servicesTotal) {
  return computeHealthScore({
    cpu_pct: state.fast.cpu_pct,
    mem_pct: state.fast.mem_pct,
    disk_pct: state.slow.disk_pct,
    services_online: servicesOnline,
    services_total: servicesTotal,
    db_up: state.slow.db_up,
    ssl_days_remaining: state.slow.ssl_days_remaining,
  });
}

async function fastTick(io, provider) {
  try {
    const [server, services] = await Promise.all([provider.getServerMetrics(), provider.getServiceList()]);
    state.fast = { cpu_pct: server.cpu_pct, mem_pct: server.mem_pct, swap_pct: server.swap_pct, load1: server.load1 };

    const servicesOnline = services.filter(s => s.status === 'online').length;
    const health = currentHealth(servicesOnline, services.length);

    io.to('superadmin:infra').emit('infra:metrics', { server, services, health, timestamp: server.timestamp });

    const backupService = require('./services/backupService');
    await alertEngineService.evaluate({
      server: { cpu_pct: server.cpu_pct, mem_pct: server.mem_pct, api_up: 1 },
      disk: { pct: state.slow.disk_pct },
      services: { down_count: services.length - servicesOnline },
      // state.slow.db_up vaut `null` tant que le premier tick lent n'a pas
      // encore tourné (ex: juste après un redémarrage) — le coder en dur à 0
      // déclencherait une fausse alerte "base arrêtée" à chaque redémarrage.
      database: { up: state.slow.db_up == null ? null : (state.slow.db_up ? 1 : 0) },
      ssl: { days_remaining: state.slow.ssl_days_remaining },
      backup: { last_failed: backupService.wasLastBackupFailed() ? 1 : 0 },
      http: { error_rate_pct: null }, // pas de tracking d'erreurs HTTP en Phase 1 — l'alerte associée ne se déclenche jamais tant que ce n'est pas câblé
    });
  } catch (e) {
    console.error('[infra poller] fastTick error:', e.message);
  }
}

async function slowTick(io, provider) {
  try {
    const [db, disk, ssl, net, services] = await Promise.all([
      provider.getDatabaseMetrics(),
      provider.getDiskMetrics(),
      provider.getSslStatus(),
      provider.getNetworkMetrics(),
      provider.getServiceList(),
    ]);

    const root = disk.partitions.find(p => p.mount === '/') || disk.partitions[0] || {};
    state.slow = {
      disk_pct: root.pct != null ? root.pct : null,
      db_up: db.status === 'up',
      db_size_bytes: db.size_bytes || null,
      ssl_days_remaining: ssl.days_remaining != null ? ssl.days_remaining : null,
      net,
    };

    const servicesOnline = services.filter(s => s.status === 'online').length;
    const health = currentHealth(servicesOnline, services.length);
    const primaryIface = net.interfaces.find(i => i.name === 'eth0') || net.interfaces[0];

    await InfraMetricSnapshot.create({
      captured_at: new Date(),
      cpu_pct: state.fast.cpu_pct,
      mem_pct: state.fast.mem_pct,
      swap_pct: state.fast.swap_pct,
      disk_pct: state.slow.disk_pct,
      load1: state.fast.load1,
      net_rx_bps: primaryIface?.rx_rate_bps ?? null,
      net_tx_bps: primaryIface?.tx_rate_bps ?? null,
      db_size_bytes: state.slow.db_size_bytes,
      health_score: health.score,
      services_online: servicesOnline,
      services_total: services.length,
    });

    await InfraMetricSnapshot.destroy({
      where: { captured_at: { [Op.lt]: new Date(Date.now() - SNAPSHOT_RETENTION_DAYS * 86400000) } },
    });

    io.to('superadmin:infra').emit('infra:metrics:full', { database: db, disk, ssl, network: net, health });
  } catch (e) {
    console.error('[infra poller] slowTick error:', e.message);
  }
}

function start(io) {
  if (started) return; // ne jamais démarrer deux fois (ex: hot-reload accidentel)
  started = true;
  const provider = getMetricsProvider();
  setInterval(() => fastTick(io, provider), FAST_INTERVAL_MS);
  setInterval(() => slowTick(io, provider), SLOW_INTERVAL_MS);
  // Premier tick immédiat de chaque boucle pour ne pas attendre l'intervalle complet au démarrage
  fastTick(io, provider);
  slowTick(io, provider);
  console.log('[infra poller] démarré (rapide: 6s, lent: 5min)');
}

module.exports = { start };
