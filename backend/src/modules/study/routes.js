'use strict';

/**
 * Study — routes consommateur. Montées sous /api/study (voir backend/routes/index.js).
 * Mirroring backend/src/modules/portals/routes.js (mêmes noms de route/comportement — favoris,
 * historique, progression), adapté aux colonnes dédiées de study_lessons (filtres réels plutôt
 * qu'un filtrage client) et aux ressources optionnelles (quiz/flashcards/...).
 */
const express = require('express');
const { param, query, body } = require('express-validator');
const validate = require('../../../middleware/validate');
const { StudyLesson, StudyLessonResource } = require('../../../models');
const StudyLessonFavorite = require('../../../models/studyLessonFavorite');
const StudyLessonProgress = require('../../../models/studyLessonProgress');
const { serializeLesson, serializeLessonCard } = require('./serializer');
const studyLessonService = require('./studyLessonService');
const { SUPPORTED_LANGUAGES, normalizeLanguage } = require('./i18n');
const { getStorageProvider } = require('../digitalProducts/storage');
const { resolveReader } = require('../portals/middleware/resolveReader');

const router = express.Router();
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const loadLessonBySlug = ah(async (req, res, next) => {
  const lang = normalizeLanguage(req.query.lang);
  const result = await studyLessonService.getLessonBySlug(req.params.slug, lang);
  if (!result) return res.status(404).json({ error: 'Leçon introuvable' });
  req.lessonItem = result.lesson;
  next();
});

router.get('/lessons', [
  query('subject').optional().trim().isLength({ max: 100 }),
  query('grade').optional().trim().isLength({ max: 50 }),
  query('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced']),
  query('premium').optional().isIn(['0', '1', 'true', 'false']),
  query('minDuration').optional().isInt({ min: 0 }),
  query('maxDuration').optional().isInt({ min: 0 }),
  query('tag').optional().trim().isLength({ max: 100 }),
  query('q').optional().trim().isLength({ max: 120 }),
  query('lang').optional().isIn(SUPPORTED_LANGUAGES),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], validate, ah(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 18);
  const lang = normalizeLanguage(req.query.lang);
  const premium = req.query.premium === undefined ? null : ['1', 'true'].includes(req.query.premium);
  const { items, count, pages } = await studyLessonService.listLessons({
    language: lang, search: req.query.q, page, limit,
    subject: req.query.subject, grade: req.query.grade, difficulty: req.query.difficulty,
    premium, minDuration: req.query.minDuration, maxDuration: req.query.maxDuration, tag: req.query.tag,
  });
  res.json({
    items: items.map(row => serializeLessonCard(row, studyLessonService.translationOf(row, lang))),
    page, pages, total: count,
  });
}));

router.get('/lessons/:slug', [
  param('slug').trim().isLength({ min: 1, max: 191 }),
  query('lang').optional().isIn(SUPPORTED_LANGUAGES),
], validate, resolveReader, ah(async (req, res) => {
  const lang = normalizeLanguage(req.query.lang);
  const result = await studyLessonService.getLessonBySlug(req.params.slug, lang);
  if (!result) return res.status(404).json({ error: 'Leçon introuvable' });
  if (result.missingLanguage) {
    return res.status(404).json({
      error: 'Pas encore disponible dans cette langue',
      missing_language: true,
      available_languages: result.availableLanguages,
      language_urls: result.languageUrls,
    });
  }

  const [resources, prerequisites, nextLessons, relatedLessons] = await Promise.all([
    StudyLessonResource.findAll({ where: { study_lesson_id: result.lesson.id }, order: [['type', 'ASC']] }),
    studyLessonService.resolveLessonRefs(result.lesson.prerequisites || [], lang),
    studyLessonService.resolveLessonRefs(result.lesson.next_lessons || [], lang),
    studyLessonService.resolveLessonRefs(result.lesson.related_lessons || [], lang),
  ]);

  StudyLesson.increment('view_count', { by: 1, where: { id: result.lesson.id } }).catch(() => {});

  res.json({
    item: {
      ...serializeLesson(result.lesson, result.translation, { withBody: true, resources, isAuthenticated: !req.isGuest }),
      available_languages: result.availableLanguages,
      language_urls: result.languageUrls,
      navigation: {
        prerequisites: prerequisites.map(r => serializeLessonCard(r.lesson, r.translation)),
        nextLessons: nextLessons.map(r => serializeLessonCard(r.lesson, r.translation)),
        relatedLessons: relatedLessons.map(r => serializeLessonCard(r.lesson, r.translation)),
      },
    },
  });
}));

