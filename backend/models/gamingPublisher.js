'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class GamingPublisher extends Model {}

GamingPublisher.init({
  id:           { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  slug:         { type: DataTypes.STRING(191), unique: true, allowNull: false },
  name:         { type: DataTypes.STRING(191), allowNull: false },
  logo_url:     { type: DataTypes.STRING(500), allowNull: true },
  official_url: { type: DataTypes.STRING(500), allowNull: true },
}, {
  sequelize,
  modelName: 'gaming_publisher',
  tableName: 'gaming_publishers',
  timestamps: true,
  underscored: true,
});

module.exports = GamingPublisher;
