'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class MarketplaceHeroSlide extends Model {}

MarketplaceHeroSlide.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },

  // Contenu
  title:           { type: DataTypes.STRING(191), allowNull: false },
  subtitle:        { type: DataTypes.STRING(255), allowNull: true },
  badge:           { type: DataTypes.STRING(64),  allowNull: true }, // "Ramadan", "Promo", "Nouveau"...
  discount_badge:  { type: DataTypes.STRING(16),  allowNull: true }, // "-25%" — badge circulaire flottant sur le visuel
  discount_label:  { type: DataTypes.STRING(120), allowNull: true }, // "Sur une sélection BBQ"
  campaign_label:  { type: DataTypes.STRING(120), allowNull: true }, // tag libre admin, jamais utilisé pour filtrer

  // Visuels (WebP générés par sharp — voir heroImageService.js)
  image_desktop:   { type: DataTypes.STRING(500), allowNull: true },
  image_mobile:    { type: DataTypes.STRING(500), allowNull: true },
  illustration:    { type: DataTypes.STRING(500), allowNull: true }, // overlay produit optionnel
  // Mini-tuiles "Catégories populaires" flottantes — tableau d'identifiants
  // NEED_CATEGORIES (frontend/src/config/needCategories.js), pas de nouvelle
  // taxonomie : réutilise les icônes/labels déjà construits pour la marketplace.
  featured_category_ids: { type: DataTypes.JSON, allowNull: true },

  // CTA
  cta_text:        { type: DataTypes.STRING(64), allowNull: true },
  cta_type: {
    type: DataTypes.ENUM('category', 'business', 'product', 'promotion', 'product_list', 'search', 'internal_url', 'external_url'),
    allowNull: true,
  },
  cta_url:         { type: DataTypes.STRING(500), allowNull: true }, // déjà résolu par l'éditeur (chemin interne ou URL externe)

  // Catégorisation — une étiquette, pas une feature séparée
  slide_type: {
    type: DataTypes.ENUM('seasonal_campaign', 'promotion', 'category', 'business', 'brand', 'product', 'new_arrival', 'announcement', 'event', 'custom_offer'),
    allowNull: false, defaultValue: 'promotion',
  },

  // Présentation
  priority:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 }, // tri secondaire admin
  position:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 }, // ordre carrousel (drag & drop)
  animation:       { type: DataTypes.ENUM('fade', 'slide', 'zoom'), allowNull: false, defaultValue: 'fade' },
  gradient:        { type: DataTypes.STRING(160), allowNull: true }, // override CSS ; null => var(--mk-hero-gradient)
  text_color:      { type: DataTypes.STRING(32), allowNull: true },
  button_color:    { type: DataTypes.STRING(32), allowNull: true },

  // Programmation (date + heure — voir heroSchedulingService.isSlideActiveNow)
  start_date:      { type: DataTypes.DATEONLY, allowNull: true },
  end_date:        { type: DataTypes.DATEONLY, allowNull: true },
  start_time:      { type: DataTypes.STRING(5), allowNull: true }, // 'HH:mm'
  end_time:        { type: DataTypes.STRING(5), allowNull: true },

  // Ciblage RÉEL — filtré par GET /marketplace/hero
  target_segment: {
    type: DataTypes.ENUM('all', 'new', 'regular', 'loyal', 'vip', 'inactive', 'at_risk'), // identique à Coupon.target_segment
    allowNull: false, defaultValue: 'all',
  },
  target_language: { type: DataTypes.STRING(5), allowNull: true }, // null = toutes langues ; matche User.preferred_language
  target_auth:     { type: DataTypes.ENUM('all', 'guest', 'logged_in'), allowNull: false, defaultValue: 'all' },

  // Ciblage PLACEHOLDER — colonnes réelles, jamais utilisées pour filtrer en Phase 1.
  // Affichées désactivées + tooltip "bientôt disponible" côté éditeur — jamais un
  // faux filtre silencieux qui prétend fonctionner.
  target_country:           { type: DataTypes.STRING(2), allowNull: true },
  target_city:              { type: DataTypes.STRING(100), allowNull: true },
  target_quartier:          { type: DataTypes.STRING(100), allowNull: true },
  target_premium:           { type: DataTypes.BOOLEAN, allowNull: true },
  target_family:            { type: DataTypes.BOOLEAN, allowNull: true },
  target_purchase_category: { type: DataTypes.STRING(100), allowNull: true },
  target_favorite_category: { type: DataTypes.STRING(100), allowNull: true },

  // A/B — recommandation heuristique simple (pas de vrai test statistique, voir heroStatsService)
  campaign_group_id:       { type: DataTypes.STRING(64), allowNull: true },
  ab_impression_threshold: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 200 },

  // Cycle de vie
  status: { type: DataTypes.ENUM('draft', 'active', 'paused', 'archived'), allowNull: false, defaultValue: 'draft' },

  // Compteurs dénormalisés (lecture rapide liste admin ; source de vérité = marketplace_hero_events)
  clicks:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  impressions: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },

  created_by:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  updated_by:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  modelName: 'marketplaceHeroSlide',
  tableName: 'marketplace_hero_slides',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['status', 'position'] },
    { fields: ['campaign_group_id'] },
  ],
});

module.exports = MarketplaceHeroSlide;
