'use strict';

/**
 * Infrastructure Monitoring Center — routes SuperAdmin.
 * Montées sous /api/superadmin/infra (équivalent fonctionnel de la demande
 * /api/admin/infrastructure/*, préfixe réel aligné sur la convention déjà en
 * place pour /api/superadmin/loyalty).
 *
 * GET  /health                          — score de santé + décomposition
 * GET  /server                          — CPU/RAM/swap/charge/uptime
 * GET  /services                        — grille PM2 + services système
 * GET  /services/:name/logs             — tail de logs d'un service
 * POST /services/:name/restart|stop|reload
 * GET  /database, /network, /disk, /ssl, /security
 * GET  /logs                            — explorateur de logs global
 * GET  /backups · POST /backups · GET /backups/:filename/download
 * GET  /alerts · GET /alerts/rules · PATCH /alerts/rules/:id · POST /alerts/:id/acknowledge
 * GET  /history?range=24h|7d|30d|90d|1y
 */
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { Op } = require('sequelize');
const { requireAuth, requireSuperAdmin } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { InfraAlert, InfraAlertRule, InfraMetricSnapshot } = require('../../../models');
const { getMetricsProvider } = require('./providers');
const { computeHealthScore } = require('./services/healthScoreService');
const { logInfraAudit } = require('./services/infraAuditService');
const alertEngineService = require('./services/alertEngineService');
const backupService = require('./services/backupService');
const logsService = require('./services/logsService');

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth, requireSuperAdmin);

// ── Dashboard ──────────────────────────────────────────────────────────────
router.get('/health', ah(async (req, res) => {
  const provider = getMetricsProvider();
  const [server, services, disk, db, ssl] = await Promise.all([
    provider.getServerMetrics(), provider.getServiceList(),
    provider.getDiskMetrics(), provider.getDatabaseMetrics(), provider.getSslStatus(),
  ]);
  const root = disk.partitions.find(p => p.mount === '/') || disk.partitions[0] || {};
  const servicesOnline = services.filter(s => s.status === 'online').length;
  const health = computeHealthScore({
    cpu_pct: server.cpu_pct, mem_pct: server.mem_pct, disk_pct: root.pct,
    services_online: servicesOnline, services_total: services.length,
    db_up: db.status === 'up', ssl_days_remaining: ssl.days_remaining,
  });
  res.json({ ...health, services_online: servicesOnline, services_total: services.length, timestamp: new Date().toISOString() });
}));

router.get('/server', ah(async (req, res) => {
  res.json(await getMetricsProvider().getServerMetrics());
}));

// ── Services / PM2 ─────────────────────────────────────────────────────────
router.get('/services', ah(async (req, res) => {
  res.json({ services: await getMetricsProvider().getServiceList() });
}));

router.get('/services/:name/logs',
  [
    param('name').trim().notEmpty(),
    query('level').optional().isIn(['INFO', 'WARNING', 'ERROR', 'CRITICAL']),
    query('search').optional().trim().isLength({ max: 200 }),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
  ], validate, ah(async (req, res) => {
    const lines = await getMetricsProvider().getServiceLogs(req.params.name, {
      level: req.query.level, search: req.query.search,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ lines });
  })
);

function serviceAction(providerMethod, auditAction) {
  return ah(async (req, res) => {
    const name = req.params.name;
    const result = await getMetricsProvider()[providerMethod](name);
    logInfraAudit({ user_id: req.user.id, user_name: req.user.nom, action: auditAction, entity_id: name, details: result });
    if (global.io) global.io.to('superadmin:infra').emit('infra:service:changed', { name, status: result.status });
    res.json(result);
  });
}
router.post('/services/:name/restart', serviceAction('restartService', 'service_restart'));
router.post('/services/:name/stop',    serviceAction('stopService', 'service_stop'));
router.post('/services/:name/reload',  serviceAction('reloadService', 'service_reload'));

// ── Base de données / Réseau / Disque / SSL / Sécurité ────────────────────
router.get('/database', ah(async (req, res) => res.json(await getMetricsProvider().getDatabaseMetrics())));
router.get('/network',  ah(async (req, res) => res.json(await getMetricsProvider().getNetworkMetrics())));
router.get('/disk',     ah(async (req, res) => res.json(await getMetricsProvider().getDiskMetrics())));
router.get('/ssl',      ah(async (req, res) => res.json(await getMetricsProvider().getSslStatus())));
router.get('/security', ah(async (req, res) => res.json(await getMetricsProvider().getSecuritySnapshot())));

