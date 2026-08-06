'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class AdClick extends Model {}

AdClick.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  campaign_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  placement_id:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  impression_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  session_id_hash: { type: DataTypes.STRING(64), allowNull: false },
  user_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  platform:        { type: DataTypes.STRING(32), allowNull: true },
  route:           { type: DataTypes.STRING(255), allowNull: true },
  device:          { type: DataTypes.ENUM('desktop', 'tablet', 'mobile'), allowNull: true },
  occurred_at:     { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  sequelize,
  modelName: 'adClick',
  tableName: 'ad_clicks',
  timestamps: true,
  underscored: true,
  updatedAt: false,
  indexes: [
    { fields: ['campaign_id', 'occurred_at'] },
    { fields: ['placement_id', 'occurred_at'] },
    { fields: ['platform'] },
  ],
});

module.exports = AdClick;
