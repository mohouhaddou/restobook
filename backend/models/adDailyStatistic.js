'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class AdDailyStatistic extends Model {}

// Agrégat quotidien produit par adAggregationService — sert de base à la
// politique de rétention (les événements détaillés pourront être purgés après
// agrégation, une fois cette table alimentée en continu).
AdDailyStatistic.init({
  id:                { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  campaign_id:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  placement_id:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  date:              { type: DataTypes.DATEONLY, allowNull: false },
  impressions:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  clicks:            { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  unique_impressions: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  unique_clicks:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  estimated_revenue:  { type: DataTypes.DECIMAL(10, 2), allowNull: true },
}, {
  sequelize,
  modelName: 'adDailyStatistic',
  tableName: 'ad_daily_statistics',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['campaign_id', 'placement_id', 'date'] },
  ],
});

module.exports = AdDailyStatistic;
