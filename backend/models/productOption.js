'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class ProductOption extends Model {}

ProductOption.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  entity_type:     { type: DataTypes.ENUM('hanout_product','menu_item','medicine'), allowNull: false },
  entity_id:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

  name:     { type: DataTypes.STRING(191), allowNull: false },
  type:     { type: DataTypes.ENUM('single_choice','multi_choice','quantity','weight','text','date_slot'), allowNull: false },
  unit:     { type: DataTypes.STRING(32),  allowNull: true },

  // For quantity / weight types
  min_value: { type: DataTypes.FLOAT,   allowNull: true },
  max_value: { type: DataTypes.FLOAT,   allowNull: true },
  step:      { type: DataTypes.FLOAT,   allowNull: true, defaultValue: 1 },

  // Fixed extra price for non-choice types (e.g. +5 MAD for text option)
  extra_price: { type: DataTypes.DECIMAL(8,2), allowNull: false, defaultValue: 0 },

  required:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  available:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  sequelize,
  tableName:   'product_options',
  underscored: true,
  timestamps:  true,
  indexes: [
    { fields: ['entity_type', 'entity_id'] },
    { fields: ['organization_id'] },
  ],
});

module.exports = ProductOption;
