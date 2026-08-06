'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class AdCampaign extends Model {}

AdCampaign.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },

  name:            { type: DataTypes.STRING(191), allowNull: false },
  advertiser_name: { type: DataTypes.STRING(191), allowNull: true },
  advertiser_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, // informatif, pas de FK (annonceur peut ne pas être un compte du système)
  source_type:     { type: DataTypes.ENUM('internal', 'partner', 'adsense'), allowNull: false, defaultValue: 'internal' },
  description:     { type: DataTypes.TEXT, allowNull: true }, // note interne SuperAdmin, jamais affichée

  // Contenu créatif (internal / partner uniquement) — jamais de HTML brut, texte simple
  title:           { type: DataTypes.STRING(191), allowNull: true },
  desktop_image_url: { type: DataTypes.STRING(500), allowNull: true },
  mobile_image_url:  { type: DataTypes.STRING(500), allowNull: true },
  alt_text:          { type: DataTypes.STRING(255), allowNull: true },
  destination_url:   { type: DataTypes.STRING(500), allowNull: true }, // validé côté route (https obligatoire en prod, javascript: interdit)
  button_text:       { type: DataTypes.STRING(64),  allowNull: true },
  open_in_new_tab:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sponsored:         { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  background_color:  { type: DataTypes.STRING(32), allowNull: true },
  advertiser_logo_url: { type: DataTypes.STRING(500), allowNull: true },

  // AdSense — uniquement ces 5 paramètres whitelistés, jamais de script arbitraire
  publisher_id:          { type: DataTypes.STRING(64), allowNull: true },
  ad_slot_id:            { type: DataTypes.STRING(64), allowNull: true },
  ad_format:             { type: DataTypes.ENUM('auto', 'rectangle', 'horizontal', 'vertical', 'fluid'), allowNull: true },
  responsive:            { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  full_width_responsive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

  // Planification & diffusion
  start_at:        { type: DataTypes.DATE, allowNull: true },
  end_at:          { type: DataTypes.DATE, allowNull: true },
  timezone:        { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'Africa/Casablanca' },
  priority:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  rotation_weight: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
  max_impressions: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  max_clicks:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  frequency_cap:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, // max affichages par utilisateur
  session_cap:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, // max affichages par session
  days_of_week:    { type: DataTypes.JSON, allowNull: true }, // ex: [1,2,3,4,5] (0=dimanche)
  start_hour:      { type: DataTypes.STRING(5), allowNull: true }, // 'HH:mm'
  end_hour:        { type: DataTypes.STRING(5), allowNull: true },

  fallback_type:    { type: DataTypes.ENUM('internal_default', 'adsense', 'none'), allowNull: false, defaultValue: 'none' },
  requires_consent: { type: DataTypes.ENUM('none', 'analytics', 'advertising'), allowNull: false, defaultValue: 'none' },

  status: { type: DataTypes.ENUM('draft', 'scheduled', 'active', 'paused', 'expired', 'archived'), allowNull: false, defaultValue: 'draft' },

  // Compteurs dénormalisés (cap-checking rapide ; source de vérité = ad_impressions/ad_clicks)
  impressions_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  clicks_count:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },

  created_by:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  archived_at: { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize,
  modelName: 'adCampaign',
  tableName: 'ad_campaigns',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['start_at'] },
    { fields: ['end_at'] },
  ],
});

module.exports = AdCampaign;
