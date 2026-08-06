'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class ReviewVote extends Model {}

ReviewVote.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  review_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  type: { type: DataTypes.ENUM('helpful', 'not_helpful'), allowNull: false },
}, {
  sequelize,
  modelName: 'review_vote',
  tableName: 'review_votes',
  timestamps: true,
  updatedAt: false,
  underscored: true,
  indexes: [
    { fields: ['review_id'] },
    { fields: ['user_id'] },
    { unique: true, fields: ['review_id', 'user_id'] },
  ],
});

module.exports = ReviewVote;
