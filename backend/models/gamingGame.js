'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Fiche éditoriale d'un jeu tiers célèbre (Dofus, Minecraft, Fortnite...) —
// contenu SEO/éditorial uniquement, jamais un jeu distribué ou jouable sur
// iFilino. Ne pas confondre avec PlayGame/play_games (catalogue HTML5 jouable
// existant) : le pont entre les deux est GamingSimilarHtml5Game.
class GamingGame extends Model {}

GamingGame.init({
  id:                { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  slug:              { type: DataTypes.STRING(191), unique: true, allowNull: false },
  name:              { type: DataTypes.STRING(191), allowNull: false },
  publisher_id:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  category_id:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  platform_ids:      { type: DataTypes.JSON, defaultValue: [] },     // [gaming_platform.id, ...]
  tags:              { type: DataTypes.JSON, defaultValue: [] },     // [string, ...] — alimente le moteur de similarité
  genre:             { type: DataTypes.STRING(100), allowNull: true },
  universe:          { type: DataTypes.STRING(191), allowNull: true },
  mechanics:         { type: DataTypes.JSON, defaultValue: [] },     // ['crafting','pvp','open-world', ...]
  view_mode:         { type: DataTypes.ENUM('2d', '3d', 'top-down', 'isometric', 'side-scroll', 'first-person'), allowNull: true },
  difficulty:        { type: DataTypes.ENUM('easy', 'medium', 'hard'), allowNull: true },
  cover_image_url:   { type: DataTypes.STRING(500), allowNull: true },
  gallery:           { type: DataTypes.JSON, defaultValue: [] },
  description:       { type: DataTypes.TEXT, allowNull: true },
  presentation:      { type: DataTypes.TEXT, allowNull: true },
  why_popular:       { type: DataTypes.TEXT, allowNull: true },
  gameplay:          { type: DataTypes.TEXT, allowNull: true },
  configuration:     { type: DataTypes.JSON, allowNull: true },      // {min:{...}, recommended:{...}}
  release_date:      { type: DataTypes.DATEONLY, allowNull: true },
  official_links:    { type: DataTypes.JSON, defaultValue: [] },     // [{label, url}]
  sources:           { type: DataTypes.JSON, allowNull: true },      // [{label, url}] — jamais de contenu inventé sans source
  status:            { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
  seo_title:         { type: DataTypes.STRING(191), allowNull: true },
  seo_description:   { type: DataTypes.STRING(500), allowNull: true },
  generated_by_ai:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  author_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  published_at:      { type: DataTypes.DATE, allowNull: true },
  view_count:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
}, {
  sequelize,
  modelName: 'gaming_game',
  tableName: 'gaming_games',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['publisher_id'] },
    { fields: ['category_id'] },
  ],
});

module.exports = GamingGame;
