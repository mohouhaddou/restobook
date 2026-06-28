'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const LoyaltyPoints = sequelize.define('LoyaltyPoints', {
  id:              { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  user_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  points:          { type: DataTypes.INTEGER, defaultValue: 0 },
  total_earned:    { type: DataTypes.INTEGER, defaultValue: 0 },
  total_spent:     { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'loyalty_points',
  underscored: true,
  timestamps: true,
  createdAt: false,
  updatedAt: 'updated_at',
});

module.exports = LoyaltyPoints;
