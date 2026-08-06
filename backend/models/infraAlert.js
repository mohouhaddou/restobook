'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Historique des alertes déclenchées (une ligne par déclenchement, pas par
// tick — voir cooldown_minutes sur InfraAlertRule) + état d'accusé de
// réception. Écrit par alertEngineService.js, lu par la page Alertes.
class InfraAlert extends Model {}

InfraAlert.init({
  id:               { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  rule_code:        { type: DataTypes.STRING(64), allowNull: false },
  severity:         { type: DataTypes.ENUM('info', 'warning', 'critical'), allowNull: false },
  origin:           { type: DataTypes.STRING(191), allowNull: false }, // ex: nom de service, 'server', 'database', 'ssl'
  description:      { type: DataTypes.STRING(500), allowNull: false },
  value:            { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  status:           { type: DataTypes.ENUM('active', 'resolved', 'acknowledged'), allowNull: false, defaultValue: 'active' },
  acknowledged_by:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  acknowledged_at:  { type: DataTypes.DATE, allowNull: true },
  resolved_at:      { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize,
  tableName: 'infra_alerts',
  underscored: true,
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['status', 'created_at'] },
    { fields: ['rule_code', 'created_at'] },
  ],
});

module.exports = InfraAlert;
