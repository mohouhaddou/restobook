'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class UserBadge extends Model {}

UserBadge.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  badge_id:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  earned_at:       { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  sequelize,
  modelName: 'user_badge',
  tableName: 'user_badges',
  timestamps: false,
});

module.exports = UserBadge;
