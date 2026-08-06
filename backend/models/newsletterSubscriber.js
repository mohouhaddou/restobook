'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Capture email newsletter iFilino Discover — pas d'envoi réel (aucun ESP
// configuré dans ce projet), simple stockage dédupliqué pour l'instant.
class NewsletterSubscriber extends Model {}

NewsletterSubscriber.init({
  id:    { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING(191), unique: true, allowNull: false },
}, {
  sequelize,
  modelName: 'newsletter_subscriber',
  tableName: 'newsletter_subscribers',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = NewsletterSubscriber;
