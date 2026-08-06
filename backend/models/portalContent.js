'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PortalContent extends Model {}

PortalContent.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  portal: { type: DataTypes.ENUM('sports', 'kids'), allowNull: false },
  content_type: { type: DataTypes.STRING(64), allowNull: false },
  slug: { type: DataTypes.STRING(191), allowNull: false },
  // Colonnes _fr/_en/_ar legacy — le titre/l'extrait/le corps vivent désormais sur
  // portal_content_translations (voir backend/models/portalContentTranslation.js). Conservées ici
  // en lecture seule le temps de la migration (voir backend/scripts/migrate_kids_i18n.js), non
  // écrites par le code applicatif ; suppression prévue dans une migration ultérieure séparée.
  title_fr: { type: DataTypes.STRING(191), allowNull: true },
  title_en: { type: DataTypes.STRING(191), allowNull: true },
  title_ar: { type: DataTypes.STRING(191), allowNull: true },
  excerpt_fr: { type: DataTypes.STRING(500), allowNull: true },
  excerpt_en: { type: DataTypes.STRING(500), allowNull: true },
  excerpt_ar: { type: DataTypes.STRING(500), allowNull: true },
  body_fr: { type: DataTypes.TEXT('long'), allowNull: true },
  body_en: { type: DataTypes.TEXT('long'), allowNull: true },
  body_ar: { type: DataTypes.TEXT('long'), allowNull: true },
  image_url: { type: DataTypes.STRING(500), allowNull: true },
  category: { type: DataTypes.STRING(100), allowNull: true },
  metadata: { type: DataTypes.JSON, allowNull: true },
  status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
  featured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  isPremium: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  previewLength: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1200 },
  premiumBadge: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'Premium' },
  sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  author_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  published_at: { type: DataTypes.DATE, allowNull: true },
  view_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  seo_title: { type: DataTypes.STRING(191), allowNull: true },
  seo_description: { type: DataTypes.STRING(500), allowNull: true },
}, {
  sequelize,
  modelName: 'portal_content',
  tableName: 'portal_contents',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['portal', 'slug'] },
    { fields: ['portal', 'content_type', 'status'] },
    { fields: ['portal', 'featured', 'sort_order'] },
  ],
});

module.exports = PortalContent;
