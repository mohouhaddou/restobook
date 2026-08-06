'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PlayUserMission extends Model {}

PlayUserMission.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  guest_id:        { type: DataTypes.CHAR(36), allowNull: true },
  mission_id:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  mission_date:    { type: DataTypes.DATEONLY, allowNull: false },
  progress_value:  { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  status: {
    type: DataTypes.ENUM('in_progress', 'completed', 'claimed'),
    defaultValue: 'in_progress',
  },
  completed_at:    { type: DataTypes.DATE, allowNull: true },
  claimed_at:      { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize,
  modelName: 'play_user_mission',
  tableName: 'play_user_missions',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = PlayUserMission;
