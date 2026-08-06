'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PlayGameReport extends Model {}
PlayGameReport.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  guest_id: { type: DataTypes.STRING(64), allowNull: true },
  game_slug: { type: DataTypes.STRING(64), allowNull: false },
  reason: { type: DataTypes.ENUM('loading', 'controls', 'display', 'other'), allowNull: false },
  details: { type: DataTypes.STRING(500), allowNull: true },
  page_url: { type: DataTypes.STRING(500), allowNull: true },
  status: { type: DataTypes.ENUM('open', 'reviewed', 'closed'), allowNull: false, defaultValue: 'open' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { sequelize, modelName: 'play_game_report', tableName: 'play_game_reports', timestamps: false, indexes: [
  { fields: ['game_slug', 'status', 'created_at'], name: 'idx_play_report_game_status' },
  { fields: ['user_id', 'created_at'], name: 'idx_play_report_user_created' },
  { fields: ['guest_id', 'created_at'], name: 'idx_play_report_guest_created' },
] });

module.exports = PlayGameReport;
