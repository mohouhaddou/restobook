'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class CashbackTransaction extends Model {}

CashbackTransaction.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, // commerce d'origine (earn) — null pour use/expire/adjust
  order_id:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  // Désambiguïse order_id entre orders.id et hanout_orders.id (deux séquences
  // AUTO_INCREMENT indépendantes qui peuvent porter la même valeur).
  pos_order_type: { type: DataTypes.ENUM('order', 'hanout_order'), allowNull: true },
  type: {
    type: DataTypes.ENUM('earn', 'use', 'expire', 'adjust'),
    allowNull: false,
  },
  amount:        { type: DataTypes.DECIMAL(10, 2), allowNull: false }, // toujours positif, le sens est donné par `type`
  balance_after: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  description:   { type: DataTypes.STRING(200), allowNull: true },
}, {
  sequelize,
  tableName: 'cashback_transactions',
  underscored: true,
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['user_id', 'created_at'] },
  ],
});

module.exports = CashbackTransaction;