// ── Logs ───────────────────────────────────────────────────────────────────
router.get('/logs',
  [
    query('app').optional().trim().isLength({ max: 100 }),
    query('level').optional().isIn(['INFO', 'WARNING', 'ERROR', 'CRITICAL']),
    query('search').optional().trim().isLength({ max: 200 }),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
  ], validate, ah(async (req, res) => {
    const lines = logsService.getLogs({
      app: req.query.app, level: req.query.level, search: req.query.search,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ lines, apps: logsService.listApps() });
  })
);

// ── Sauvegardes (Créer/Lister/Télécharger — Restaurer explicitement absent) ─
router.get('/backups', ah(async (req, res) => {
  res.json({ backups: backupService.listBackups(), restore_available: false });
}));

router.post('/backups', ah(async (req, res) => {
  const result = await backupService.createBackup();
  logInfraAudit({ user_id: req.user.id, user_name: req.user.nom, action: 'backup_create', entity_id: result.filename, details: result });
  res.json(result);
}));

router.get('/backups/:filename/download', ah(async (req, res) => {
  const filePath = backupService.getBackupPath(req.params.filename);
  if (!filePath) return res.status(404).json({ error: 'Sauvegarde introuvable' });
  logInfraAudit({ user_id: req.user.id, user_name: req.user.nom, action: 'backup_download', entity_id: req.params.filename });
  res.download(filePath);
}));

// ── Alertes ────────────────────────────────────────────────────────────────
router.get('/alerts',
  [query('status').optional().isIn(['active', 'resolved', 'acknowledged'])], validate,
  ah(async (req, res) => {
    const where = req.query.status ? { status: req.query.status } : {};
    const alerts = await InfraAlert.findAll({ where, order: [['created_at', 'DESC']], limit: 200 });
    res.json({ alerts });
  })
);

router.get('/alerts/rules', ah(async (req, res) => {
  const rules = await InfraAlertRule.findAll({ order: [['code', 'ASC']] });
  res.json({ rules });
}));

router.patch('/alerts/rules/:id',
  [
    param('id').isInt({ min: 1 }),
    body('threshold').optional().isFloat(),
    body('enabled').optional().isBoolean(),
    body('severity').optional().isIn(['info', 'warning', 'critical']),
  ], validate, ah(async (req, res) => {
    const rule = await InfraAlertRule.findByPk(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Règle introuvable' });
    const { threshold, enabled, severity } = req.body;
    if (threshold !== undefined) rule.threshold = threshold;
    if (enabled !== undefined) rule.enabled = enabled;
    if (severity !== undefined) rule.severity = severity;
    await rule.save();
    logInfraAudit({ user_id: req.user.id, user_name: req.user.nom, action: 'alert_rule_updated', entity_id: rule.code, details: { threshold, enabled, severity } });
    res.json({ ok: true, rule });
  })
);

router.post('/alerts/:id/acknowledge',
  [param('id').isInt({ min: 1 })], validate,
  ah(async (req, res) => {
    const alert = await alertEngineService.acknowledgeAlert(req.params.id, req.user.id);
    if (!alert) return res.status(404).json({ error: 'Alerte introuvable' });
    logInfraAudit({ user_id: req.user.id, user_name: req.user.nom, action: 'alert_acknowledge', entity_id: String(alert.id) });
    res.json({ ok: true, alert });
  })
);

// ── Historique (24h/7j/30j/90j/1an) ────────────────────────────────────────
const RANGE_TO_HOURS = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30, '90d': 24 * 90, '1y': 24 * 365 };
router.get('/history',
  [query('range').optional().isIn(Object.keys(RANGE_TO_HOURS))], validate,
  ah(async (req, res) => {
    const range = req.query.range || '24h';
    const since = new Date(Date.now() - RANGE_TO_HOURS[range] * 3600 * 1000);
    const points = await InfraMetricSnapshot.findAll({
      where: { captured_at: { [Op.gte]: since } },
      order: [['captured_at', 'ASC']],
      limit: 5000,
    });
    res.json({ range, points });
  })
);

module.exports = router;
