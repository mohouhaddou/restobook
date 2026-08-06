'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Produit numérique vendable rattaché à une Story (portal_contents) — architecture générique :
// `type` est une chaîne libre (voir backend/src/modules/digitalProducts/config.js pour la liste
// curée), jamais un ENUM, pour ajouter un nouveau type de produit sans migration.
class DigitalProduct extends Model {}

DigitalProduct.init({
  id:               { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  portal_content_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  study_lesson_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

  // Langue de l'artefact généré (audio/PDF/coloriage) — nullable en transition, resserré une
  // fois le backfill 'fr' des produits existants confirmé (voir migrate_kids_i18n.js).
  language: { type: DataTypes.STRING(8), allowNull: true },

  type:  { type: DataTypes.STRING(40), allowNull: false },
  title: { type: DataTypes.STRING(191), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  cover_image_url: { type: DataTypes.STRING(500), allowNull: true },

  price:    { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'MAD' },

  // Markdown propre à ce produit (guide enseignant/parent, activity pack...) — null = le
  // générateur réutilise le corps de la Story elle-même (cas du PDF principal du livre).
  content_markdown: { type: DataTypes.TEXT('long'), allowNull: true },

  // État catalogue contrôlé par l'admin uniquement — la possession (achat) et la génération en
  // cours sont calculées à la volée par visiteur, jamais stockées ici (voir effectiveState.js).
  status: {
    type: DataTypes.ENUM('coming_soon', 'ready_to_generate', 'available', 'disabled'),
    allowNull: false, defaultValue: 'coming_soon',
  },

  position: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },

  created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  updated_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  modelName: 'digital_product',
  tableName: 'digital_products',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ["portal_content_id", "status"] },
    { fields: ["study_lesson_id", "status"] },
    { unique: true, fields: ["portal_content_id", "type", "language"] },
    { unique: true, fields: ["study_lesson_id", "type", "language"] },
  ],
});

module.exports = DigitalProduct;
