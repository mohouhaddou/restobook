'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PlayQuiz extends Model {}

PlayQuiz.init({
  id:                  { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  game_id:             { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  slug:                { type: DataTypes.STRING(80), allowNull: false },
  title:               { type: DataTypes.STRING(150), allowNull: false },
  description:         { type: DataTypes.STRING(255), allowNull: true },
  category: {
    type: DataTypes.ENUM('quiz_maroc', 'culture', 'geography', 'gastronomy', 'history', 'sport'),
    allowNull: false,
  },
  difficulty: {
    type: DataTypes.ENUM('easy', 'medium', 'hard'),
    defaultValue: 'medium',
  },
  time_limit_seconds:  { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 20 },
  icon:                { type: DataTypes.STRING(10), allowNull: true },
  cover_image_url:     { type: DataTypes.STRING(500), allowNull: true },
  active:              { type: DataTypes.BOOLEAN, defaultValue: true },
  sort_order:          { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  sequelize,
  modelName: 'play_quiz',
  tableName: 'play_quizzes',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = PlayQuiz;
