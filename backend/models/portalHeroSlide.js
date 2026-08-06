'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Hero carousel scopé à un portail (sports/kids) — même moteur visuel/services
// que MarketplaceHeroSlide/StoreHeroSlide (scheduling + upload WebP partagés),
// mais géré par le SuperAdmin (comme le contenu éditorial des portails) et sans
// ciblage visiteur ni A/B — un portail n'a qu'une seule bannière à la fois.
class PortalHeroSlide extends Model {}

PortalHeroSlide.init({
  id:     { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  portal: { type: DataTypes.ENUM('sports', 'kids'), allowNull: false },

  title:    { type: DataTypes.STRING(191), allowNull: false },
  subtitle: { type: DataTypes.STRING(255), allowNull: true },
  badge:    { type: DataTypes.STRING(64),  allowNull: true },

  image_desktop: { type: DataTypes.STRING(500), allowNull: true },
  image_mobile:  { type: DataTypes.STRING(500), allowNull: true },

  cta_text: { type: DataTypes.STRING(64), allowNull: true },
  cta_type: { type: DataTypes.ENUM('internal_url', 'external_url'), allowNull: true },
  cta_url:  { type: DataTypes.STRING(500), allowNull: true },

  position:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  animation: { type: DataTypes.ENUM('fade', 'slide', 'zoom'), allowNull: false, defaultValue: 'fade' },

  start_date: { type: DataTypes.DATEONLY, allowNull: true },
  end_date:   { type: DataTypes.DATEONLY, allowNull: true },
  start_time: { type: DataTypes.STRING(5), allowNull: true },
  end_time:   { type: DataTypes.STRING(5), allowNull: true },

  status: { type: DataTypes.ENUM('draft', 'active', 'paused', 'archived'), allowNull: false, defaultValue: 'draft' },

  clicks:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  impressions: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },

  created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  updated_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  modelName: 'portalHeroSlide',
  tableName: 'portal_hero_slides',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['portal', 'status', 'position'] },
  ],
});

module.exports = PortalHeroSlide;
