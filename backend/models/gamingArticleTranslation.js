'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Miroir exact d'ArticleTranslation (discover) — une ligne par langue FR/AR/EN.
class GamingArticleTranslation extends Model {}

GamingArticleTranslation.init({
  id:                { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  gaming_article_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  language:          { type: DataTypes.ENUM('ar', 'fr', 'en'), allowNull: false },
  title:             { type: DataTypes.STRING(191), allowNull: false },
  slug:              { type: DataTypes.STRING(191), allowNull: false },
  excerpt:           { type: DataTypes.STRING(500), allowNull: true },
  content_md:        { type: DataTypes.TEXT('long'), allowNull: true },
  seo_title:         { type: DataTypes.STRING(191), allowNull: true },
  seo_description:   { type: DataTypes.STRING(500), allowNull: true },
  tags:              { type: DataTypes.JSON, defaultValue: [] },
  reading_time:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  sequelize,
  modelName: 'gaming_article_translation',
  tableName: 'gaming_article_translations',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['gaming_article_id', 'language'] },
    { unique: true, fields: ['language', 'slug'] },
  ],
});

module.exports = GamingArticleTranslation;
