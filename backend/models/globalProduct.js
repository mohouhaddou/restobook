'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Fiche produit universelle du catalogue partagé — réutilisable par tous les
// commerces compatibles (hanout/épicerie/supermarché/boulangerie/boucherie/
// pharmacie/parapharmacie...). Ne décrit jamais une offre commerciale (prix,
// stock) : ça reste porté par HanoutProduct/PharmacyMedicine via
// global_product_id. Jamais utilisé pour MenuItem (plats préparés, sans
// code-barres réel — voir src/shared/utils/barcode.js).
class GlobalProduct extends Model {}

GlobalProduct.init({
  id:               { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  slug:             { type: DataTypes.STRING(191), allowNull: true, unique: true },
  name:             { type: DataTypes.STRING(191), allowNull: false },
  normalized_name:  { type: DataTypes.STRING(191), allowNull: false }, // pour dédup/recherche — voir productNormalizationService
  brand_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  category_id:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  description:      { type: DataTypes.TEXT, allowNull: true },
  image_url:        { type: DataTypes.STRING(500), allowNull: true },

  unit: {
    type: DataTypes.ENUM('pièce', 'kg', 'g', 'l', 'ml', 'paquet', 'boîte', 'bouteille', 'sac'),
    defaultValue: 'pièce',
  },

  // Code-barres global (pas par organisation, contrairement à HanoutProduct/PharmacyMedicine)
  barcode:        { type: DataTypes.STRING(32), allowNull: true, unique: true },
  barcode_type:   { type: DataTypes.ENUM('EAN13', 'EAN8', 'UPC_A', 'UPC_E', 'GTIN', 'CODE128', 'UNKNOWN'), allowNull: true },
  barcode_source: { type: DataTypes.ENUM('MANUAL', 'SCAN', 'IMPORT', 'GENERATED'), allowNull: true },

  // Cette passe (Phase 1+2) ne produit jamais que draft/pending_review — les
  // autres statuts existent pour éviter une migration future (validation
  // superadmin = Phase 4, non implémentée ici).
  status: {
    type: DataTypes.ENUM('draft', 'pending_review', 'verified', 'rejected', 'duplicate', 'archived'),
    defaultValue: 'pending_review',
  },

  tags: { type: DataTypes.JSON, defaultValue: [] },

  // Provenance — obligatoire dès qu'une donnée vient d'une source externe
  // (voir mission §6). 'manual' pour les fiches saisies à la main (défaut
  // implicite : NULL = saisie manuelle avant l'introduction de ce suivi).
  data_source:         { type: DataTypes.STRING(32), allowNull: true }, // 'manual' | 'openfoodfacts' | 'openfoodfacts_not_found'
  source_external_id:  { type: DataTypes.STRING(191), allowNull: true }, // ex: code-barres OFF utilisé pour la correspondance
  source_url:          { type: DataTypes.STRING(500), allowNull: true },
  license:             { type: DataTypes.STRING(255), allowNull: true },
  imported_at:         { type: DataTypes.DATE, allowNull: true },

  created_by_organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  created_by_user_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  verified_at:                { type: DataTypes.DATE, allowNull: true },
  verified_by_user_id:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  tableName: 'global_products',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['normalized_name'] },
    { fields: ['status'] },
    { fields: ['brand_id'] },
    { fields: ['category_id'] },
    { fields: ['data_source'] },
  ],
});

module.exports = GlobalProduct;
