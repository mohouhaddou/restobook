'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Une ligne par (study_lesson_id, language) — même contrat que PortalContentTranslation.
// `body` est le markdown d'article.md tel que réécrit par le publisher (images remplacées par
// leurs URLs publiques) ; jamais de repli silencieux vers une autre langue à la lecture.
class StudyLessonTranslation extends Model {}

StudyLessonTranslation.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  study_lesson_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  language: { type: DataTypes.STRING(8), allowNull: false },

  title: { type: DataTypes.STRING(191), allowNull: false },
  slug: { type: DataTypes.STRING(191), allowNull: false },
  summary: { type: DataTypes.STRING(500), allowNull: true },
  body: { type: DataTypes.TEXT('long'), allowNull: true },

  objectives: { type: DataTypes.JSON, allowNull: true },
  skills: { type: DataTypes.JSON, allowNull: true },
  competencies: { type: DataTypes.JSON, allowNull: true },

  reading_time_minutes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

  seo_title: { type: DataTypes.STRING(191), allowNull: true },
  seo_description: { type: DataTypes.STRING(500), allowNull: true },
  seo_keywords: { type: DataTypes.JSON, allowNull: true },

  status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'published' },
}, {
  sequelize,
  modelName: 'study_lesson_translation',
  tableName: 'study_lesson_translations',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['study_lesson_id', 'language'] },
    { unique: true, fields: ['language', 'slug'] },
    { fields: ['language', 'status'] },
  ],
});

module.exports = StudyLessonTranslation;
