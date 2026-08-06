'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Marque du catalogue produit partagé (Coca-Cola, Dove, Lesieur...).
// Peut être créée à la volée par un commerçant lors d'un ajout rapide
// (status='pending_review') — la vérification/fusion est hors-scope Phase 1+2.
class ProductBrand extends Model {}

ProductBrand.init({
  id:                        { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  name:                      { type: DataTypes.STRING(191), allowNull: false },
  slug:                      { type: DataTypes.STRING(191), allowNull: false, unique: true },
  logo_url:                  { type: DataTypes.STRING(500), allowNull: true },
  status:                    { type: DataTypes.ENUM('active', 'pending_review'), defaultValue: 'active' },
  created_by_organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  tableName: 'product_brands',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['name'] },
  ],
});

module.exports = ProductBrand;
