'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Une règle de fidélité versionnée, par portée (global/catégorie/commerce).
// Global/catégorie : éditée par le SuperAdmin → active immédiatement (l'ancienne
// règle du même scope-key bascule en 'draft'). Commerce : draft→pending→approved|rejected
// par le SuperAdmin (voir backend/src/modules/admin/loyaltyProgramRoutes.js).
// Les lignes existantes ne sont jamais mutées pour changer leurs valeurs — une
// édition crée une nouvelle ligne, garantissant la traçabilité historique.
class LoyaltyRule extends Model {}

LoyaltyRule.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  scope:           { type: DataTypes.ENUM('global', 'category', 'business'), allowNull: false },
  business_type: {
    type: DataTypes.ENUM('restaurant', 'cafe', 'cantine', 'hanout', 'boulangerie', 'patisserie', 'boucherie', 'pharmacie', 'autre'),
    allowNull: true, // renseigné uniquement si scope='category'
  },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, // renseigné uniquement si scope='business'

  points_rate:         { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 1 }, // DH par point
  cashback_pct:        { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
  min_order_amount:    { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  excluded_products:   { type: DataTypes.JSON, allowNull: true },
  excluded_categories: { type: DataTypes.JSON, allowNull: true },
  monthly_budget_cap:  { type: DataTypes.DECIMAL(10, 2), allowNull: true }, // null = illimité
  valid_from:          { type: DataTypes.DATEONLY, allowNull: true },
  valid_until:         { type: DataTypes.DATEONLY, allowNull: true },

  status: {
    type: DataTypes.ENUM('draft', 'pending', 'approved', 'rejected', 'active'),
    allowNull: false, defaultValue: 'draft',
  },
  created_by:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  reviewed_by:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  reviewed_at:      { type: DataTypes.DATE, allowNull: true },
  rejection_reason: { type: DataTypes.TEXT, allowNull: true },
}, {
  sequelize,
  tableName: 'loyalty_rules',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['scope', 'business_type'] },
    { fields: ['scope', 'organization_id'] },
    { fields: ['status'] },
  ],
});

module.exports = LoyaltyRule;
