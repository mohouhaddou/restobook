'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class CartItem extends Model {}

CartItem.init({
  id:           { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  cart_id:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  menu_item_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  quantity:     { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 1 },
  notes:        { type: DataTypes.STRING(255), allowNull: true },
  unit_price:   { type: DataTypes.DECIMAL(8, 2), allowNull: false },
}, {
  sequelize,
  modelName: 'cart_item',
  tableName: 'cart_items',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['cart_id'] }, { fields: ['menu_item_id'] }]
});

module.exports = CartItem;
