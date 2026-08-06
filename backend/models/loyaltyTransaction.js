'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class LoyaltyTransaction extends Model {}

LoyaltyTransaction.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  order_id:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  // Désambiguïse order_id entre orders.id et hanout_orders.id (deux séquences
  // AUTO_INCREMENT indépendantes qui peuvent porter la même valeur).
  pos_order_type: { type: DataTypes.ENUM('order', 'hanout_order'), allowNull: true },
  type: {
    type: DataTypes.ENUM('earn', 'spend', 'expire', 'bonus', 'birthday_bonus', 'levelup_bonus', 'reward_redemption', 'reversal'),
    allowNull: false,
  },
  points:         { type: DataTypes.INTEGER, allowNull: false },
  balance_after:  { type: DataTypes.INTEGER, allowNull: true },
  description:    { type: DataTypes.STRING(200), allowNull: true },
}, {
  sequelize,
  tableName: 'loyalty_transactions',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false, // la table n'a pas de colonne updated_at
  indexes: [
    { fields: ['user_id'] },
    { fields: ['organization_id'] },
    { fields: ['user_id', 'created_at'] },
  ],
});

module.exports = LoyaltyTransaction;
