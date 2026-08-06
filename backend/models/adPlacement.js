'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class AdPlacement extends Model {}

AdPlacement.init({
  id:          { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  code:        { type: DataTypes.STRING(64), allowNull: false, unique: true }, // ex: 'below_header'
  name:        { type: DataTypes.STRING(191), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  platform:    { type: DataTypes.ENUM('global', 'homepage', 'marketplace', 'discover', 'play', 'user_dashboard'), allowNull: false, defaultValue: 'global' },
  position:    { type: DataTypes.STRING(64), allowNull: true }, // libellé libre : 'top' | 'sidebar' | 'inline' ...

  recommended_desktop_size: { type: DataTypes.STRING(32), allowNull: true }, // ex: '728x90'
  recommended_mobile_size:  { type: DataTypes.STRING(32), allowNull: true }, // ex: '320x100'
  supported_devices:        { type: DataTypes.JSON, allowNull: false, defaultValue: ['desktop', 'tablet', 'mobile'] },

  max_ads:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  sequelize,
  modelName: 'adPlacement',
  tableName: 'ad_placements',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['platform'] },
  ],
});

module.exports = AdPlacement;
