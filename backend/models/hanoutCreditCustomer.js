'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class HanoutCreditCustomer extends Model {}

HanoutCreditCustomer.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

  name:        { type: DataTypes.STRING(191), allowNull: false },
  phone:       { type: DataTypes.STRING(32),  allowNull: false },
  address:     { type: DataTypes.STRING(255), allowNull: true },
  district:    { type: DataTypes.STRING(100), allowNull: true },
  photo_url:   { type: DataTypes.STRING(500), allowNull: true },

  credit_limit: { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 },
  // Solde courant (somme des crédits - somme des paiements), maintenu de façon transactionnelle
  balance:      { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 },

  last_purchase_at: { type: DataTypes.DATE, allowNull: true },
  last_payment_at:  { type: DataTypes.DATE, allowNull: true },

  notes:  { type: DataTypes.TEXT, allowNull: true },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  sequelize,
  modelName: 'HanoutCreditCustomer',
  tableName: 'hanout_credit_customers',
  underscored: true,
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['organization_id', 'phone'] },
  ],
});

module.exports = HanoutCreditCustomer;
