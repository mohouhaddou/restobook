'use strict';

// Mirroring backend/src/modules/discover/articleService.js's translation-join pattern, adapté à
// portal_contents (partagé kids/sports) : mêmes primitives (translationInclude/
// allTranslationsInclude/getXBySlug-avec-repli), mais règle plus stricte sur la langue manquante
// (jamais de repli silencieux vers le français, quelle que soit la langue demandée — voir
// getContentBySlug) puisque l'exigence explicite est "jamais de mélange entre langues".
const { Op } = require('sequelize');
const { PortalContent, PortalContentTranslation } = require('../../../models');
const { DEFAULT_LANGUAGE, normalizeLanguage } = require('./i18n');

const TRANSLATION_ATTRS = [
  'id', 'portal_content_id', 'portal', 'language', 'title', 'slug', 'excerpt', 'body',
  'metadata', 'seo_title', 'seo_description', 'seo_keywords', 'status',
];

function translationOf(content, language = DEFAULT_LANGUAGE) {
  const translations = content?.translations || [];
  const lang = normalizeLanguage(language);
  return translations.find(t => t.language === lang) || null;
}

// `publishedOnly` (défaut) : vue publique — n'expose jamais une traduction brouillon dans
// available_languages/language_urls. L'admin (édition) veut voir les brouillons aussi, d'où
// l'option pour désactiver ce filtre.
function allTranslationsInclude({ publishedOnly = true } = {}) {
  return { model: PortalContentTranslation, as: 'translations', attributes: TRANSLATION_ATTRS, required: false, ...(publishedOnly ? { where: { status: 'published' } } : {}) };
}

function translationInclude(portal, language, { required = true, search = null } = {}) {
  const where = { portal, language: normalizeLanguage(language), status: 'published' };
  if (search) {
    const q = String(search).trim();
    if (q) where[Op.or] = [{ title: { [Op.substring]: q } }, { excerpt: { [Op.substring]: q } }];
  }
  return { model: PortalContentTranslation, as: 'translations', attributes: TRANSLATION_ATTRS, where, required };
}

async function listContents(portal, { contentType = null, language = DEFAULT_LANGUAGE, search = null, page = 1, limit = 18 } = {}) {
  const lang = normalizeLanguage(language);
  const where = { portal, status: 'published' };
  if (contentType) where.content_type = contentType;
  const offset = (Math.max(1, page) - 1) * limit;
  const { count, rows } = await PortalContent.findAndCountAll({
    where,
    distinct: true,
    include: [translationInclude(portal, lang, { required: true, search })],
    order: [['featured', 'DESC'], ['sort_order', 'ASC'], ['published_at', 'DESC']],
    limit,
    offset,
  });
  return { count, page: Math.max(1, page), pages: Math.ceil(count / limit), items: rows };
}

async function listAllPublished(portal, { limit = 60 } = {}) {
  return PortalContent.findAll({
    where: { portal, status: 'published' },
    include: [allTranslationsInclude()],
    order: [['featured', 'DESC'], ['sort_order', 'ASC'], ['published_at', 'DESC']],
    limit,
  });
}

/**
 * Résout un contenu par slug — essaie d'abord (portal, language, slug) exact sur la table de
 * traduction ; à défaut retrouve le parent (via une traduction sur n'importe quelle langue, ou le
 * slug legacy de portal_contents) et signale `missingLanguage` sans jamais substituer
 * silencieusement une autre langue. Le routeur décide du 404 — ce service ne fait que renvoyer
 * l'information disponible (available_languages/language_urls) pour l'afficher.
 */
async function getContentBySlug(portal, slug, language = DEFAULT_LANGUAGE) {
  const lang = normalizeLanguage(language);

  const exact = await PortalContentTranslation.findOne({
    where: { portal, language: lang, slug, status: 'published' },
    include: [{ model: PortalContent, as: 'content', where: { status: 'published' }, include: [allTranslationsInclude()] }],
  });

  let content = exact?.content || null;
  let translation = exact || null;

  if (!content) {
    const anyTranslation = await PortalContentTranslation.findOne({
      where: { portal, slug },
      include: [{ model: PortalContent, as: 'content', where: { status: 'published' }, include: [allTranslationsInclude()] }],
    });
    content = anyTranslation?.content
      || await PortalContent.findOne({ where: { portal, slug, status: 'published' }, include: [allTranslationsInclude()] });
    if (!content) return null;
    translation = translationOf(content, lang);
  }

  const availableLanguages = (content.translations || []).map(t => t.language);
  const contentPath = content.content_type === 'stories' ? 'book' : 'content';
  const languageUrls = Object.fromEntries(
    (content.translations || []).map(t => [t.language, `/${portal}/${t.language}/${contentPath}/${t.slug}`]),
  );

  return {
    content,
    translation,
    missingLanguage: !translation,
    availableLanguages,
    languageUrls,
    language: lang,
  };
}

module.exports = { translationOf, allTranslationsInclude, translationInclude, listContents, listAllPublished, getContentBySlug };
