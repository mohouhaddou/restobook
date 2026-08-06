'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Mirroring PortalContentFavorite exactement — pas d'association Sequelize déclarée (jointure
// manuelle dans les routes), voir backend/models/studyLessonProgress.js pour le même choix.
class StudyLessonFavorite extends Model {}

StudyLessonFavorite.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  study_lesson_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  sequelize,
  modelName: 'study_lesson_favorite',
  tableName: 'study_lesson_favorites',
  timestamps: false,
  indexes: [
    { unique: true, fields: ['user_id', 'study_lesson_id'], name: 'uq_study_favorite_user_lesson' },
    { fields: ['user_id', 'created_at'], name: 'idx_study_favorite_user_created' },
  ],
});

module.exports = StudyLessonFavorite;
