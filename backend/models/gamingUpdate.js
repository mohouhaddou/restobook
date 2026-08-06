'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class GamingUpdate extends Model {}

GamingUpdate.init({
  id:             { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  gaming_game_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  version:        { type: DataTypes.STRING(64), allowNull: true },
  title:          { type: DataTypes.STRING(191), allowNull: false },
  body:           { type: DataTypes.TEXT, allowNull: true },
  released_at:    { type: DataTypes.DATEONLY, allowNull: true },
}, {
  sequelize,
  modelName: 'gaming_update',
  tableName: 'gaming_updates',
  timestamps: true,
  updatedAt: false,
  underscored: true,
});

module.exports = GamingUpdate;
