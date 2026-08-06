'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Taxonomie hiérarchique du catalogue produit partagé (Alimentation > Boissons > Eau...).
// Distincte de `categories`/Category (taxonomie SEO par organisation), de
// HanoutCategory et de MenuCategory (taxonomies internes propres à chaque commerce) :
// celle-ci classe les GlobalProduct eux-mêmes, partagée par tous les commerces.
class ProductCategory extends Model {}

ProductCategory.init({
  id:         { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  parent_id:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  slug:       { type: DataTypes.STRING(100), allowNull: false, unique: true },
  name:       { type: DataTypes.STRING(100), allowNull: false },
  icon:       { type: DataTypes.STRING(20), allowNull: true }, // emoji
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
  is_active:  { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  sequelize,
  tableName: 'product_categories',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['parent_id'] },
  ],
});

module.exports = ProductCategory;
