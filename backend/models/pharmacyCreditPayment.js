'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PharmacyCreditPayment extends Model {}

PharmacyCreditPayment.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  customer_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

  amount:  { type: DataTypes.DECIMAL(10,2), allowNull: false },
  method:  { type: DataTypes.ENUM('cash','card','transfer','mobile_money'), defaultValue: 'cash' },
  date:    { type: DataTypes.DATEONLY, allowNull: false },
  comment: { type: DataTypes.TEXT, allowNull: true },

  created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  tableName: 'pharmacy_credit_payments',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['customer_id'] },
  ],
});

module.exports = PharmacyCreditPayment;
