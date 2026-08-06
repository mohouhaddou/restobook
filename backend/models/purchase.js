'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Achat d'un DigitalProduct — payment_provider/payment_reference préparent un futur fournisseur
// réel (Stripe/PayPal/...) sans changer ce modèle ; aujourd'hui uniquement 'simulated' (voir
// backend/src/modules/digitalProducts/payments/).
class Purchase extends Model {}

Purchase.init({
  id:                 { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:            { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  digital_product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

  purchase_status: {
    type: DataTypes.ENUM('completed', 'refunded', 'failed'),
    allowNull: false, defaultValue: 'completed',
  },
  payment_provider:  { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'simulated' },
  payment_reference: { type: DataTypes.STRING(191), allowNull: false, unique: true },

  // Prix figé au moment de l'achat — n'évolue pas si le produit change de prix ensuite.
  price:    { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  currency: { type: DataTypes.STRING(3), allowNull: false },

  purchased_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  sequelize,
  modelName: 'purchase',
  tableName: 'purchases',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['user_id', 'digital_product_id'] },
  ],
});

module.exports = Purchase;
