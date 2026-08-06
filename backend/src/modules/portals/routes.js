'use strict';

const express = require('express');
const { param, query, body } = require('express-validator');
const validate = require('../../../middleware/validate');
const { PortalContent } = require('../../../models');
const PortalContentFavorite = require('../../../models/portalContentFavorite');
const PortalContentProgress = require('../../../models/portalContentProgress');
const { getPortal } = require('./config');
const { serializeContent } = require('./serializer');
const portalContentService = require('./portalContentService');
const { SUPPORTED_LANGUAGES, normalizeLanguage } = require('./i18n');
const { trackTraffic } = require('../../../utils/traffic');
const { resolveReader } = require('./middleware/resolveReader');

const router = express.Router();
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.param('portal', (req, res, next, value) => {
  if (!getPortal(value)) return res.status(404).json({ error: 'Portail introuvable' });
  req.portal = value;
  next();
});

// Résout `req.contentItem` (le parent langue-neutre) à partir du slug — utilisé par les routes
// favoris/progression, qui travaillent sur l'id interne (portal_content_id), jamais le slug
// directement. Le slug peut être celui d'une traduction (nouvelles URLs /:lang/...) ou le slug
// legacy du parent (anciennes URLs) — voir portalContentService.getContentBySlug.
const loadContentBySlug = ah(async (req, res, next) => {
  const lang = normalizeLanguage(req.query.lang);
  const result = await portalContentService.getContentBySlug(req.portal, req.params.slug, lang);
  if (!result) return res.status(404).json({ error: 'Contenu introuvable' });
  req.contentItem = result.content;
  next();
});

router.get('/:portal/contents', [
  param('portal').isIn(['sports', 'kids']),
  query('type').optional().trim().isLength({ max: 64 }),
  query('q').optional().trim().isLength({ max: 120 }),
  query('lang').optional().isIn(SUPPORTED_LANGUAGES),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], validate, resolveReader, ah(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 18);
  const lang = normalizeLanguage(req.query.lang);
  const { items, count, pages } = await portalContentService.listContents(req.portal, {
    contentType: req.query.type, language: lang, search: req.query.q, page, limit,
  });
  res.json({
    items: items.map(row => serializeContent(row, row.translations?.[0], { isAuthenticated: !req.isGuest })),
    page,
    pages,
    total: count,
  });
}));

router.get('/:portal/contents/:slug', [
  param('portal').isIn(['sports', 'kids']),
  param('slug').trim().isLength({ min: 1, max: 191 }),
  query('lang').optional().isIn(SUPPORTED_LANGUAGES),
], validate, resolveReader, ah(async (req, res) => {
  const lang = normalizeLanguage(req.query.lang);
  const result = await portalContentService.getContentBySlug(req.portal, req.params.slug, lang);
  if (!result) return res.status(404).json({ error: 'Contenu introuvable' });
  if (result.missingLanguage) {
    return res.status(404).json({
      error: 'Pas encore disponible dans cette langue',
      missing_language: true,
      available_languages: result.availableLanguages,
      language_urls: result.languageUrls,
    });
  }
  trackTraffic(req, res, { module: req.portal, entityType: result.content.content_type, entityId: result.content.id });
  PortalContent.increment('view_count', { by: 1, where: { id: result.content.id } }).catch(() => {});
  res.json({
    item: {
      ...serializeContent(result.content, result.translation, { withBody: true, isAuthenticated: !req.isGuest }),
      available_languages: result.availableLanguages,
      language_urls: result.languageUrls,
    },
  });
}));

router.get('/:portal/overview', [
  param('portal').isIn(['sports', 'kids']),
  query('lang').optional().isIn(SUPPORTED_LANGUAGES),
], validate, resolveReader, ah(async (req, res) => {
  const lang = normalizeLanguage(req.query.lang);
  const rows = await portalContentService.listAllPublished(req.portal, { limit: 60 });
  const sections = {};
  for (const row of rows) {
    const translation = portalContentService.translationOf(row, lang);
    if (!translation) continue; // jamais de contenu d'une autre langue dans les sections d'accueil
    if (!sections[row.content_type]) sections[row.content_type] = [];
    if (sections[row.content_type].length < 8) sections[row.content_type].push(serializeContent(row, translation, { isAuthenticated: !req.isGuest }));
  }
  res.json({ portal: req.portal, sections });
}));

// ── Favoris (page de présentation d'un livre) ───────────────────────────────────────────────
// Un invité n'appelle jamais ces routes (voir useStoryEngagement.js, repli localStorage) : pas de
// 400 "identifiant manquant" ici comme pour Play, juste une liste vide / un refus poli.
router.get('/:portal/favorites', [
  param('portal').isIn(['sports', 'kids']),
  query('lang').optional().isIn(SUPPORTED_LANGUAGES),
], validate, resolveReader, ah(async (req, res) => {
  if (req.isGuest) return res.json({ favorites: [] });
  const lang = normalizeLanguage(req.query.lang);
  // Pas d'association Sequelize entre les deux modèles (même choix que PlayGameFavorite, qui
  // référence son jeu par un simple slug plutôt qu'une clé étrangère typée) : jointure manuelle.
  // Contenu complet (pas juste `slug`) depuis KidsProfilePage.jsx, qui affiche ces favoris comme de
  // vraies cartes — useStoryFavorite.js (favoris d'une histoire) ne lit toujours que `.slug`, donc
  // enrichir chaque entrée reste rétrocompatible.
  const favorites = await PortalContentFavorite.findAll({ where: { user_id: req.readerId }, order: [['created_at', 'DESC']], raw: true });
  if (!favorites.length) return res.json({ favorites: [] });
  const contentIds = favorites.map(row => row.portal_content_id);
  const contents = await PortalContent.findAll({ where: { id: contentIds, portal: req.portal }, include: [portalContentService.allTranslationsInclude()] });
  const contentById = new Map(contents.map(c => [c.id, c]));
  res.json({
    favorites: favorites
      .filter(row => contentById.has(row.portal_content_id))
      .map(row => {
        const content = contentById.get(row.portal_content_id);
        const translation = portalContentService.translationOf(content, lang);
        return translation
          ? { ...serializeContent(content, translation, { isAuthenticated: true }), createdAt: row.created_at }
          : null;
      })
      .filter(Boolean),
  });
}));

