'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Articles éditoriaux Gaming Hub (Top 20, comparatifs, astuces, actualités...)
// — même forme qu'Article (discover), traductions séparées dans
// GamingArticleTranslation (voir gamingArticleTranslation.js).
class GamingArticle extends Model {}

GamingArticle.init({
  id:                { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  slug:              { type: DataTypes.STRING(191), unique: true, allowNull: false },
  title:             { type: DataTypes.STRING(191), allowNull: false },
  excerpt:           { type: DataTypes.STRING(500), allowNull: true },
  cover_image_url:   { type: DataTypes.STRING(500), allowNull: true },
  article_type: {
    type: DataTypes.ENUM('actualite', 'guide', 'astuce', 'test', 'classement', 'comparatif', 'top', 'collection'),
    allowNull: false,
  },
  body:              { type: DataTypes.TEXT('long'), allowNull: true },
  gallery:           { type: DataTypes.JSON, defaultValue: [] },
  tags:              { type: DataTypes.JSON, defaultValue: [] },
  related_game_ids:  { type: DataTypes.JSON, defaultValue: [] }, // [gaming_game.id, ...]
  faq:               { type: DataTypes.JSON, allowNull: true },  // [{question, answer}]
  sources:           { type: DataTypes.JSON, allowNull: true },
  status:            { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
  author_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  published_at:      { type: DataTypes.DATE, allowNull: true },
  scheduled_at:      { type: DataTypes.DATE, allowNull: true },
  seo_title:         { type: DataTypes.STRING(191), allowNull: true },
  seo_description:   { type: DataTypes.STRING(500), allowNull: true },
  generated_by_ai:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  view_count:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
}, {
  sequelize,
  modelName: 'gaming_article',
  tableName: 'gaming_articles',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['status', 'article_type'] },
  ],
});

module.exports = GamingArticle;
