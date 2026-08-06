'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Ligne singleton (id=1, jamais une deuxième) — bornes fixées par le SuperAdmin
// qu'aucune règle commerçant ne peut dépasser (validées côté serveur, jamais
// clampées silencieusement — voir backend/src/modules/marketplace/loyaltyRoutes.js).
class LoyaltyGlobalLimits extends Model {}

LoyaltyGlobalLimits.init({
  id:                     { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
  max_cashback_pct:       { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 5 },
  min_points_rate:        { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 5 },  // DH/pt — plancher = plus généreux autorisé
  max_points_rate:        { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 50 }, // DH/pt — plafond = moins généreux autorisé
  max_monthly_budget_cap: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 10000 },
  max_expiration_days:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 365 },
  updated_by:             { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  tableName: 'loyalty_global_limits',
  underscored: true,
  timestamps: true,
  createdAt: false,
});

module.exports = LoyaltyGlobalLimits;
