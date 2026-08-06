'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PharmacyMedicine extends Model {}

PharmacyMedicine.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

  // SEO — page produit publique /produits/:slug (voir scripts/migrate_seo_phase2_product_slugs.js)
  slug:       { type: DataTypes.STRING(191), allowNull: true, unique: true },
  name:       { type: DataTypes.STRING(191), allowNull: false }, // nom commercial
  dci:        { type: DataTypes.STRING(191), allowNull: true },  // DCI / nom générique
  laboratory: { type: DataTypes.STRING(191), allowNull: true },
  category:   { type: DataTypes.STRING(100), allowNull: true },  // catégorie thérapeutique

  form: {
    type: DataTypes.ENUM('comprime', 'sirop', 'pommade', 'injectable', 'gouttes', 'autre'),
    defaultValue: 'autre',
  },
  dosage:  { type: DataTypes.STRING(100), allowNull: true },
  barcode: { type: DataTypes.STRING(64),  allowNull: true },
  // Concerne uniquement les produits OTC/parapharmacie emballés (pas d'obligation pour les médicaments sur ordonnance)
  barcode_type:     { type: DataTypes.ENUM('EAN13','EAN8','UPC_A','UPC_E','GTIN','CODE128','UNKNOWN'), allowNull: true },
  barcode_source:   { type: DataTypes.ENUM('MANUAL','SCAN','IMPORT','GENERATED'), allowNull: true },
  barcode_verified: { type: DataTypes.BOOLEAN, defaultValue: false },

  purchase_price: { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 },
  sale_price:     { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 },
  vat_rate:       { type: DataTypes.DECIMAL(5,2),  allowNull: false, defaultValue: 0 },

  // Stock global = somme des quantity_remaining des lots actifs (recalculé, pas une source de vérité indépendante)
  stock_quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  stock_min:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

  requires_prescription: { type: DataTypes.BOOLEAN, defaultValue: false },
  marketplace_visible:   { type: DataTypes.BOOLEAN, defaultValue: false },

  description: { type: DataTypes.TEXT, allowNull: true },
  notice_url:  { type: DataTypes.STRING(500), allowNull: true }, // notice PDF
  image_url:   { type: DataTypes.STRING(500), allowNull: true },

  active: { type: DataTypes.BOOLEAN, defaultValue: true },

  // Rattachement au catalogue produit partagé (voir models/globalProduct.js) —
  // nullable : un médicament saisi manuellement n'a pas de fiche catalogue.
  global_product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  global_variant_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  tableName: 'pharmacy_medicines',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['organization_id', 'barcode'] },
    { fields: ['organization_id', 'name'] },
    { fields: ['global_product_id'] },
  ],
});

module.exports = PharmacyMedicine;
