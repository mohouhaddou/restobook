'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PharmacyPurchaseOrder extends Model {}

PharmacyPurchaseOrder.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  supplier_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

  order_number:  { type: DataTypes.STRING(32), allowNull: false, unique: true },
  status: {
    type: DataTypes.ENUM('draft', 'sent', 'partially_received', 'received', 'cancelled'),
    defaultValue: 'draft',
  },
  order_date:    { type: DataTypes.DATEONLY, allowNull: true },
  expected_date: { type: DataTypes.DATEONLY, allowNull: true },
  notes:         { type: DataTypes.TEXT, allowNull: true },
  total_amount:  { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 },
  created_by:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  tableName: 'pharmacy_purchase_orders',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['supplier_id'] },
  ],
});

module.exports = PharmacyPurchaseOrder;