// ── Historique de lecture ("Mon espace" Kids/Sports) ────────────────────────────────────────
// Même traitement invité que /favorites ci-dessus : jamais un 401, juste une liste vide (voir
// KidsProfilePage.jsx, qui affiche une invite à se connecter dans ce cas plutôt qu'une erreur).
router.get('/:portal/history', [
  param('portal').isIn(['sports', 'kids']),
  query('lang').optional().isIn(SUPPORTED_LANGUAGES),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], validate, resolveReader, ah(async (req, res) => {
  if (req.isGuest) return res.json({ history: [] });
  const lang = normalizeLanguage(req.query.lang);
  const limit = Number(req.query.limit || 20);
  const progress = await PortalContentProgress.findAll({
    where: { user_id: req.readerId },
    order: [['updated_at', 'DESC']],
    limit,
    raw: true,
  });
  if (!progress.length) return res.json({ history: [] });
  // Pas d'association Sequelize entre les deux modèles (même choix que /favorites) : jointure
  // manuelle, filtrée sur le portail demandé — un item de progression sur l'autre portail (peu
  // probable vu l'UI, mais possible via l'API) est silencieusement écarté plutôt qu'exposé.
  const contentIds = progress.map(row => row.portal_content_id);
  const contents = await PortalContent.findAll({ where: { id: contentIds, portal: req.portal }, include: [portalContentService.allTranslationsInclude()] });
  const contentById = new Map(contents.map(c => [c.id, c]));
  res.json({
    history: progress
      .filter(row => contentById.has(row.portal_content_id))
      .map(row => {
        const content = contentById.get(row.portal_content_id);
        const translation = portalContentService.translationOf(content, lang);
        if (!translation) return null;
        return {
          ...serializeContent(content, translation, { isAuthenticated: true }),
          progress: {
            pageIndex: row.page_index,
            totalPages: row.total_pages,
            completed: row.completed,
            updatedAt: row.updated_at,
          },
        };
      })
      .filter(Boolean),
  });
}));

router.post('/:portal/favorites/:slug', [
  param('portal').isIn(['sports', 'kids']),
  query('lang').optional().isIn(SUPPORTED_LANGUAGES),
], validate, resolveReader, loadContentBySlug, ah(async (req, res) => {
  if (req.isGuest) return res.status(401).json({ error: 'Connexion requise pour synchroniser les favoris' });
  const [favorite] = await PortalContentFavorite.findOrCreate({
    where: { user_id: req.readerId, portal_content_id: req.contentItem.id },
    defaults: { user_id: req.readerId, portal_content_id: req.contentItem.id },
  });
  res.status(201).json({ ok: true, favorite: { slug: req.contentItem.slug, createdAt: favorite.created_at } });
}));

router.delete('/:portal/favorites/:slug', [
  param('portal').isIn(['sports', 'kids']),
  query('lang').optional().isIn(SUPPORTED_LANGUAGES),
], validate, resolveReader, loadContentBySlug, ah(async (req, res) => {
  if (req.isGuest) return res.status(401).json({ error: 'Connexion requise pour synchroniser les favoris' });
  await PortalContentFavorite.destroy({ where: { user_id: req.readerId, portal_content_id: req.contentItem.id } });
  res.json({ ok: true });
}));

// ── Progression de lecture ("Continuer la lecture", si connecté) ───────────────────────────
router.get('/:portal/progress/:slug', [
  param('portal').isIn(['sports', 'kids']),
  query('lang').optional().isIn(SUPPORTED_LANGUAGES),
], validate, resolveReader, loadContentBySlug, ah(async (req, res) => {
  if (req.isGuest) return res.json({ progress: null });
  const row = await PortalContentProgress.findOne({ where: { user_id: req.readerId, portal_content_id: req.contentItem.id } });
  if (!row) return res.json({ progress: null });
  res.json({ progress: { pageIndex: row.page_index, totalPages: row.total_pages, completed: row.completed, updatedAt: row.updated_at } });
}));

router.put('/:portal/progress/:slug', [
  param('portal').isIn(['sports', 'kids']),
  query('lang').optional().isIn(SUPPORTED_LANGUAGES),
  body('pageIndex').isInt({ min: 0 }),
  body('totalPages').isInt({ min: 0 }),
  body('completed').optional().isBoolean(),
], validate, resolveReader, loadContentBySlug, ah(async (req, res) => {
  if (req.isGuest) return res.status(401).json({ error: 'Connexion requise pour synchroniser la progression' });
  const { pageIndex, totalPages, completed = false } = req.body;
  const [row] = await PortalContentProgress.findOrCreate({
    where: { user_id: req.readerId, portal_content_id: req.contentItem.id },
    defaults: { user_id: req.readerId, portal_content_id: req.contentItem.id, page_index: pageIndex, total_pages: totalPages, completed },
  });
  await row.update({ page_index: pageIndex, total_pages: totalPages, completed });
  res.json({ ok: true });
}));

module.exports = router;
