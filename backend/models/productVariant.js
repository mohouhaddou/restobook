'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Variante de conditionnement d'un GlobalProduct (ex: "Coca-Cola 33cl" vs
// "Coca-Cola 1.5L"). Modèle créé pour Phase 1+2 par cohérence avec le besoin
// de variantes, mais aucun flux frontend ne le renseigne encore — voir plan
// misty-dreaming-puddle.md §6.
class ProductVariant extends Model {}

ProductVariant.init({
  id:                { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  global_product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  label:             { type: DataTypes.STRING(100), allowNull: false }, // "33cl", "1.5L", "Pack de 6"

  barcode:        { type: DataTypes.STRING(32), allowNull: true, unique: true },
  barcode_type:   { type: DataTypes.ENUM('EAN13', 'EAN8', 'UPC_A', 'UPC_E', 'GTIN', 'CODE128', 'UNKNOWN'), allowNull: true },
  barcode_source: { type: DataTypes.ENUM('MANUAL', 'SCAN', 'IMPORT', 'GENERATED'), allowNull: true },

  image_url:  { type: DataTypes.STRING(500), allowNull: true },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
  is_active:  { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  sequelize,
  tableName: 'product_variants',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['global_product_id'] },
  ],
});

module.exports = ProductVariant;
