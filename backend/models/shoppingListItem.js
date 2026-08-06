'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class ShoppingListItem extends Model {}

ShoppingListItem.init({
  id:       { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  list_id:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  name:     { type: DataTypes.STRING(191), allowNull: false },
  quantity: { type: DataTypes.STRING(50), allowNull: true }, // libre : "2L", "x3"… (repli si quantity_value/unit absents)
  checked:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

  quantity_value: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
  quantity_unit:  { type: DataTypes.STRING(16), allowNull: true },
  category:       { type: DataTypes.STRING(32), allowNull: true },
  category_user_set: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  estimated_price: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
  notes:          { type: DataTypes.STRING(255), allowNull: true },
  priority:       { type: DataTypes.ENUM('low', 'normal', 'high'), allowNull: false, defaultValue: 'normal' },
  is_favorite:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  brand:          { type: DataTypes.STRING(80), allowNull: true },
  quality_note:   { type: DataTypes.STRING(80), allowNull: true },
  preferred_organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  source_module:  { type: DataTypes.ENUM('hanout', 'pharmacie', 'resto'), allowNull: true },
  source_product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, // référence molle, pas de FK (comme favorites.target_id)
  image_url:      { type: DataTypes.STRING(255), allowNull: true },
  barcode:        { type: DataTypes.STRING(32), allowNull: true },
}, {
  sequelize,
  tableName: 'shopping_list_items',
  underscored: true,
  timestamps: true,
  updatedAt: false,
  indexes: [{ fields: ['list_id'] }],
});

module.exports = ShoppingListItem;
