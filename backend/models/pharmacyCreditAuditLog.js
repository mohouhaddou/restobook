'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PharmacyCreditAuditLog extends Model {}

PharmacyCreditAuditLog.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  user_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  user_name:       { type: DataTypes.STRING(191), allowNull: true },

  action: {
    type: DataTypes.ENUM(
      'customer_created','customer_updated','customer_deleted',
      'credit_created','credit_updated','credit_deleted',
      'payment_created','payment_deleted'
    ),
    allowNull: false,
  },
  entity_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  details:   { type: DataTypes.JSON, allowNull: true },
}, {
  sequelize,
  tableName: 'pharmacy_credit_audit_logs',
  underscored: true,
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['organization_id', 'created_at'] },
  ],
});

module.exports = PharmacyCreditAuditLog;
