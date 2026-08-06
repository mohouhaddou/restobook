'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PlayQuestion extends Model {}

PlayQuestion.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  quiz_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  question_type: {
    type: DataTypes.ENUM('multiple_choice', 'true_false', 'guess_place'),
    defaultValue: 'multiple_choice',
  },
  question_text:   { type: DataTypes.TEXT, allowNull: false },
  translations:    { type: DataTypes.JSON, allowNull: true },
  explanation:     { type: DataTypes.TEXT, allowNull: true },
  explanation_translations: { type: DataTypes.JSON, allowNull: true },
  discover_url:    { type: DataTypes.STRING(500), allowNull: true },
  image_url:       { type: DataTypes.STRING(500), allowNull: true },
  difficulty: {
    type: DataTypes.ENUM('easy', 'medium', 'hard'),
    allowNull: true,
  },
  points:          { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 10 },
  correct_lat:     { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  correct_lng:     { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  location_name:   { type: DataTypes.STRING(150), allowNull: true },
  tolerance_km:    { type: DataTypes.DECIMAL(6, 2), defaultValue: 5 },
  sort_order:      { type: DataTypes.INTEGER, defaultValue: 0 },
  active:          { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  sequelize,
  modelName: 'play_question',
  tableName: 'play_questions',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = PlayQuestion;
