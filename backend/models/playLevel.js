'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PlayLevel extends Model {}

PlayLevel.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  level_number:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  xp_threshold:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  name:            { type: DataTypes.STRING(60), allowNull: true },
  icon:            { type: DataTypes.STRING(10), allowNull: true },
  badge_reward_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  modelName: 'play_level',
  tableName: 'play_levels',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = PlayLevel;
