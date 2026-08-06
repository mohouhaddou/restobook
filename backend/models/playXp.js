'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PlayXp extends Model {}

PlayXp.init({
  id:                   { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:              { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  guest_id:             { type: DataTypes.CHAR(36), allowNull: true },
  display_name:         { type: DataTypes.STRING(40), allowNull: true },
  avatar_icon:          { type: DataTypes.STRING(10), allowNull: true },
  total_xp:             { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  current_level:        { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 1 },
  icoins_balance:       { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  icoins_lifetime:      { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  current_streak_days:  { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  longest_streak_days:  { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  last_played_date:     { type: DataTypes.DATEONLY, allowNull: true },
}, {
  sequelize,
  modelName: 'play_xp',
  tableName: 'play_xp',
  timestamps: true,
  underscored: true,
});

module.exports = PlayXp;
