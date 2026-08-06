'use strict';

const { execFile } = require('child_process');
const { Op } = require('sequelize');
const MetricsProvider = require('./MetricsProvider');
const cpuMemCollector = require('../collectors/cpuMemCollector');
const netCollector = require('../collectors/netCollector');
const diskCollector = require('../collectors/diskCollector');
const pm2Collector = require('../collectors/pm2Collector');
const dbCollector = require('../collectors/dbCollector');
const sslCollector = require('../collectors/sslCollector');
const processCollector = require('../collectors/processCollector');
const pm2ActionService = require('../services/pm2ActionService');
const logsService = require('../services/logsService');

function checkSystemdActive(unit) {
  return new Promise((resolve) => {
    execFile('systemctl', ['is-active', unit], { timeout: 5000 }, (err, stdout) => {
      resolve(!err && stdout.trim() === 'active');
    });
  });
}

/**
 * Implémentation Phase 1 : ce VPS réel (proc + pm2 CLI + mysql + tls), voir
 * MetricsProvider.js pour le contrat. C'est la SEULE classe autorisée à
 * toucher /proc, exécuter `pm2`/`systemctl`, ou parler à MySQL directement —
 * tout le reste du module passe par ses méthodes.
 */
class LocalProcMetricsProvider extends MetricsProvider {
  async getServerMetrics() {
    const cpu_pct = cpuMemCollector.getCpuPercent();
    const mem = cpuMemCollector.getMemInfo();
    const load = cpuMemCollector.getLoadAvg();
    return {
      cpu_pct,
      mem_pct: mem.pct,
      mem_total_bytes: mem.total_bytes,
      mem_used_bytes: mem.used_bytes,
      swap_pct: mem.swap_pct,
      swap_total_bytes: mem.swap_total_bytes,
      swap_used_bytes: mem.swap_used_bytes,
      load1: load.load1, load5: load.load5, load15: load.load15,
      cpu_temp_c: cpuMemCollector.getCpuTemperature(),
      uptime_s: processCollector.getSystemUptime(),
      process_count: processCollector.getProcessCount(),
      api_up: true, // ce code s'exécute dans le process qui sert l'API — il est forcément up
      timestamp: new Date().toISOString(),
    };
  }

  async getServiceList() {
    const pm2List = await pm2Collector.getProcessList().catch(() => []);
    const services = pm2List.map(p => ({
      id: `pm2:${p.name}`,
      name: p.name,
      kind: 'pm2',
      status: p.status === 'online' ? 'online' : 'offline',
      pid: p.pid,
      cpu_pct: p.cpu_pct,
      mem_mb: p.mem_bytes != null ? Number((p.mem_bytes / 1024 / 1024).toFixed(1)) : null,
      uptime_s: p.uptime_s,
      restarts: p.restarts,
      version: p.version,
      response_time_ms: null, // nécessiterait un middleware de mesure par requête, non câblé en Phase 1
    }));

    const [nginxActive, db] = await Promise.all([
      checkSystemdActive('nginx'),
      dbCollector.getDatabaseMetrics(),
    ]);

    services.push({
      id: 'sys:nginx', name: 'Nginx', kind: 'system',
      status: nginxActive ? 'online' : 'offline',
      pid: null, cpu_pct: null, mem_mb: null, uptime_s: null, restarts: null, version: null, response_time_ms: null,
    });
    services.push({
      id: 'sys:mysql', name: 'Base de données (MySQL)', kind: 'system',
      status: db.status === 'up' ? 'online' : 'offline',
      pid: null, cpu_pct: null, mem_mb: null, uptime_s: db.uptime_s || null, restarts: null,
      version: db.version || null, response_time_ms: null,
    });

    return services;
  }

  async getDatabaseMetrics() {
    return dbCollector.getDatabaseMetrics();
  }

  async getNetworkMetrics() {
    const net = netCollector.getNetworkThroughput();
    return {
      ...net,
      top_ips: null,
      top_countries: null,
      top_endpoints: null,
      limitations: [
        "Top IP/pays/endpoints non disponibles — aucune journalisation par requête n'existe aujourd'hui (nécessiterait un nouveau middleware de tracking, hors périmètre de cette phase).",
      ],
    };
  }

  async getDiskMetrics() {
    const [partitions, topFolders, largeLogs] = await Promise.all([
      diskCollector.getPartitions(),
      diskCollector.getTopFolders(),
      diskCollector.getLargeLogs(),
    ]);
    return { partitions, top_folders: topFolders, large_logs: largeLogs, limitations: [] };
  }

  async getSslStatus(domain) {
    return sslCollector.checkCertificate(domain || 'ifilino.com');
  }

  async getSecuritySnapshot() {
    const { AuthFailedLogin } = require('../../../../models');
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const failedLogins24h = await AuthFailedLogin.count({ where: { created_at: { [Op.gte]: since } } }).catch(() => 0);
    return {
      failed_logins_24h: failedLogins24h,
      fail2ban: 'unavailable',
      blocked_ips: null,
      suspicious_countries: null,
      open_ports: null,
      last_ssh_access: 'unavailable',
      last_root_access: 'unavailable',
      auth_log: 'unavailable',
      limitations: [
        "fail2ban n'est pas installé sur ce serveur.",
        "/var/log/auth.log et les accès SSH/root ne sont pas accessibles par l'utilisateur applicatif — nécessiterait une configuration système supplémentaire (groupe adm ou sudoers dédié).",
      ],
    };
  }

  async restartService(name) { return pm2ActionService.restartProcess(name); }
  async stopService(name)    { return pm2ActionService.stopProcess(name); }
  async reloadService(name)  { return pm2ActionService.reloadProcess(name); }
  async getServiceLogs(name, opts) { return logsService.getLogs({ app: name, ...opts }); }
}

module.exports = LocalProcMetricsProvider;
