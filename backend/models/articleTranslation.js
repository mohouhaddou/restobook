'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

class ArticleTranslation extends Model {}

ArticleTranslation.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  article_id:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  language:        { type: DataTypes.STRING(8), allowNull: false },
  title:           { type: DataTypes.STRING(191), allowNull: false },
  slug:            { type: DataTypes.STRING(191), allowNull: false },
  excerpt:         { type: DataTypes.STRING(500), allowNull: true },
  content_md:      { type: DataTypes.TEXT('long'), allowNull: true },
  seo_title:       { type: DataTypes.STRING(191), allowNull: true },
  seo_description: { type: DataTypes.STRING(500), allowNull: true },
  tags:            { type: DataTypes.JSON, defaultValue: [] },
  reading_time:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
}, {
  sequelize,
  modelName: 'articleTranslation',
  tableName: 'article_translations',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['article_id', 'language'] },
    { unique: true, fields: ['language', 'slug'] },
    { fields: ['language', 'title'] },
  ],
});

module.exports = ArticleTranslation;
