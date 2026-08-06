'use strict';

/**
 * Study — administration. Montées sous /api/superadmin/study.
 * Contrairement à backend/src/modules/portals/adminRoutes.js (contraint par le contrat plat
 * title_fr/en/ar hérité de l'éditeur existant), Study est un module neuf : le corps de
 * requête utilise directement la forme {lesson, translations[]}, pas de conversion aller-retour.
 * L'upload de ZIP réutilise l'import générique existant (/api/superadmin/ai-import,
 * manifest.module="study") — aucune route d'upload dédiée ici.
 */
const express = require('express');
const { Op } = require('sequelize');
const { param, query, body } = require('express-validator');
const validate = require('../../../middleware/validate');
const { requireAuth, requireSuperAdmin } = require('../../../middleware/auth');
const { StudyLesson, StudyLessonTranslation, StudyLessonResource } = require('../../../models');
const { SUPPORTED_LANGUAGES } = require('./i18n');
const { getStorageProvider } = require('../digitalProducts/storage');

const router = express.Router();
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const LESSON_FIELDS = [
  'slug', 'subject', 'grade', 'difficulty', 'estimated_duration_minutes',
  'cover_image_url', 'thumbnail_url', 'category', 'tags', 'keywords',
  'premium', 'status', 'featured', 'sort_order', 'publisher',
  'prerequisites', 'next_lessons', 'related_lessons', 'lesson_order', 'learning_path_slug', 'metadata',
];
const TRANSLATION_FIELDS = [
  'title', 'slug', 'summary', 'body', 'objectives', 'skills', 'competencies',
  'reading_time_minutes', 'seo_title', 'seo_description', 'seo_keywords', 'status',
];
const pick = (source, fields) => Object.fromEntries(fields.filter(key => source[key] !== undefined).map(key => [key, source[key]]));

const allTranslationsInclude = () => ({ model: StudyLessonTranslation, as: 'translations', required: false });
const resourcesInclude = () => ({ model: StudyLessonResource, as: 'resources', required: false });

async function upsertTranslations(lessonId, translations) {
  if (!Array.isArray(translations)) return;
  for (const entry of translations) {
    const language = String(entry.language || '').trim();
    if (!SUPPORTED_LANGUAGES.includes(language)) continue;
    const title = String(entry.title || '').trim();
    if (!title) continue; // pas de traduction sans titre — mirroring upsertTranslationsFromFlatBody (portals)
    // pick() omet `slug` si l'appelant ne l'a pas fourni — seule la création a besoin d'un repli
    // (slugifié depuis le titre) ; une mise à jour sans slug explicite laisse l'existant intact.
    const values = { ...pick(entry, TRANSLATION_FIELDS), title, language };
    const fallbackSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const [translation] = await StudyLessonTranslation.findOrCreate({
      where: { study_lesson_id: lessonId, language },
      defaults: { study_lesson_id: lessonId, language, ...values, slug: values.slug || fallbackSlug },
    });
    await translation.update(values);
  }
}

router.use(requireAuth, requireSuperAdmin);

router.get('/analytics', ah(async (req, res) => {
  const rows = await StudyLesson.findAll({ raw: true });
  res.json({
    summary: {
      lessons: rows.length,
      published: rows.filter(r => r.status === 'published').length,
      drafts: rows.filter(r => r.status === 'draft').length,
      premium: rows.filter(r => r.premium).length,
      views: rows.reduce((sum, r) => sum + Number(r.view_count || 0), 0),
    },
    bySubject: Object.values(rows.reduce((acc, r) => {
      const key = r.subject || 'other';
      if (!acc[key]) acc[key] = { subject: key, total: 0, published: 0, views: 0 };
      acc[key].total += 1;
      acc[key].published += r.status === 'published' ? 1 : 0;
      acc[key].views += Number(r.view_count || 0);
      return acc;
    }, {})).sort((a, b) => b.views - a.views),
  });
}));

router.get('/lessons', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['draft', 'published']),
  query('subject').optional().trim(),
  query('q').optional().trim().isLength({ max: 120 }),
], validate, ah(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 30);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.subject) where.subject = req.query.subject;
  if (req.query.q) where.slug = { [Op.substring]: req.query.q };
  const { rows, count } = await StudyLesson.findAndCountAll({
    where,
    include: [allTranslationsInclude()],
    order: [['updatedAt', 'DESC']],
    offset: (page - 1) * limit,
    limit,
    distinct: true,
  });
  res.json({
    items: rows.map(row => ({ ...row.toJSON(), translation_languages: (row.translations || []).map(t => t.language) })),
    total: count, page, pages: Math.ceil(count / limit),
  });
}));

