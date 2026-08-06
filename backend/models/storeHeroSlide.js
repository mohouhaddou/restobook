'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Hero carousel scopé à un commerce (organization_id) — même moteur visuel que
// MarketplaceHeroSlide (mêmes dimensions d'image, même service de scheduling),
// mais sans ciblage visiteur ni A/B (pas de sens pour un seul commerce).
class StoreHeroSlide extends Model {}

StoreHeroSlide.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

  title:           { type: DataTypes.STRING(191), allowNull: false },
  subtitle:        { type: DataTypes.STRING(255), allowNull: true },
  badge:           { type: DataTypes.STRING(64),  allowNull: true },
  discount_badge:  { type: DataTypes.STRING(16),  allowNull: true },
  discount_label:  { type: DataTypes.STRING(120), allowNull: true },

  image_desktop:   { type: DataTypes.STRING(500), allowNull: true },
  image_mobile:    { type: DataTypes.STRING(500), allowNull: true },
  illustration:    { type: DataTypes.STRING(500), allowNull: true },

  cta_text:        { type: DataTypes.STRING(64), allowNull: true },
  cta_type: {
    type: DataTypes.ENUM('product', 'category', 'promotion', 'internal_url', 'external_url'),
    allowNull: true,
  },
  cta_url:         { type: DataTypes.STRING(500), allowNull: true },

  position:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  animation:       { type: DataTypes.ENUM('fade', 'slide', 'zoom'), allowNull: false, defaultValue: 'fade' },
  // null => couleurs par défaut dérivées du business_type (businessConfig.getTheme)
  gradient:        { type: DataTypes.STRING(160), allowNull: true },
  text_color:      { type: DataTypes.STRING(32), allowNull: true },
  button_color:    { type: DataTypes.STRING(32), allowNull: true },

  start_date:      { type: DataTypes.DATEONLY, allowNull: true },
  end_date:        { type: DataTypes.DATEONLY, allowNull: true },
  start_time:      { type: DataTypes.STRING(5), allowNull: true },
  end_time:        { type: DataTypes.STRING(5), allowNull: true },

  status: { type: DataTypes.ENUM('draft', 'active', 'paused', 'archived'), allowNull: false, defaultValue: 'draft' },

  clicks:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  impressions: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },

  created_by:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  updated_by:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  modelName: 'storeHeroSlide',
  tableName: 'store_hero_slides',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['organization_id', 'status', 'position'] },
  ],
});

module.exports = StoreHeroSlide;
