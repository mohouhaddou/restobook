'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class ReviewPhoto extends Model {}

ReviewPhoto.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  review_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  image_url: { type: DataTypes.STRING(500), allowNull: false },
  sort_order: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
}, {
  sequelize,
  modelName: 'review_photo',
  tableName: 'review_photos',
  timestamps: true,
  updatedAt: false,
  underscored: true,
  indexes: [{ fields: ['review_id'] }],
});

module.exports = ReviewPhoto;
