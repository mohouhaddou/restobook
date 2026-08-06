'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class GamingNews extends Model {}

GamingNews.init({
  id:             { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  gaming_game_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  title:          { type: DataTypes.STRING(191), allowNull: false },
  body:           { type: DataTypes.TEXT, allowNull: true },
  source_url:     { type: DataTypes.STRING(500), allowNull: true },
  published_at:   { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize,
  modelName: 'gaming_news',
  tableName: 'gaming_news',
  timestamps: true,
  updatedAt: false,
  underscored: true,
});

module.exports = GamingNews;
