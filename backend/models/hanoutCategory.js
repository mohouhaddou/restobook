'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class HanoutCategory extends Model {}

HanoutCategory.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  name:            { type: DataTypes.STRING(100), allowNull: false },
  icon:            { type: DataTypes.STRING(20),  allowNull: true },  // emoji
  sort_order:      { type: DataTypes.INTEGER,     defaultValue: 0 },
  active:          { type: DataTypes.BOOLEAN,     defaultValue: true },
}, {
  sequelize,
  tableName:  'hanout_categories',
  underscored: true,
  timestamps:  true,
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['organization_id', 'active'] },
  ],
});

module.exports = HanoutCategory;
