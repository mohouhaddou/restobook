'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class MenuCategory extends Model {}

MenuCategory.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  name:            { type: DataTypes.STRING(100), allowNull: false },
  description:     { type: DataTypes.STRING(255), allowNull: true },
  image_url:       { type: DataTypes.STRING(500), allowNull: true },
  sort_order:      { type: DataTypes.INTEGER, defaultValue: 0 },
  active:          { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  sequelize,
  modelName: 'menu_category',
  tableName: 'menu_categories',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['organization_id', 'sort_order'] }]
});

module.exports = MenuCategory;