router.get('/lessons/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const item = await StudyLesson.findOne({ where: { id: req.params.id }, include: [allTranslationsInclude(), resourcesInclude()] });
  if (!item) return res.status(404).json({ error: 'Leçon introuvable' });
  res.json({ item });
}));

router.get('/lessons/:id/resources', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const resources = await StudyLessonResource.findAll({ where: { study_lesson_id: req.params.id }, order: [['type', 'ASC']] });
  res.json({ resources });
}));

router.get('/lessons/:id/resources/:resourceId/download', [param('id').isInt({ min: 1 }), param('resourceId').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const resource = await StudyLessonResource.findOne({ where: { id: req.params.resourceId, study_lesson_id: req.params.id } });
  if (!resource) return res.status(404).json({ error: 'Ressource introuvable' });
  const provider = getStorageProvider();
  if (!(await provider.exists(resource.storage_path))) return res.status(404).json({ error: 'Fichier introuvable' });
  const mime = resource.format === 'markdown' ? 'text/markdown; charset=utf-8' : 'application/json; charset=utf-8';
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `attachment; filename="${resource.type}.${resource.format === 'markdown' ? 'md' : 'json'}"`);
  provider.getStream(resource.storage_path).pipe(res);
}));

router.post('/lessons', [
  body('lesson.slug').isString().trim().isLength({ min: 1, max: 191 }),
], validate, ah(async (req, res) => {
  const lesson = await StudyLesson.create(pick(req.body.lesson || {}, LESSON_FIELDS));
  await upsertTranslations(lesson.id, req.body.translations);
  const created = await StudyLesson.findOne({ where: { id: lesson.id }, include: [allTranslationsInclude(), resourcesInclude()] });
  res.status(201).json({ item: created });
}));

router.put('/lessons/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const item = await StudyLesson.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: 'Leçon introuvable' });
  await item.update(pick(req.body.lesson || {}, LESSON_FIELDS));
  await upsertTranslations(item.id, req.body.translations);
  const updated = await StudyLesson.findOne({ where: { id: item.id }, include: [allTranslationsInclude(), resourcesInclude()] });
  res.json({ item: updated });
}));

router.delete('/lessons/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const item = await StudyLesson.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: 'Leçon introuvable' });
  await item.destroy();
  res.json({ ok: true });
}));

// Duplique une leçon + ses traductions (pas ses ressources — elles restent propres à
// l'import d'origine) sous un nouveau slug, toujours en brouillon.
router.post('/lessons/:id/duplicate', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const source = await StudyLesson.findOne({ where: { id: req.params.id }, include: [allTranslationsInclude()] });
  if (!source) return res.status(404).json({ error: 'Leçon introuvable' });
  const slug = `${source.slug}-copy-${Date.now().toString(36)}`;
  const copy = await StudyLesson.create({
    ...pick(source.toJSON(), LESSON_FIELDS), slug, status: 'draft', featured: false, published_at: null,
  });
  for (const translation of source.translations || []) {
    await StudyLessonTranslation.create({
      ...pick(translation.toJSON(), TRANSLATION_FIELDS),
      study_lesson_id: copy.id, language: translation.language,
      slug: translation.language === 'en' ? slug : `${slug}-${translation.language}`,
      status: 'draft',
    });
  }
  const created = await StudyLesson.findOne({ where: { id: copy.id }, include: [allTranslationsInclude()] });
  res.status(201).json({ item: created });
}));

// Actions groupées — publish/unpublish/feature/unfeature/delete sur une sélection d'ids, ce que
// portals/adminRoutes.js n'offre pas encore (Study en a besoin dès le départ, voir le cahier des
// charges : "Bulk actions").
router.post('/bulk', [
  body('ids').isArray({ min: 1 }),
  body('ids.*').isInt({ min: 1 }),
  body('action').isIn(['publish', 'unpublish', 'feature', 'unfeature', 'delete']),
], validate, ah(async (req, res) => {
  const { ids, action } = req.body;
  if (action === 'delete') {
    const count = await StudyLesson.destroy({ where: { id: ids } });
    return res.json({ ok: true, affected: count });
  }
  const updates = {
    publish: { status: 'published', published_at: new Date() },
    unpublish: { status: 'draft' },
    feature: { featured: true },
    unfeature: { featured: false },
  }[action];
  const [count] = await StudyLesson.update(updates, { where: { id: ids } });
  res.json({ ok: true, affected: count });
}));

module.exports = router;
