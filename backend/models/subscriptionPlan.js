'use strict';
const { DataTypes } = require('sequelize');
const db = require('./db');

const SubscriptionPlan = db.define('SubscriptionPlan', {
  id:                     { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:                   { type: DataTypes.STRING(100), allowNull: false },
  slug:                   { type: DataTypes.STRING(50), allowNull: false, unique: true },
  description:            { type: DataTypes.TEXT },
  price_monthly:          { type: DataTypes.DECIMAL(10,2), defaultValue: 0 },
  price_yearly:           { type: DataTypes.DECIMAL(10,2), defaultValue: 0 },
  max_restaurants:        { type: DataTypes.INTEGER, defaultValue: 1 },
  max_users:              { type: DataTypes.INTEGER, defaultValue: 5 },
  max_orders_per_month:   { type: DataTypes.INTEGER, defaultValue: 100 },
  has_ai_features:        { type: DataTypes.BOOLEAN, defaultValue: false },
  has_exports:            { type: DataTypes.BOOLEAN, defaultValue: false },
  has_advanced_dashboard: { type: DataTypes.BOOLEAN, defaultValue: false },
  has_loyalty_module:     { type: DataTypes.BOOLEAN, defaultValue: false },
  has_delivery_module:    { type: DataTypes.BOOLEAN, defaultValue: false },
  has_canteen_module:     { type: DataTypes.BOOLEAN, defaultValue: false },
  has_nutrition_ai:       { type: DataTypes.BOOLEAN, defaultValue: false },
  has_api_access:         { type: DataTypes.BOOLEAN, defaultValue: false },
  is_active:              { type: DataTypes.BOOLEAN, defaultValue: true },
  is_popular:             { type: DataTypes.BOOLEAN, defaultValue: false },
  color:                  { type: DataTypes.STRING(20), defaultValue: '#64748B' },
  icon:                   { type: DataTypes.STRING(10), defaultValue: '📦' },
  sort_order:             { type: DataTypes.INTEGER, defaultValue: 0 },
  features:               { type: DataTypes.JSON },
}, {
  tableName: 'subscription_plans',
  underscored: true,
});

module.exports = SubscriptionPlan;
