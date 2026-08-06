'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class GamingFaq extends Model {}

GamingFaq.init({
  id:             { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  gaming_game_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  question:       { type: DataTypes.STRING(500), allowNull: false },
  answer:         { type: DataTypes.TEXT, allowNull: false },
  sort_order:     { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  sequelize,
  modelName: 'gaming_faq',
  tableName: 'gaming_faq',
  timestamps: true,
  updatedAt: false,
  underscored: true,
});

module.exports = GamingFaq;
