'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class MenuItem extends Model {}

MenuItem.init({
  libelle:         { type: DataTypes.STRING, allowNull: false },
  description:     { type: DataTypes.TEXT, allowNull: true },
  type: {
    type: DataTypes.ENUM('plat', 'entrée', 'dessert', 'boisson'),
    defaultValue: 'plat'
  },
  allergenes:      { type: DataTypes.JSON, allowNull: true },
  calories:        { type: DataTypes.INTEGER, allowNull: true },
  proteines_g:     { type: DataTypes.DECIMAL(8, 2), allowNull: true },
  glucides_g:      { type: DataTypes.DECIMAL(8, 2), allowNull: true },
  lipides_g:       { type: DataTypes.DECIMAL(8, 2), allowNull: true },
  health_score:    { type: DataTypes.INTEGER, allowNull: true },
  nutrition_analysis: { type: DataTypes.JSON, allowNull: true },
  nutrition_analyzed_at: { type: DataTypes.DATE, allowNull: true },
  actif:           { type: DataTypes.BOOLEAN, defaultValue: true },
  image_url:       { type: DataTypes.STRING(500), allowNull: true },
  prix:            { type: DataTypes.DECIMAL(8, 2), allowNull: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  category_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  // SEO — page produit publique /produits/:slug (voir scripts/migrate_seo_menu_item_slugs.js)
  slug:            { type: DataTypes.STRING(191), allowNull: true, unique: true },
  sort_order:      { type: DataTypes.INTEGER, defaultValue: 0 },
  is_available:    { type: DataTypes.BOOLEAN, defaultValue: true },
  sku:             { type: DataTypes.STRING(64), allowNull: true },
  // Stock (même sémantique que HanoutProduct : null = illimité)
  stock_quantity:  { type: DataTypes.INTEGER,  allowNull: true },
  track_stock:     { type: DataTypes.BOOLEAN,  defaultValue: false },
}, {
  sequelize,
  modelName: 'menu_item',
  timestamps: true,
  indexes: [
    { fields: ['organization_id', 'actif'] },
    { fields: ['category_id'] }
  ]
});

module.exports = MenuItem;
