'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class PlayGame extends Model {}

PlayGame.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  slug:            { type: DataTypes.STRING(64), allowNull: false },
  name:            { type: DataTypes.STRING(100), allowNull: false },
  description:     { type: DataTypes.STRING(255), allowNull: true },
  game_type: {
    type: DataTypes.ENUM('2048', 'memory', 'puzzle_image', 'quiz', 'true_false', 'geo_quiz', 'guess_place', 'memory_cards', 'reaction_test', 'color_match', 'bubble_pop', 'brick_smash', 'tower_stack', 'penalty_master', 'snake', 'gamepix'),
    allowNull: false,
  },
  icon:            { type: DataTypes.STRING(10), defaultValue: '🎮' },
  config:          { type: DataTypes.JSON, allowNull: true },
  source:          { type: DataTypes.ENUM('internal', 'partner'), allowNull: false, defaultValue: 'internal' },
  provider_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  launch_url:      { type: DataTypes.STRING(500), allowNull: true },
  thumbnail_url:   { type: DataTypes.STRING(500), allowNull: true },
  category:        { type: DataTypes.STRING(64), allowNull: true },
  difficulty:      { type: DataTypes.ENUM('easy', 'medium', 'hard'), allowNull: false, defaultValue: 'medium' },
  average_duration:{ type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  supports_mobile: { type: DataTypes.BOOLEAN, defaultValue: true },
  supports_keyboard:{ type: DataTypes.BOOLEAN, defaultValue: false },
  supports_fullscreen:{ type: DataTypes.BOOLEAN, defaultValue: true },
  organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  active:          { type: DataTypes.BOOLEAN, defaultValue: true },
  is_hero:         { type: DataTypes.BOOLEAN, defaultValue: false },
  is_game_of_day:  { type: DataTypes.BOOLEAN, defaultValue: false },
  sort_order:      { type: DataTypes.INTEGER, defaultValue: 0 },
  // Taxonomie additive (Gaming Hub) — nourrit uniquement le moteur de
  // similarité gaminghub/similarityService.js, aucun effet sur le jeu lui-même.
  genre:           { type: DataTypes.STRING(100), allowNull: true },
  tags:            { type: DataTypes.JSON, allowNull: true },
  universe:        { type: DataTypes.STRING(191), allowNull: true },
  mechanics:       { type: DataTypes.JSON, allowNull: true },
  view_mode:       { type: DataTypes.ENUM('2d', '3d', 'top-down', 'isometric', 'side-scroll', 'first-person'), allowNull: true },
}, {
  sequelize,
  modelName: 'play_game',
  tableName: 'play_games',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = PlayGame;
