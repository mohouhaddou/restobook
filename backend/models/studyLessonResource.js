'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Registre extensible des fichiers optionnels d'un package Study (quiz.json, flashcards.json,
// teacher_notes.md, ...). `type` est une chaîne libre — même choix que DigitalProduct.type —
// pour qu'un nouveau type de ressource n'exige jamais de migration. `language` nullable = partagé
// entre toutes les langues de la leçon (cas le plus courant : un quiz.json unique).
class StudyLessonResource extends Model {}

StudyLessonResource.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  study_lesson_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  language: { type: DataTypes.STRING(8), allowNull: true },

  type: { type: DataTypes.STRING(64), allowNull: false },
  format: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'json' },

  storage_path: { type: DataTypes.STRING(500), allowNull: false },
  public_url: { type: DataTypes.STRING(500), allowNull: true },

  checksum: { type: DataTypes.STRING(64), allowNull: true },
  size: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
}, {
  sequelize,
  modelName: 'study_lesson_resource',
  tableName: 'study_lesson_resources',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['study_lesson_id', 'language', 'type'] },
    { fields: ['study_lesson_id', 'type'] },
  ],
});

module.exports = StudyLessonResource;
