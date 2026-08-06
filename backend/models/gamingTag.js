'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class GamingTag extends Model {}

GamingTag.init({
  id:    { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  slug:  { type: DataTypes.STRING(100), unique: true, allowNull: false },
  label: { type: DataTypes.STRING(191), allowNull: false },
}, {
  sequelize,
  modelName: 'gaming_tag',
  tableName: 'gaming_tags',
  timestamps: false,
  underscored: true,
});

module.exports = GamingTag;
