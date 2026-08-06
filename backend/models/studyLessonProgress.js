'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Mirroring PortalContentProgress (utilisateur connecté uniquement, invité = localStorage côté
// frontend) avec les champs propres à une leçon plutôt qu'à un livre paginé : position/complétion
// texte, temps passé, score de quiz, certificat obtenu. Pas d'association Sequelize déclarée avec
// StudyLesson — même choix que PortalContentProgress/PortalContentFavorite : jointure manuelle
// dans les routes pour rester découplé.
class StudyLessonProgress extends Model {}

StudyLessonProgress.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  study_lesson_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

  last_position: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  completion_percent: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
  time_spent_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  completed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  quiz_score: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  certificate_earned: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  sequelize,
  modelName: 'study_lesson_progress',
  tableName: 'study_lesson_progress',
  timestamps: false,
  indexes: [
    { unique: true, fields: ['user_id', 'study_lesson_id'], name: 'uq_study_progress_user_lesson' },
    { fields: ['user_id', 'updated_at'], name: 'idx_study_progress_user_updated' },
  ],
});

module.exports = StudyLessonProgress;
