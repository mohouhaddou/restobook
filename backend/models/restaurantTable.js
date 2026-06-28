'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const RestaurantTable = sequelize.define('RestaurantTable', {
  id:              { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  label:           { type: DataTypes.STRING(50), allowNull: false },
  qr_token:        { type: DataTypes.STRING(64), allowNull: false, unique: true },
  capacity:        { type: DataTypes.TINYINT.UNSIGNED, defaultValue: 2 },
  floor:           { type: DataTypes.STRING(30), allowNull: true },
  active:          { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'restaurant_tables',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = RestaurantTable;
