'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PlayUserReward extends Model {}

PlayUserReward.init({
  id:            { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  guest_id:      { type: DataTypes.CHAR(36), allowNull: true },
  reward_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  icoins_spent:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  coupon_code:   { type: DataTypes.STRING(32), allowNull: true },
  status: {
    type: DataTypes.ENUM('active', 'used', 'expired'),
    defaultValue: 'active',
  },
  expires_at:    { type: DataTypes.DATE, allowNull: true },
  used_at:       { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize,
  modelName: 'play_user_reward',
  tableName: 'play_user_rewards',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = PlayUserReward;
