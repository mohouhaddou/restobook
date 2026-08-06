'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PlayDailyMission extends Model {}

PlayDailyMission.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  code:            { type: DataTypes.STRING(64), allowNull: false },
  title:           { type: DataTypes.STRING(150), allowNull: false },
  description:     { type: DataTypes.STRING(255), allowNull: true },
  icon:            { type: DataTypes.STRING(10), allowNull: true },
  mission_type: {
    type: DataTypes.ENUM('play_games_count', 'win_games_count', 'quiz_correct_count', 'specific_game', 'earn_xp', 'earn_icoins'),
    allowNull: false,
  },
  target_value:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  game_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  xp_reward:       { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  icoins_reward:   { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  active:          { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  sequelize,
  modelName: 'play_daily_mission',
  tableName: 'play_daily_missions',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = PlayDailyMission;
