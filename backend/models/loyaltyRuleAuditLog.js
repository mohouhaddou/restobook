'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Journal d'audit des règles de fidélité — mirroir exact de HanoutCreditAuditLog
// (voir backend/models/hanoutCreditAuditLog.js), écrit via logRuleAudit()
// (backend/src/modules/loyalty/ruleAuditService.js), fire-and-forget : l'audit
// ne doit jamais faire échouer l'opération principale.
class LoyaltyRuleAuditLog extends Model {}

LoyaltyRuleAuditLog.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, // null pour un changement global/catégorie
  user_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  user_name:       { type: DataTypes.STRING(191), allowNull: true },
  action: {
    type: DataTypes.ENUM(
      'rule_created', 'rule_updated', 'rule_submitted', 'rule_approved', 'rule_rejected',
      'settings_mode_changed', 'limits_updated', 'earn_reversed', 'earn_blocked_fraud'
    ),
    allowNull: false,
  },
  entity_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  details:   { type: DataTypes.JSON, allowNull: true },
}, {
  sequelize,
  tableName: 'loyalty_rule_audit_logs',
  underscored: true,
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['organization_id', 'created_at'] },
  ],
});

module.exports = LoyaltyRuleAuditLog;
