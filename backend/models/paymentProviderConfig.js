'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Configuration d'un fournisseur de paiement — un row par provider, jamais un ENUM sur `provider`
// (même logique que digital_products.type) : ajouter Stripe/Google Pay demain = une nouvelle ligne
// en base (ou seedée par une migration), jamais un changement de schéma.
class PaymentProviderConfig extends Model {}

PaymentProviderConfig.init({
  id:       { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  provider: { type: DataTypes.STRING(40), allowNull: false, unique: true },

  enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  mode:    { type: DataTypes.ENUM('sandbox', 'production'), allowNull: false, defaultValue: 'sandbox' },
  default_currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'USD' },

  // Champs propres au provider (client_id/client_secret pour PayPal, autre chose pour Stripe
  // demain) — jamais renvoyé en clair par l'API de lecture (voir configService.js).
  config: { type: DataTypes.JSON, allowNull: true },

  updated_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  modelName: 'payment_provider_config',
  tableName: 'payment_providers',
  timestamps: true,
  underscored: true,
});

module.exports = PaymentProviderConfig;
