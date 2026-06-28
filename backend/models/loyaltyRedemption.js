'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class LoyaltyRedemption extends Model {}

LoyaltyRedemption.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  reward_id:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  points_spent:    { type: DataTypes.INTEGER, allowNull: false },
  coupon_code:     { type: DataTypes.STRING(32), allowNull: true },
  status: {
    type: DataTypes.ENUM('active', 'used', 'expired'),
    defaultValue: 'active',
  },
  expires_at:      { type: DataTypes.DATE, allowNull: true },
  used_at:         { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize,
  modelName: 'loyalty_redemption',
  tableName: 'loyalty_redemptions',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = LoyaltyRedemption;
