'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PharmacySaleItem extends Model {}

PharmacySaleItem.init({
  id:          { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  sale_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  medicine_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  lot_id:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, // lot décrémenté (traçabilité FEFO)

  product_name: { type: DataTypes.STRING(191), allowNull: false }, // snapshot du nom au moment de la vente
  quantity:     { type: DataTypes.INTEGER, allowNull: false },
  unit_price:   { type: DataTypes.DECIMAL(10,2), allowNull: false },
  discount_percent: { type: DataTypes.DECIMAL(5,2), allowNull: false, defaultValue: 0 },
  line_total:   { type: DataTypes.DECIMAL(10,2), allowNull: false },
}, {
  sequelize,
  tableName: 'pharmacy_sale_items',
  underscored: true,
  timestamps: true,
  indexes: [{ fields: ['sale_id'] }, { fields: ['medicine_id'] }],
});

module.exports = PharmacySaleItem;
