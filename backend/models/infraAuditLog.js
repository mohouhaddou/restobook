'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Journal d'audit des actions SuperAdmin sur le module Infrastructure —
// mirroir exact de LoyaltyRuleAuditLog/HanoutCreditAuditLog, écrit via
// logInfraAudit() (backend/src/modules/infra/services/infraAuditService.js),
// fire-and-forget : l'audit ne doit jamais faire échouer l'action réelle.
class InfraAuditLog extends Model {}

InfraAuditLog.init({
  id:        { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  user_name: { type: DataTypes.STRING(191), allowNull: true },
  action: {
    type: DataTypes.ENUM(
      'service_restart', 'service_stop', 'service_reload',
      'backup_create', 'backup_download',
      'alert_acknowledge', 'alert_rule_updated'
    ),
    allowNull: false,
  },
  entity_id: { type: DataTypes.STRING(191), allowNull: true }, // nom de service, nom de fichier, id d'alerte — cibles hétérogènes, pas de FK
  details:   { type: DataTypes.JSON, allowNull: true },
}, {
  sequelize,
  tableName: 'infra_audit_logs',
  underscored: true,
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['created_at'] },
    { fields: ['action', 'created_at'] },
  ],
});

module.exports = InfraAuditLog;
