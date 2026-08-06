'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class ReviewReport extends Model {}

ReviewReport.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  review_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  reason: { type: DataTypes.STRING(80), allowNull: false },
  comment: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.ENUM('pending', 'reviewed', 'dismissed', 'actioned'), allowNull: false, defaultValue: 'pending' },
}, {
  sequelize,
  modelName: 'review_report',
  tableName: 'review_reports',
  timestamps: true,
  updatedAt: false,
  underscored: true,
  indexes: [
    { fields: ['review_id'] },
    { fields: ['user_id'] },
    { fields: ['status'] },
  ],
});

module.exports = ReviewReport;
