'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PlayBadge extends Model {}

PlayBadge.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  code:            { type: DataTypes.STRING(64), allowNull: false },
  name:            { type: DataTypes.STRING(100), allowNull: false },
  icon:            { type: DataTypes.STRING(10), defaultValue: '🏅' },
  description:     { type: DataTypes.STRING(255), allowNull: true },
  condition_type: {
    type: DataTypes.ENUM(
      'games_played_count',
      'score_threshold',
      'puzzle_completed_count',
      'quiz_correct_count',
      'category_wins',
      'time_window_sessions',
      'daily_streak',
      'manual'
    ),
    defaultValue: 'manual',
  },
  condition_value: { type: DataTypes.INTEGER, defaultValue: 1 },
  condition_meta:  { type: DataTypes.JSON, allowNull: true },
  xp_bonus:        { type: DataTypes.INTEGER, defaultValue: 0 },
  icoins_bonus:    { type: DataTypes.INTEGER, defaultValue: 0 },
  active:          { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  sequelize,
  modelName: 'play_badge',
  tableName: 'play_badges',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = PlayBadge;
