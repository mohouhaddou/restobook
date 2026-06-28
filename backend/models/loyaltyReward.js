'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class LoyaltyReward extends Model {}

LoyaltyReward.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  name:            { type: DataTypes.STRING(100), allowNull: false },
  description:     { type: DataTypes.STRING(255), allowNull: true },
  icon:            { type: DataTypes.STRING(10), defaultValue: '🎁' },
  points_cost:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  reward_type: {
    type: DataTypes.ENUM('discount_percent', 'discount_fixed', 'free_item', 'delivery_free'),
    allowNull: false,
  },
  reward_value:    { type: DataTypes.DECIMAL(8, 2), defaultValue: 0 },
  min_order:       { type: DataTypes.DECIMAL(8, 2), defaultValue: 0 },
  stock:           { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  used_count:      { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  active:          { type: DataTypes.BOOLEAN, defaultValue: true },
  valid_days:      { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 30 },
}, {
  sequelize,
  modelName: 'loyalty_reward',
  tableName: 'loyalty_rewards',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = LoyaltyReward;
