'use strict';

// Mirroring backend/src/modules/portals/portalContentService.js (translation-join pattern, jamais
// de repli silencieux vers une autre langue) — étendu avec de vrais filtres serveur (subject,
// grade, difficulty, durée, premium, tag) puisque Study a des colonnes indexées pour ça,
// contrairement à portal_contents.metadata (JSON libre, non indexé).
const { Op, fn, col, where: sqlWhere, literal } = require('sequelize');
const { StudyLesson, StudyLessonTranslation } = require('../../../models');
const { DEFAULT_LANGUAGE, normalizeLanguage } = require('./i18n');

const TRANSLATION_ATTRS = [
  'id', 'study_lesson_id', 'language', 'title', 'slug', 'summary', 'body',
  'objectives', 'skills', 'competencies', 'reading_time_minutes',
  'seo_title', 'seo_description', 'seo_keywords', 'status',
];

function translationOf(lesson, language = DEFAULT_LANGUAGE) {
  const translations = lesson?.translations || [];
  const lang = normalizeLanguage(language);
  return translations.find(t => t.language === lang) || null;
}

function allTranslationsInclude({ publishedOnly = true } = {}) {
  return { model: StudyLessonTranslation, as: 'translations', attributes: TRANSLATION_ATTRS, required: false, ...(publishedOnly ? { where: { status: 'published' } } : {}) };
}

function translationInclude(language, { required = true } = {}) {
  const where = { language: normalizeLanguage(language), status: 'published' };
  return { model: StudyLessonTranslation, as: 'translations', attributes: TRANSLATION_ATTRS, where, required };
}

/**
 * Résout les identifiants de leçons dont le titre/résumé (langue demandée) OU les
 * keywords/tags du parent contiennent `search`. Deux requêtes ciblées et une union en mémoire
 * plutôt qu'une jointure OR complexe — largement suffisant pour un volume éditorial (des
 * centaines de leçons, pas des millions), et beaucoup plus lisible/robuste qu'une clause SQL
 * composite mêlant table jointe et colonnes JSON castées.
 */
async function searchMatchingLessonIds(search, language) {
  const q = String(search || '').trim();
  if (!q) return null;
  const like = `%${q}%`;
  const lang = normalizeLanguage(language);

  const [byTranslation, byTaxonomy] = await Promise.all([
    StudyLessonTranslation.findAll({
      where: { language: lang, status: 'published', [Op.or]: [{ title: { [Op.substring]: q } }, { summary: { [Op.substring]: q } }] },
      attributes: ['study_lesson_id'],
      raw: true,
    }),
    StudyLesson.findAll({
      where: {
        status: 'published',
        [Op.or]: [
          sqlWhere(literal('CAST(`keywords` AS CHAR)'), { [Op.substring]: like }),
          sqlWhere(literal('CAST(`tags` AS CHAR)'), { [Op.substring]: like }),
        ],
      },
      attributes: ['id'],
      raw: true,
    }),
  ]);

  return [...new Set([...byTranslation.map(r => r.study_lesson_id), ...byTaxonomy.map(r => r.id)])];
}

async function listLessons(options = {}) {
  const {
    language = DEFAULT_LANGUAGE, search = null, page = 1, limit = 18,
    subject = null, grade = null, difficulty = null, premium = null,
    minDuration = null, maxDuration = null, tag = null,
  } = options;
  const lang = normalizeLanguage(language);
  const where = { status: 'published' };
  if (subject) where.subject = subject;
  if (grade) where.grade = grade;
  if (difficulty) where.difficulty = difficulty;
  if (premium === true || premium === false) where.premium = premium;
  if (minDuration != null || maxDuration != null) {
    where.estimated_duration_minutes = {};
    if (minDuration != null) where.estimated_duration_minutes[Op.gte] = Number(minDuration);
    if (maxDuration != null) where.estimated_duration_minutes[Op.lte] = Number(maxDuration);
  }
  if (tag) {
    where[Op.and] = [sqlWhere(fn('JSON_CONTAINS', col('tags'), JSON.stringify(String(tag))), 1)];
  }
  if (search) {
    const matchingIds = await searchMatchingLessonIds(search, lang);
    if (!matchingIds.length) return { count: 0, page: Math.max(1, page), pages: 0, items: [] };
    where.id = { [Op.in]: matchingIds };
  }

  const offset = (Math.max(1, page) - 1) * limit;
  const { count, rows } = await StudyLesson.findAndCountAll({
    where,
    distinct: true,
    include: [translationInclude(lang, { required: true })],
    order: [['featured', 'DESC'], ['sort_order', 'ASC'], ['published_at', 'DESC']],
    limit,
    offset,
  });
  return { count, page: Math.max(1, page), pages: Math.ceil(count / limit), items: rows };
}

async function listAllPublished({ limit = 60 } = {}) {
  return StudyLesson.findAll({
    where: { status: 'published' },
    include: [allTranslationsInclude()],
    order: [['featured', 'DESC'], ['sort_order', 'ASC'], ['published_at', 'DESC']],
    limit,
  });
}

/**
 * Résout une leçon par slug — même contrat que portalContentService.getContentBySlug : jamais de
 * repli silencieux vers une autre langue, `missingLanguage` + available_languages/language_urls
 * laissés au routeur pour afficher un écran "pas encore disponible".
 */
async function getLessonBySlug(slug, language = DEFAULT_LANGUAGE) {
  const lang = normalizeLanguage(language);

  const exact = await StudyLessonTranslation.findOne({
    where: { language: lang, slug, status: 'published' },
    include: [{ model: StudyLesson, as: 'lesson', where: { status: 'published' }, include: [allTranslationsInclude()] }],
  });

  let lesson = exact?.lesson || null;
  let translation = exact || null;

  if (!lesson) {
    const anyTranslation = await StudyLessonTranslation.findOne({
      where: { slug },
      include: [{ model: StudyLesson, as: 'lesson', where: { status: 'published' }, include: [allTranslationsInclude()] }],
    });
    lesson = anyTranslation?.lesson
      || await StudyLesson.findOne({ where: { slug, status: 'published' }, include: [allTranslationsInclude()] });
    if (!lesson) return null;
    translation = translationOf(lesson, lang);
  }

  const availableLanguages = (lesson.translations || []).map(t => t.language);
  // Study vit dans la section "Learn" de Kids (nav déjà existante) — jamais un /study/... séparé.
  const languageUrls = Object.fromEntries(
    (lesson.translations || []).map(t => [t.language, `/kids/${t.language}/learn/${t.slug}`]),
  );

  return {
    lesson, translation, missingLanguage: !translation,
    availableLanguages, languageUrls, language: lang,
  };
}

/** Résout des slugs de leçons (prérequis/suivantes/liées) vers leurs cartes sérialisables. */
async function resolveLessonRefs(slugs, language) {
  if (!Array.isArray(slugs) || !slugs.length) return [];
  const lang = normalizeLanguage(language);
  const lessons = await StudyLesson.findAll({
    where: { slug: slugs, status: 'published' },
    include: [allTranslationsInclude()],
  });
  const bySlug = new Map(lessons.map(l => [l.slug, l]));
  return slugs
    .map(slug => bySlug.get(slug))
    .filter(Boolean)
    .map(lesson => ({ lesson, translation: translationOf(lesson, lang) }))
    .filter(entry => entry.translation);
}

module.exports = {
  translationOf, allTranslationsInclude, translationInclude,
  listLessons, listAllPublished, getLessonBySlug, resolveLessonRefs,
};
