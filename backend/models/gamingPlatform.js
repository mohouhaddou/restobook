'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class GamingPlatform extends Model {}

GamingPlatform.init({
  id:   { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  slug: { type: DataTypes.STRING(64), unique: true, allowNull: false },
  name: { type: DataTypes.STRING(100), allowNull: false },
}, {
  sequelize,
  modelName: 'gaming_platform',
  tableName: 'gaming_platforms',
  timestamps: true,
  underscored: true,
});

module.exports = GamingPlatform;
