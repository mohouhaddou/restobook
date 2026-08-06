'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PharmacyCustomer extends Model {}

// Client / patient de la pharmacie. Porte aussi le compte crédit (solde, plafond)
// pour éviter de dupliquer la fiche client entre "Clients" et "Crédits".
PharmacyCustomer.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

  name:       { type: DataTypes.STRING(191), allowNull: false },
  phone:      { type: DataTypes.STRING(32),  allowNull: false },
  birth_date: { type: DataTypes.DATEONLY, allowNull: true },
  address:    { type: DataTypes.STRING(255), allowNull: true },
  district:   { type: DataTypes.STRING(100), allowNull: true },
  photo_url:  { type: DataTypes.STRING(500), allowNull: true },

  credit_limit: { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 },
  balance:      { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 },

  last_purchase_at: { type: DataTypes.DATE, allowNull: true },
  last_payment_at:  { type: DataTypes.DATE, allowNull: true },

  // Notes internes pharmacien — jamais exposées au client/marketplace
  notes:  { type: DataTypes.TEXT, allowNull: true },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  sequelize,
  tableName: 'pharmacy_customers',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['organization_id', 'phone'] },
  ],
});

module.exports = PharmacyCustomer;
