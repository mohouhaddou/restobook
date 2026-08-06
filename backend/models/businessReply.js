'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class BusinessReply extends Model {}

BusinessReply.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  review_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  business_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  reply: { type: DataTypes.TEXT, allowNull: false },
}, {
  sequelize,
  modelName: 'business_reply',
  tableName: 'business_replies',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['review_id'] },
    { fields: ['business_id'] },
    { fields: ['user_id'] },
  ],
});

module.exports = BusinessReply;
