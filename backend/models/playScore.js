'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PlayScore extends Model {}

PlayScore.init({
  id:                { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id:           { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  guest_id:          { type: DataTypes.CHAR(36), allowNull: true },
  game_id:           { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  session_id:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  quiz_id:           { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  score:             { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  max_score:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  correct_answers:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  total_questions:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  duration_seconds:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  difficulty: {
    type: DataTypes.ENUM('easy', 'medium', 'hard'),
    allowNull: true,
  },
  xp_earned:         { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  icoins_earned:     { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  meta:              { type: DataTypes.JSON, allowNull: true },
  played_at:         { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  sequelize,
  modelName: 'play_score',
  tableName: 'play_scores',
  timestamps: false,
});

module.exports = PlayScore;
