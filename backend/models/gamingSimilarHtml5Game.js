'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Le pont SEO→Play : associe un jeu célèbre (GamingGame) à un jeu jouable
// existant (PlayGame). `approved=false` par défaut — jamais affiché
// publiquement tant qu'un admin (ou l'IA en assistance) ne l'a pas validé,
// même principe que le matching de discover/rubriques.js ("jamais de contenu
// fabriqué affiché sans validation"). Voir similarityService.js pour le calcul.
class GamingSimilarHtml5Game extends Model {}

GamingSimilarHtml5Game.init({
  id:             { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  gaming_game_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  play_game_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  match_score:    { type: DataTypes.DECIMAL(4, 3), allowNull: false, defaultValue: 0 },
  match_reasons:  { type: DataTypes.JSON, defaultValue: [] }, // ['genre','tags','universe','mechanics','view_mode','difficulty']
  source:         { type: DataTypes.ENUM('auto', 'ai_suggested', 'manual'), allowNull: false, defaultValue: 'manual' },
  approved:       { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  sort_order:     { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  sequelize,
  modelName: 'gaming_similar_html5_game',
  tableName: 'gaming_similar_html5_games',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['gaming_game_id', 'play_game_id'] },
    { fields: ['gaming_game_id', 'approved', 'sort_order'] },
  ],
});

module.exports = GamingSimilarHtml5Game;
