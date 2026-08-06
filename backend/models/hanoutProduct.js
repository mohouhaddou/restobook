'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class HanoutProduct extends Model {}

HanoutProduct.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  category_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  // SEO — page produit publique /produits/:slug (voir scripts/migrate_seo_phase2_product_slugs.js)
  slug:            { type: DataTypes.STRING(191), allowNull: true, unique: true },

  name:            { type: DataTypes.STRING(191), allowNull: false },
  description:     { type: DataTypes.TEXT,        allowNull: true },
  price:           { type: DataTypes.DECIMAL(8,2), allowNull: false },
  compare_price:   { type: DataTypes.DECIMAL(8,2), allowNull: true },  // prix barré

  images:          { type: DataTypes.JSON, defaultValue: [] },  // tableau d'URLs

  unit:            {
    type: DataTypes.ENUM('pièce','kg','g','l','ml','paquet','boîte','bouteille','sac'),
    defaultValue: 'pièce',
  },
  sku:             { type: DataTypes.STRING(64), allowNull: true }, // référence interne libre, jamais un vrai code produit

  // Code-barres réel (EAN/UPC/GTIN/CODE128) — distinct de sku, jamais généré artificiellement
  barcode:          { type: DataTypes.STRING(32), allowNull: true },
  barcode_type:     { type: DataTypes.ENUM('EAN13','EAN8','UPC_A','UPC_E','GTIN','CODE128','UNKNOWN'), allowNull: true },
  barcode_source:   { type: DataTypes.ENUM('MANUAL','SCAN','IMPORT','GENERATED'), allowNull: true },
  barcode_verified: { type: DataTypes.BOOLEAN, defaultValue: false },

  // Stock
  stock_quantity:  { type: DataTypes.INTEGER,  allowNull: true },   // null = illimité
  track_stock:     { type: DataTypes.BOOLEAN,  defaultValue: false },
  available:       { type: DataTypes.BOOLEAN,  defaultValue: true },

  tags:            { type: DataTypes.JSON, defaultValue: [] },

  // Rattachement au catalogue produit partagé (voir models/globalProduct.js) —
  // nullable : un produit ajouté manuellement n'a pas de fiche catalogue.
  global_product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  global_variant_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  tableName:   'hanout_products',
  underscored: true,
  timestamps:  true,
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['organization_id', 'available'] },
    { fields: ['category_id'] },
    { fields: ['organization_id', 'barcode'] },
    { fields: ['global_product_id'] },
  ],
});

module.exports = HanoutProduct;
