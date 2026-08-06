'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');
const { USER_ROLE_VALUES } = require('../auth/permissions');

class User extends Model {}

User.init({
  matricule:       { type: DataTypes.STRING, allowNull: false },
  nom:             { type: DataTypes.STRING, allowNull: true },
  email:           { type: DataTypes.STRING, allowNull: true },
  phone:           { type: DataTypes.STRING(32), allowNull: true },
  avatar_url:      { type: DataTypes.STRING(500), allowNull: true },
  role: {
    type: DataTypes.ENUM(...USER_ROLE_VALUES),
    defaultValue: 'user'
  },
  hash_mdp:        { type: DataTypes.STRING, allowNull: true },
  actif:                       { type: DataTypes.BOOLEAN, defaultValue: true },
  organization_id:             { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  email_verified:              { type: DataTypes.BOOLEAN, defaultValue: false },
  email_verification_token:    { type: DataTypes.STRING(255), allowNull: true },
  email_verification_expires:  { type: DataTypes.DATE, allowNull: true },
  // Auth Google (Google Identity Services) — voir migrate_google_auth.js.
  google_id:                   { type: DataTypes.STRING(255), allowNull: true, unique: true },
  auth_provider: {
    type: DataTypes.ENUM('local', 'google'),
    allowNull: false,
    defaultValue: 'local',
  },
  last_login_at:               { type: DataTypes.DATE, allowNull: true },
  // Colonnes ajoutées historiquement via migrations brutes (migrate_loyalty.js,
  // migrate_v4.js) mais jamais déclarées ici — rattrapage, aucun changement de schéma.
  birthday:        { type: DataTypes.DATEONLY, allowNull: true },
  segment: {
    type: DataTypes.ENUM('new', 'regular', 'loyal', 'vip', 'inactive', 'at_risk'),
    defaultValue: 'new',
  },
  preferred_language: { type: DataTypes.STRING(5), allowNull: false, defaultValue: 'en' },
  loyalty_points:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  onboarding_done:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  // Map { [notification_type_or_category]: ['push','in_app',...] } — null = tout par défaut
  // (voir NotificationService.effectiveChannels pour les valeurs par défaut).
  notification_prefs: { type: DataTypes.JSON, allowNull: true },
}, {
  sequelize,
  modelName: 'user',
  timestamps: true,
});

module.exports = User;
