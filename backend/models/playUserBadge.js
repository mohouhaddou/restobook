'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PlayUserBadge extends Model {}

PlayUserBadge.init({
  id:        { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  guest_id:  { type: DataTypes.CHAR(36), allowNull: true },
  badge_id:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  earned_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  sequelize,
  modelName: 'play_user_badge',
  tableName: 'play_user_badges',
  timestamps: false,
});

module.exports = PlayUserBadge;
