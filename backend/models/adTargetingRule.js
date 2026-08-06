'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class AdTargetingRule extends Model {}

// route_pattern est stocké tel quel (ex: '/discover/*', '/product/:slug') mais n'est
// JAMAIS évalué comme regex utilisateur ou code — voir adTargetingService.compileRoutePattern
// qui échappe tout, puis ré-expand uniquement '*' et ':param' de façon contrôlée.
AdTargetingRule.init({
  id:           { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  campaign_id:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

  platform:      { type: DataTypes.ENUM('global', 'homepage', 'marketplace', 'discover', 'play', 'user_dashboard'), allowNull: true },
  route_type:    { type: DataTypes.ENUM('all', 'exact', 'prefix', 'pattern'), allowNull: false, defaultValue: 'all' },
  route_pattern: { type: DataTypes.STRING(255), allowNull: true },

  language:      { type: DataTypes.ENUM('fr', 'ar', 'en', 'all'), allowNull: false, defaultValue: 'all' },
  device:        { type: DataTypes.ENUM('desktop', 'tablet', 'mobile', 'all'), allowNull: false, defaultValue: 'all' },
  audience_type: { type: DataTypes.ENUM('all', 'guest', 'logged_in'), allowNull: false, defaultValue: 'all' },

  country: { type: DataTypes.STRING(2), allowNull: true },
  city:    { type: DataTypes.STRING(100), allowNull: true },

  days_of_week: { type: DataTypes.JSON, allowNull: true },
  start_hour:   { type: DataTypes.STRING(5), allowNull: true },
  end_hour:     { type: DataTypes.STRING(5), allowNull: true },
}, {
  sequelize,
  modelName: 'adTargetingRule',
  tableName: 'ad_targeting_rules',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['campaign_id'] },
    { fields: ['route_pattern'] },
  ],
});

module.exports = AdTargetingRule;
