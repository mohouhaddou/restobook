'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class OrderItemOption extends Model {}

OrderItemOption.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  order_item_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  order_item_type: { type: DataTypes.ENUM('hanout','menu','medicine'), allowNull: false, defaultValue: 'hanout' },

  // Snapshot of option at order time (option may be deleted later)
  option_id:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  option_name:  { type: DataTypes.STRING(191), allowNull: false },
  option_type:  { type: DataTypes.STRING(32),  allowNull: false },

  // For single_choice / multi_choice
  value_id:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  value_label: { type: DataTypes.STRING(191),      allowNull: true },

  extra_price: { type: DataTypes.DECIMAL(8,2), allowNull: false, defaultValue: 0 },

  // For text type
  text_value: { type: DataTypes.TEXT, allowNull: true },

  // For quantity / weight types
  numeric_value: { type: DataTypes.FLOAT, allowNull: true },
}, {
  sequelize,
  tableName:   'order_item_options',
  underscored: true,
  timestamps:  false,
  indexes: [
    { fields: ['order_item_id', 'order_item_type'] },
    { fields: ['option_id'] },
  ],
});

module.exports = OrderItemOption;
