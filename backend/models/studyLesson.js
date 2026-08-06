'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// Parent langue-neutre d'une leçon Study (mirroring PortalContent) — la traduction (titre, corps,
// objectifs...) vit sur StudyLessonTranslation, cet id sert de translation_group_id, exactement
// comme pour les Stories. Contrairement à PortalContent, Study a ses propres colonnes indexées
// (subject/grade/difficulty/premium/duration) car le module a besoin de vrais filtres serveur —
// voir backend/src/modules/study/studyLessonService.js.
class StudyLesson extends Model {}

StudyLesson.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  slug: { type: DataTypes.STRING(191), allowNull: false },

  subject: { type: DataTypes.STRING(100), allowNull: true },
  grade: { type: DataTypes.STRING(50), allowNull: true },
  difficulty: { type: DataTypes.ENUM('beginner', 'intermediate', 'advanced'), allowNull: true },
  estimated_duration_minutes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

  cover_image_url: { type: DataTypes.STRING(500), allowNull: true },
  thumbnail_url: { type: DataTypes.STRING(500), allowNull: true },

  // Chaîne libre plutôt qu'ENUM — future sous-catégorie ("worksheet", "path"...) sans migration.
  category: { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'lesson' },

  tags: { type: DataTypes.JSON, allowNull: true },
  keywords: { type: DataTypes.JSON, allowNull: true },

  premium: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
  featured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

  author_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  publisher: { type: DataTypes.JSON, allowNull: true },

  // Tableaux de slugs — résolus à l'affichage, jamais de FK typée (une leçon peut référencer un
  // slug pas encore publié sans casser l'import).
  prerequisites: { type: DataTypes.JSON, allowNull: true },
  next_lessons: { type: DataTypes.JSON, allowNull: true },
  related_lessons: { type: DataTypes.JSON, allowNull: true },

  lesson_order: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  learning_path_slug: { type: DataTypes.STRING(191), allowNull: true },

  // Fourre-tout futur (badges, XP réf, config d'affichage...) — même philosophie que
  // PortalContent.metadata, jamais lu en dur par le moteur d'import/serializer.
  metadata: { type: DataTypes.JSON, allowNull: true },

  published_at: { type: DataTypes.DATE, allowNull: true },
  view_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
}, {
  sequelize,
  modelName: 'study_lesson',
  tableName: 'study_lessons',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['slug'] },
    { fields: ['status', 'featured', 'sort_order'] },
    { fields: ['subject', 'grade', 'difficulty'] },
    { fields: ['premium'] },
  ],
});

module.exports = StudyLesson;
