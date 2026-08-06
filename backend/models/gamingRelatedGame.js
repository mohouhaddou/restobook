'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class GamingRelatedGame extends Model {}

GamingRelatedGame.init({
  id:                     { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  gaming_game_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  related_gaming_game_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  sort_order:             { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  sequelize,
  modelName: 'gaming_related_game',
  tableName: 'gaming_related_games',
  timestamps: true,
  updatedAt: false,
  underscored: true,
});

module.exports = GamingRelatedGame;
