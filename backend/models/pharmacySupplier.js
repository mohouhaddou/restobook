'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PharmacySupplier extends Model {}

PharmacySupplier.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

  name:        { type: DataTypes.STRING(191), allowNull: false },
  phone:       { type: DataTypes.STRING(32),  allowNull: true },
  email:       { type: DataTypes.STRING(191), allowNull: true },
  address:     { type: DataTypes.STRING(255), allowNull: true },
  laboratory:  { type: DataTypes.STRING(191), allowNull: true }, // laboratoire/distributeur
  notes:       { type: DataTypes.TEXT, allowNull: true },
  active:      { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  sequelize,
  tableName: 'pharmacy_suppliers',
  underscored: true,
  timestamps: true,
  indexes: [{ fields: ['organization_id'] }],
});

module.exports = PharmacySupplier;
