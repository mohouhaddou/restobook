'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PlaySession extends Model {}

PlaySession.init({
  id:                { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:           { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  guest_id:          { type: DataTypes.CHAR(36), allowNull: true },
  game_id:           { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  quiz_id:           { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  started_at:        { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  ended_at:          { type: DataTypes.DATE, allowNull: true },
  duration_seconds:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  status: {
    type: DataTypes.ENUM('started', 'completed', 'abandoned'),
    defaultValue: 'started',
  },
  device_type: {
    type: DataTypes.ENUM('mobile', 'desktop', 'tablet'),
    allowNull: true,
  },
}, {
  sequelize,
  modelName: 'play_session',
  tableName: 'play_sessions',
  timestamps: false,
});

module.exports = PlaySession;
