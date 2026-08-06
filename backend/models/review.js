'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class Review extends Model {}

Review.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  business_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  user_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  order_id:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  pickup_code:     { type: DataTypes.STRING(16), allowNull: true, unique: true },
  rating:          { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
  title:           { type: DataTypes.STRING(191), allowNull: true },
  comment:         { type: DataTypes.TEXT, allowNull: true },
  trust_score:     { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
  verified:        { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  helpful_count:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  reply_count:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  report_count:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  status:          { type: DataTypes.ENUM('pending', 'published', 'hidden', 'rejected'), allowNull: false, defaultValue: 'published' },
  item_ratings:    { type: DataTypes.JSON, allowNull: true },
  sentiment:       { type: DataTypes.ENUM('positive', 'neutral', 'negative'), allowNull: true },
  sentiment_score: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
  issue_tags:      { type: DataTypes.JSON, allowNull: true },
  ai_summary:      { type: DataTypes.JSON, allowNull: true },
  analyzed_at:     { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize,
  modelName: 'review',
  tableName: 'reviews',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['business_id'] },
    { fields: ['organization_id'] },
    { fields: ['user_id'] },
    { fields: ['created_at'] },
    { unique: true, fields: ['business_id', 'user_id'] },
    { unique: true, fields: ['pickup_code'] }
  ]
});

module.exports = Review;
