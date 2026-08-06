'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PharmacyPurchaseOrderItem extends Model {}

PharmacyPurchaseOrderItem.init({
  id:                { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  purchase_order_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  medicine_id:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

  quantity_ordered:  { type: DataTypes.INTEGER, allowNull: false },
  quantity_received: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  unit_price:        { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 },
}, {
  sequelize,
  tableName: 'pharmacy_purchase_order_items',
  underscored: true,
  timestamps: true,
  indexes: [{ fields: ['purchase_order_id'] }],
});

module.exports = PharmacyPurchaseOrderItem;
