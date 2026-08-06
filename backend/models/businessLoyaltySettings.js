'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Choix du commerçant : ne pas participer / règles iFilino par défaut / règles
// personnalisées. Absence de ligne pour un organization_id = mode 'default'
// implicite (pas de backfill nécessaire à l'introduction de cette table).
class BusinessLoyaltySettings extends Model {}

BusinessLoyaltySettings.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
  mode:            { type: DataTypes.ENUM('none', 'default', 'custom'), allowNull: false, defaultValue: 'default' },
  active_rule_id:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, // FK loyalty_rules, significatif seulement si mode='custom'
}, {
  sequelize,
  tableName: 'business_loyalty_settings',
  underscored: true,
  timestamps: true,
});

module.exports = BusinessLoyaltySettings;
