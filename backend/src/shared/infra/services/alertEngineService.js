'use strict';

/**
 * Moteur d'alertes — évalue les règles actives (infra_alert_rules) contre un
 * snapshot de métriques à chaque tick du poller. Une alerte déjà active pour
 * une règle n'est jamais dupliquée (pas de spam à chaque cycle) ; elle se
 * résout automatiquement dès que la condition n'est plus remplie. Un
 * `cooldown_minutes` empêche un ré-déclenchement immédiat après résolution
 * (anti-flapping).
 */
const { Op } = require('sequelize');
const { InfraAlertRule, InfraAlert } = require('../../../../models');

function getByPath(obj, pathStr) {
  return pathStr.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function compare(value, operator, threshold) {
  if (value == null) return false;
  switch (operator) {
    case 'gt': return value > threshold;
    case 'gte': return value >= threshold;
    case 'lt': return value < threshold;
    case 'lte': return value <= threshold;
    case 'eq': return value === threshold;
    default: return false;
  }
}

async function evaluate(snapshot) {
  const rules = await InfraAlertRule.findAll({ where: { enabled: true } });

  for (const rule of rules) {
    const value = getByPath(snapshot, rule.metric_path);
    const triggered = compare(value, rule.operator, Number(rule.threshold));
    const active = await InfraAlert.findOne({ where: { rule_code: rule.code, status: 'active' }, order: [['created_at', 'DESC']] });

    if (triggered) {
      if (active) continue; // déjà signalée, pas de doublon

      const lastResolved = await InfraAlert.findOne({
        where: { rule_code: rule.code, status: { [Op.in]: ['resolved', 'acknowledged'] } },
        order: [['created_at', 'DESC']],
      });
      if (lastResolved?.resolved_at) {
        const cooldownMs = rule.cooldown_minutes * 60000;
        if (Date.now() - new Date(lastResolved.resolved_at).getTime() < cooldownMs) continue;
      }

      const alert = await InfraAlert.create({
        rule_code: rule.code,
        severity: rule.severity,
        origin: rule.metric_path.split('.')[0],
        description: `${rule.label} — valeur observée : ${value}`,
        value: typeof value === 'number' ? value : null,
        status: 'active',
      });
      if (global.io) global.io.to('superadmin:infra').emit('infra:alert', alert.toJSON());
    } else if (active) {
      active.status = 'resolved';
      active.resolved_at = new Date();
      await active.save();
      if (global.io) global.io.to('superadmin:infra').emit('infra:alert:resolved', { id: active.id, rule_code: rule.code });
    }
  }
}

async function acknowledgeAlert(alertId, userId) {
  const alert = await InfraAlert.findByPk(alertId);
  if (!alert) return null;
  alert.status = 'acknowledged';
  alert.acknowledged_by = userId;
  alert.acknowledged_at = new Date();
  await alert.save();
  return alert;
}

module.exports = { evaluate, acknowledgeAlert };
