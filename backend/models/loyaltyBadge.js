'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class LoyaltyBadge extends Model {}

LoyaltyBadge.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  code:            { type: DataTypes.STRING(64), allowNull: false },
  name:            { type: DataTypes.STRING(100), allowNull: false },
  icon:            { type: DataTypes.STRING(10), defaultValue: '🏅' },
  description:     { type: DataTypes.STRING(255), allowNull: true },
  condition_type: {
    type: DataTypes.ENUM('orders_count', 'total_spent', 'points_earned', 'birthday', 'manual'),
    defaultValue: 'orders_count',
  },
  condition_value: { type: DataTypes.INTEGER, defaultValue: 1 },
  points_bonus:    { type: DataTypes.INTEGER, defaultValue: 0 },
  active:          { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  sequelize,
  modelName: 'loyalty_badge',
  tableName: 'loyalty_badges',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = LoyaltyBadge;
