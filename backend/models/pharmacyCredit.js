'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PharmacyCredit extends Model {}

PharmacyCredit.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  customer_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  sale_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, // lien si généré automatiquement par une vente POS

  amount:      { type: DataTypes.DECIMAL(10,2), allowNull: false },
  paid_amount: { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 },
  products:    { type: DataTypes.TEXT, allowNull: true },
  date:        { type: DataTypes.DATEONLY, allowNull: false },
  due_date:    { type: DataTypes.DATEONLY, allowNull: true },
  comment:     { type: DataTypes.TEXT, allowNull: true },
  invoice_photo_url: { type: DataTypes.STRING(500), allowNull: true },

  status: { type: DataTypes.ENUM('pending','partial','paid'), defaultValue: 'pending' },

  created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  tableName: 'pharmacy_credits',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['customer_id'] },
    { fields: ['organization_id', 'due_date'] },
  ],
});

module.exports = PharmacyCredit;
