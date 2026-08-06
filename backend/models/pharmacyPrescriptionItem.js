'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PharmacyPrescriptionItem extends Model {}

PharmacyPrescriptionItem.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  prescription_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  medicine_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, // nullable si médicament non catalogué

  product_name: { type: DataTypes.STRING(191), allowNull: false }, // texte libre (toujours rempli, même si medicine_id présent)
  quantity:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  delivered:    { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  sequelize,
  tableName: 'pharmacy_prescription_items',
  underscored: true,
  timestamps: true,
  indexes: [{ fields: ['prescription_id'] }],
});

module.exports = PharmacyPrescriptionItem;
