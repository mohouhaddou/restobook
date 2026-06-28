'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class OrderItem extends Model {}

OrderItem.init({
  id:           { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  order_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  menu_item_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  quantity:     { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 1 },
  unit_price:   { type: DataTypes.DECIMAL(8,2), allowNull: false },
  notes:        { type: DataTypes.TEXT, allowNull: true },
}, {
  sequelize,
  modelName: 'order_item',
  tableName: 'order_items',
  timestamps: false,
  underscored: true,
});

module.exports = OrderItem;
