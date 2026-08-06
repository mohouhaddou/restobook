'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PlayReward extends Model {}

PlayReward.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  name:            { type: DataTypes.STRING(100), allowNull: false },
  description:     { type: DataTypes.STRING(255), allowNull: true },
  icon:            { type: DataTypes.STRING(10), defaultValue: '🎁' },
  cost_icoins:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  reward_type: {
    type: DataTypes.ENUM('discount_percent', 'discount_fixed', 'free_item', 'delivery_free', 'cosmetic'),
    allowNull: false,
  },
  reward_value:    { type: DataTypes.DECIMAL(8, 2), defaultValue: 0 },
  stock:           { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  used_count:      { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  max_per_user:    { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 1 },
  valid_days:      { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 30 },
  active:          { type: DataTypes.BOOLEAN, defaultValue: true },
  sort_order:      { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  sequelize,
  modelName: 'play_reward',
  tableName: 'play_rewards',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = PlayReward;
