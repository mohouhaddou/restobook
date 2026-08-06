'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Catégorie SEO (ex: cuisine 'pizza', 'burger' pour le vertical restaurant),
// distincte de MenuCategory (catégories de carte internes à un commerce) et de
// business_type (classification métier de Business). Une seule table partagée
// par tous les verticaux, discriminée par `vertical` — Phase 1 ne peuple que
// vertical='restaurant' (depuis organizations.cuisine_type), le reste (hanout,
// pharmacie...) sera branché lors de leur rollout SEO.
class Category extends Model {}

Category.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  vertical:        { type: DataTypes.ENUM('restaurant', 'hanout', 'pharmacie', 'cafe', 'boulangerie', 'patisserie', 'boucherie'), allowNull: false },
  slug:            { type: DataTypes.STRING(100), allowNull: false },
  name:            { type: DataTypes.STRING(100), allowNull: false },
  parent_id:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  seo_title:       { type: DataTypes.STRING(191), allowNull: true },
  seo_description: { type: DataTypes.STRING(500), allowNull: true },
  is_active:       { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  sequelize,
  modelName: 'category',
  tableName: 'categories',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['vertical', 'slug'] },
  ],
});

module.exports = Category;
