'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PharmacySale extends Model {}

PharmacySale.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  customer_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  prescription_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

  sale_number: { type: DataTypes.STRING(32), allowNull: false, unique: true },

  has_prescription: { type: DataTypes.BOOLEAN, defaultValue: false },

  subtotal:        { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 },
  discount_amount: { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 },
  vat_amount:      { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 },
  total:           { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 },

  payment_method: { type: DataTypes.ENUM('cash', 'card', 'credit', 'mixed'), defaultValue: 'cash' },
  amount_cash:    { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 },
  amount_card:    { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 },
  amount_credit:  { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 },

  status: { type: DataTypes.ENUM('completed', 'cancelled'), defaultValue: 'completed' },

  cashier_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  tableName: 'pharmacy_sales',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['customer_id'] },
    { fields: ['organization_id', 'created_at'] },
  ],
});

module.exports = PharmacySale;
