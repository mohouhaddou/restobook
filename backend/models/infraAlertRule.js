'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Règles d'alerte du centre de supervision — seedées avec des valeurs par
// défaut (cf. migrate_infra_monitoring.js) puis éditables par le SuperAdmin
// (seuil, activation) depuis la page Alertes. Évaluées par
// backend/src/modules/infra/services/alertEngineService.js à chaque tick du
// poller contre le snapshot courant (metric_path = chemin pointé, ex.
// "server.cpu_pct").
class InfraAlertRule extends Model {}

InfraAlertRule.init({
  id:               { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  code:             { type: DataTypes.STRING(64), allowNull: false, unique: true },
  label:            { type: DataTypes.STRING(191), allowNull: false },
  metric_path:      { type: DataTypes.STRING(191), allowNull: false },
  operator:         { type: DataTypes.ENUM('gt', 'gte', 'lt', 'lte', 'eq'), allowNull: false },
  threshold:        { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  severity:         { type: DataTypes.ENUM('info', 'warning', 'critical'), allowNull: false, defaultValue: 'warning' },
  enabled:          { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  cooldown_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 15 },
}, {
  sequelize,
  tableName: 'infra_alert_rules',
  underscored: true,
  timestamps: true,
});

module.exports = InfraAlertRule;
