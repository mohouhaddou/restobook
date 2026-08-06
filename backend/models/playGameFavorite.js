'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');
class PlayGameFavorite extends Model {}
PlayGameFavorite.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  game_slug: { type: DataTypes.STRING(64), allowNull: false },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { sequelize, modelName: 'play_game_favorite', tableName: 'play_game_favorites', timestamps: false, indexes: [
  { unique: true, fields: ['user_id', 'game_slug'], name: 'uq_play_favorite_user_game' },
  { fields: ['user_id', 'created_at'], name: 'idx_play_favorite_user_created' },
] });
module.exports = PlayGameFavorite;
