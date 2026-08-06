'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class ShoppingList extends Model {}

ShoppingList.init({
  id:       { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: false }, // propriétaire
  name:     { type: DataTypes.STRING(120), allowNull: false },
  icon:     { type: DataTypes.STRING(10), allowNull: true, defaultValue: '🛒' },
  is_shared: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }, // réservé partage famille (Phase 2)
  completed_at: { type: DataTypes.DATE, allowNull: true },
  preset_key:   { type: DataTypes.STRING(32), allowNull: true },
}, {
  sequelize,
  tableName: 'shopping_lists',
  underscored: true,
  timestamps: true,
  indexes: [{ fields: ['user_id'] }],
});

module.exports = ShoppingList;
