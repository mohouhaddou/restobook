'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class AdImpression extends Model {}

// Append-only. session_id_hash = SHA-256 du jeton de session client — jamais le
// jeton brut ni l'IP complète (voir adPublicRoutes / hashSessionToken).
AdImpression.init({
  id:               { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  campaign_id:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  placement_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  session_id_hash:  { type: DataTypes.STRING(64), allowNull: false },
  user_id:          { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  platform:         { type: DataTypes.STRING(32), allowNull: true },
  route:            { type: DataTypes.STRING(255), allowNull: true },
  device:           { type: DataTypes.ENUM('desktop', 'tablet', 'mobile'), allowNull: true },
  language:         { type: DataTypes.STRING(5), allowNull: true },
  occurred_at:      { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  sequelize,
  modelName: 'adImpression',
  tableName: 'ad_impressions',
  timestamps: true,
  underscored: true,
  updatedAt: false,
  indexes: [
    { fields: ['campaign_id', 'occurred_at'] },
    { fields: ['placement_id', 'occurred_at'] },
    { fields: ['platform'] },
    { fields: ['session_id_hash', 'campaign_id'] },
  ],
});

module.exports = AdImpression;
