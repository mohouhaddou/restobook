'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PlayAnswer extends Model {}

PlayAnswer.init({
  id:            { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  question_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  answer_text:   { type: DataTypes.STRING(255), allowNull: false },
  translations:   { type: DataTypes.JSON, allowNull: true },
  is_correct:    { type: DataTypes.BOOLEAN, defaultValue: false },
  city_lat:      { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  city_lng:      { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  sort_order:    { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  sequelize,
  modelName: 'play_answer',
  tableName: 'play_answers',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = PlayAnswer;
