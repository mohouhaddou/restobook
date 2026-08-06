'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class ProductOptionValue extends Model {}

ProductOptionValue.init({
  id:          { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  option_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  label:       { type: DataTypes.STRING(191), allowNull: false },
  extra_price: { type: DataTypes.DECIMAL(8,2), allowNull: false, defaultValue: 0 },
  available:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sort_order:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  sequelize,
  tableName:   'product_option_values',
  underscored: true,
  timestamps:  true,
  indexes: [
    { fields: ['option_id'] },
  ],
});

module.exports = ProductOptionValue;
