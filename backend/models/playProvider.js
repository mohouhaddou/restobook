'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PlayProvider extends Model {}

PlayProvider.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(120), allowNull: false },
  description: { type: DataTypes.STRING(500), allowNull: true },
  logo_url: { type: DataTypes.STRING(500), allowNull: true },
  base_url: { type: DataTypes.STRING(500), allowNull: true },
  launch_mode: { type: DataTypes.ENUM('internal', 'iframe', 'redirect', 'sdk'), allowNull: false, defaultValue: 'iframe' },
  license_type: { type: DataTypes.ENUM('internal', 'contract', 'revenue_share', 'free_license'), allowNull: false, defaultValue: 'contract' },
  license_reference: { type: DataTypes.STRING(160), allowNull: true },
  supports_mobile: { type: DataTypes.BOOLEAN, defaultValue: true },
  supports_fullscreen: { type: DataTypes.BOOLEAN, defaultValue: true },
  has_ads: { type: DataTypes.BOOLEAN, defaultValue: false },
  active: { type: DataTypes.BOOLEAN, defaultValue: false },
  config: { type: DataTypes.JSON, allowNull: true },
}, {
  sequelize,
  modelName: 'play_provider',
  tableName: 'play_providers',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['active'] }],
});

module.exports = PlayProvider;