// Téléchargement d'une ressource optionnelle (quiz.json, teacher_notes.md...) — public sauf si la
// leçon est premium, auquel cas une identité réelle est exigée (même logique de gate qu'un achat
// digitalProducts, en plus simple : pas d'achat par ressource, juste le flag premium de la leçon).
router.get('/lessons/:slug/resources/:resourceId/download', [
  param('slug').trim().isLength({ min: 1, max: 191 }),
  param('resourceId').isInt({ min: 1 }),
], validate, resolveReader, ah(async (req, res) => {
  const result = await studyLessonService.getLessonBySlug(req.params.slug, normalizeLanguage(req.query.lang));
  const lesson = result?.lesson;
  if (!lesson) return res.status(404).json({ error: 'Leçon introuvable' });
  if (lesson.premium && req.isGuest) return res.status(401).json({ error: 'Connexion requise pour ce contenu premium' });

  const resource = await StudyLessonResource.findOne({ where: { id: req.params.resourceId, study_lesson_id: lesson.id } });
  if (!resource) return res.status(404).json({ error: 'Ressource introuvable' });

  const provider = getStorageProvider();
  if (!(await provider.exists(resource.storage_path))) return res.status(404).json({ error: 'Fichier introuvable' });

  const mime = resource.format === 'markdown' ? 'text/markdown; charset=utf-8' : 'application/json; charset=utf-8';
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `inline; filename="${resource.type}.${resource.format === 'markdown' ? 'md' : 'json'}"`);
  provider.getStream(resource.storage_path).pipe(res);
}));

// Accueil Study — sections groupées par matière/niveau, même principe que
// backend/src/modules/portals/routes.js GET /:portal/overview.
router.get('/overview', [
  query('lang').optional().isIn(SUPPORTED_LANGUAGES),
], validate, ah(async (req, res) => {
  const lang = normalizeLanguage(req.query.lang);
  const rows = await studyLessonService.listAllPublished({ limit: 120 });
  const bySubject = {};
  const byGrade = {};
  const featured = [];
  const recentlyAdded = [];
  const popular = [];

  const sorted = [...rows].sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0));

  for (const row of sorted) {
    const translation = studyLessonService.translationOf(row, lang);
    if (!translation) continue; // jamais un contenu d'une autre langue dans les sections d'accueil
    const card = serializeLessonCard(row, translation);
    const subjectKey = row.subject || 'other';
    const gradeKey = row.grade || 'other';
    if (!bySubject[subjectKey]) bySubject[subjectKey] = [];
    if (bySubject[subjectKey].length < 8) bySubject[subjectKey].push(card);
    if (!byGrade[gradeKey]) byGrade[gradeKey] = [];
    if (byGrade[gradeKey].length < 8) byGrade[gradeKey].push(card);
    if (row.featured && featured.length < 8) featured.push(card);
    if (recentlyAdded.length < 8) recentlyAdded.push(card);
  }
  const byViews = [...rows]
    .filter(row => studyLessonService.translationOf(row, lang))
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 8);
  for (const row of byViews) popular.push(serializeLessonCard(row, studyLessonService.translationOf(row, lang)));

  res.json({ subjects: bySubject, grades: byGrade, featured, recentlyAdded, popular });
}));

// ── Favoris ──────────────────────────────────────────────────────────────────────────────────
router.get('/favorites', [query('lang').optional().isIn(SUPPORTED_LANGUAGES)], validate, resolveReader, ah(async (req, res) => {
  if (req.isGuest) return res.json({ favorites: [] });
  const lang = normalizeLanguage(req.query.lang);
  const favorites = await StudyLessonFavorite.findAll({ where: { user_id: req.readerId }, order: [['created_at', 'DESC']], raw: true });
  if (!favorites.length) return res.json({ favorites: [] });
  const lessonIds = favorites.map(row => row.study_lesson_id);
  const lessons = await StudyLesson.findAll({ where: { id: lessonIds }, include: [studyLessonService.allTranslationsInclude()] });
  const lessonById = new Map(lessons.map(l => [l.id, l]));
  res.json({
    favorites: favorites
      .filter(row => lessonById.has(row.study_lesson_id))
      .map(row => {
        const lesson = lessonById.get(row.study_lesson_id);
        const translation = studyLessonService.translationOf(lesson, lang);
        return translation ? { ...serializeLessonCard(lesson, translation), createdAt: row.created_at } : null;
      })
      .filter(Boolean),
  });
}));

router.post('/favorites/:slug', [query('lang').optional().isIn(SUPPORTED_LANGUAGES)], validate, resolveReader, loadLessonBySlug, ah(async (req, res) => {
  if (req.isGuest) return res.status(401).json({ error: 'Connexion requise pour synchroniser les favoris' });
  const [favorite] = await StudyLessonFavorite.findOrCreate({
    where: { user_id: req.readerId, study_lesson_id: req.lessonItem.id },
    defaults: { user_id: req.readerId, study_lesson_id: req.lessonItem.id },
  });
  res.status(201).json({ ok: true, favorite: { slug: req.lessonItem.slug, createdAt: favorite.created_at } });
}));

