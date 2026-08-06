'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class HanoutCredit extends Model {}

HanoutCredit.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  customer_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

  amount:      { type: DataTypes.DECIMAL(10,2), allowNull: false },
  paid_amount: { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 },
  products:    { type: DataTypes.TEXT, allowNull: true }, // description libre des produits achetés
  date:        { type: DataTypes.DATEONLY, allowNull: false },
  due_date:    { type: DataTypes.DATEONLY, allowNull: true },
  comment:     { type: DataTypes.TEXT, allowNull: true },
  invoice_photo_url: { type: DataTypes.STRING(500), allowNull: true },

  // 'pending' = aucun paiement, 'partial' = paiements partiels, 'paid' = soldé
  status: { type: DataTypes.ENUM('pending','partial','paid'), defaultValue: 'pending' },

  created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

  // Traçabilité vers la vente POS d'origine (nullable — un crédit peut aussi être saisi manuellement)
  pos_order_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  pos_order_type: { type: DataTypes.ENUM('order', 'hanout_order'), allowNull: true },
}, {
  sequelize,
  tableName: 'hanout_credits',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['customer_id'] },
    { fields: ['organization_id', 'due_date'] },
  ],
});

module.exports = HanoutCredit;
