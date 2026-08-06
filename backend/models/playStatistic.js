'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PlayStatistic extends Model {}

PlayStatistic.init({
  id:                             { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  stat_date:                      { type: DataTypes.DATEONLY, allowNull: true },
  scope: {
    type: DataTypes.ENUM('daily', 'global'),
    allowNull: false,
  },
  organization_id:                { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  games_played_count:             { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  unique_players_count:           { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  unique_guests_count:            { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  xp_distributed:                 { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  icoins_distributed:             { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  avg_session_duration_seconds:   { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  top_game_id:                    { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  computed_at:                    { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize,
  modelName: 'play_statistic',
  tableName: 'play_statistics',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = PlayStatistic;