router.delete('/favorites/:slug', [query('lang').optional().isIn(SUPPORTED_LANGUAGES)], validate, resolveReader, loadLessonBySlug, ah(async (req, res) => {
  if (req.isGuest) return res.status(401).json({ error: 'Connexion requise pour synchroniser les favoris' });
  await StudyLessonFavorite.destroy({ where: { user_id: req.readerId, study_lesson_id: req.lessonItem.id } });
  res.json({ ok: true });
}));

// ── Historique / progression ────────────────────────────────────────────────────────────────
router.get('/history', [query('lang').optional().isIn(SUPPORTED_LANGUAGES), query('limit').optional().isInt({ min: 1, max: 50 })], validate, resolveReader, ah(async (req, res) => {
  if (req.isGuest) return res.json({ history: [] });
  const lang = normalizeLanguage(req.query.lang);
  const limit = Number(req.query.limit || 20);
  const progress = await StudyLessonProgress.findAll({ where: { user_id: req.readerId }, order: [['updated_at', 'DESC']], limit, raw: true });
  if (!progress.length) return res.json({ history: [] });
  const lessonIds = progress.map(row => row.study_lesson_id);
  const lessons = await StudyLesson.findAll({ where: { id: lessonIds }, include: [studyLessonService.allTranslationsInclude()] });
  const lessonById = new Map(lessons.map(l => [l.id, l]));
  res.json({
    history: progress
      .filter(row => lessonById.has(row.study_lesson_id))
      .map(row => {
        const lesson = lessonById.get(row.study_lesson_id);
        const translation = studyLessonService.translationOf(lesson, lang);
        if (!translation) return null;
        return {
          ...serializeLessonCard(lesson, translation),
          progress: {
            lastPosition: row.last_position,
            completionPercent: row.completion_percent,
            timeSpentSeconds: row.time_spent_seconds,
            completed: row.completed,
            quizScore: row.quiz_score,
            certificateEarned: row.certificate_earned,
            updatedAt: row.updated_at,
          },
        };
      })
      .filter(Boolean),
  });
}));

router.get('/progress/:slug', [query('lang').optional().isIn(SUPPORTED_LANGUAGES)], validate, resolveReader, loadLessonBySlug, ah(async (req, res) => {
  if (req.isGuest) return res.json({ progress: null });
  const row = await StudyLessonProgress.findOne({ where: { user_id: req.readerId, study_lesson_id: req.lessonItem.id } });
  if (!row) return res.json({ progress: null });
  res.json({
    progress: {
      lastPosition: row.last_position, completionPercent: row.completion_percent,
      timeSpentSeconds: row.time_spent_seconds, completed: row.completed,
      quizScore: row.quiz_score, certificateEarned: row.certificate_earned, updatedAt: row.updated_at,
    },
  });
}));

router.put('/progress/:slug', [
  query('lang').optional().isIn(SUPPORTED_LANGUAGES),
  body('lastPosition').isInt({ min: 0 }),
  body('completionPercent').optional().isInt({ min: 0, max: 100 }),
  body('timeSpentSeconds').optional().isInt({ min: 0 }),
  body('completed').optional().isBoolean(),
  body('quizScore').optional().isInt({ min: 0 }),
], validate, resolveReader, loadLessonBySlug, ah(async (req, res) => {
  if (req.isGuest) return res.status(401).json({ error: 'Connexion requise pour synchroniser la progression' });
  const { lastPosition, completionPercent = 0, timeSpentSeconds = 0, completed = false, quizScore = null } = req.body;
  const [row, created] = await StudyLessonProgress.findOrCreate({
    where: { user_id: req.readerId, study_lesson_id: req.lessonItem.id },
    defaults: { user_id: req.readerId, study_lesson_id: req.lessonItem.id, last_position: lastPosition, completion_percent: completionPercent, time_spent_seconds: timeSpentSeconds, completed, quiz_score: quizScore },
  });
  if (!created) {
    // Le temps passé s'accumule (un lecteur revient plusieurs fois sur la même leçon) — jamais
    // écrasé, contrairement aux autres champs qui reflètent le dernier état connu.
    await row.update({
      last_position: lastPosition,
      completion_percent: completionPercent,
      time_spent_seconds: row.time_spent_seconds + timeSpentSeconds,
      completed: completed || row.completed,
      quiz_score: quizScore != null ? quizScore : row.quiz_score,
      updated_at: new Date(),
    });
  }
  res.json({ ok: true });
}));

module.exports = router;
