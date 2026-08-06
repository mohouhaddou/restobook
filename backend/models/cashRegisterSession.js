'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class CashRegisterSession extends Model {}

CashRegisterSession.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  business_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  cashier_id:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

  opening_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  closing_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  expected_cash:  { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  counted_cash:   { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  cash_difference:{ type: DataTypes.DECIMAL(10, 2), allowNull: true },

  total_cash:   { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  total_card:   { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  total_credit: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  sales_count:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },

  status: { type: DataTypes.ENUM('OPEN', 'CLOSED'), allowNull: false, defaultValue: 'OPEN' },

  opened_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  closed_at: { type: DataTypes.DATE, allowNull: true },
  notes:     { type: DataTypes.TEXT, allowNull: true },
}, {
  sequelize,
  tableName: 'cash_register_sessions',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['business_id', 'status'] },
    { fields: ['cashier_id'] },
  ],
});

module.exports = CashRegisterSession;
