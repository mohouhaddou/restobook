'use strict';

const express = require('express');
const router = express.Router();
const { query, param, body } = require('express-validator');
const validate = require('../../../middleware/validate');
const articleService = require('./articleService');
const { City } = require('../../../models');
const { RUBRIQUE_KEYS } = require('./rubriques');
const { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, normalizeLanguage } = require('./i18n');
const { trackTraffic } = require('../../../utils/traffic');

const CATEGORIES = ['guide', 'recette', 'promotion', 'conseil', 'actualite', 'nouveau_commerce', 'nouveau_produit', 'vie_locale', 'portrait'];
const LANG_RE = new RegExp('^(' + SUPPORTED_LANGUAGES.join('|') + ')$');

function reqLanguage(req) {
  return normalizeLanguage(req.params.lang || req.query.lang || DEFAULT_LANGUAGE);
}

const articleValidators = [
  query('lang').optional().isIn(SUPPORTED_LANGUAGES),
  query('q').optional().trim().isLength({ max: 191 }),
  query('rubrique').optional().isIn(RUBRIQUE_KEYS),
  query('category').optional().isIn(CATEGORIES),
  query('city').optional().trim().isLength({ max: 100 }),
  query('tag').optional().trim().isLength({ max: 100 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 30 }),
];

async function listArticlesHandler(req, res, next) {
  try {
    let cityId = null;
    if (req.query.city) {
      const city = await City.findOne({ where: { slug: req.query.city }, attributes: ['id'] });
      if (!city) return res.json({ total: 0, page: 1, pages: 0, articles: [], language: reqLanguage(req) });
      cityId = city.id;
    }
    const language = reqLanguage(req);
    const result = await articleService.listArticles({
      language,
      search: req.query.q || null,
      rubrique: req.query.rubrique || null,
      category: req.query.category || null,
      cityId,
      tag: req.query.tag || null,
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 12),
    });
    if (Number(req.query.page || 1) === 1) trackTraffic(req, res, { module: 'discover', entityType: 'home', entityId: null });
    res.json({ language, total: result.count, page: result.page, pages: result.pages, articles: result.articles });
  } catch (e) { next(e); }
}

router.get('/articles', articleValidators, validate, listArticlesHandler);
router.get('/:lang/articles', [param('lang').matches(LANG_RE), ...articleValidators], validate, listArticlesHandler);

router.get('/popular', [query('lang').optional().isIn(SUPPORTED_LANGUAGES), query('limit').optional().isInt({ min: 1, max: 20 })], validate, async (req, res, next) => {
  try { res.json({ articles: await articleService.listPopularArticles(Number(req.query.limit || 5), reqLanguage(req)) }); }
  catch (e) { next(e); }
});
router.get('/:lang/popular', [param('lang').matches(LANG_RE), query('limit').optional().isInt({ min: 1, max: 20 })], validate, async (req, res, next) => {
  try { res.json({ articles: await articleService.listPopularArticles(Number(req.query.limit || 5), reqLanguage(req)) }); }
  catch (e) { next(e); }
});

router.get('/recent', [query('lang').optional().isIn(SUPPORTED_LANGUAGES), query('limit').optional().isInt({ min: 1, max: 20 })], validate, async (req, res, next) => {
  try { res.json({ articles: await articleService.listRecentArticles(Number(req.query.limit || 5), reqLanguage(req)) }); }
  catch (e) { next(e); }
});
router.get('/:lang/recent', [param('lang').matches(LANG_RE), query('limit').optional().isInt({ min: 1, max: 20 })], validate, async (req, res, next) => {
  try { res.json({ articles: await articleService.listRecentArticles(Number(req.query.limit || 5), reqLanguage(req)) }); }
  catch (e) { next(e); }
});

router.get('/promotions', [query('limit').optional().isInt({ min: 1, max: 20 })], validate, async (req, res, next) => {
  try { res.json({ promotions: await articleService.listCurrentPromotions({ limit: Number(req.query.limit || 5) }) }); }
  catch (e) { next(e); }
});

router.get('/tags/popular', [query('lang').optional().isIn(SUPPORTED_LANGUAGES), query('limit').optional().isInt({ min: 1, max: 50 })], validate, async (req, res, next) => {
  try { res.json({ tags: await articleService.listPopularTags(Number(req.query.limit || 15), reqLanguage(req)) }); }
  catch (e) { next(e); }
});
router.get('/:lang/tags/popular', [param('lang').matches(LANG_RE), query('limit').optional().isInt({ min: 1, max: 50 })], validate, async (req, res, next) => {
  try { res.json({ tags: await articleService.listPopularTags(Number(req.query.limit || 15), reqLanguage(req)) }); }
  catch (e) { next(e); }
});

router.get('/rubriques', [query('lang').optional().isIn(SUPPORTED_LANGUAGES)], validate, async (req, res, next) => {
  try { res.json({ rubriques: await articleService.listRubriquesWithCounts(reqLanguage(req)) }); }
  catch (e) { next(e); }
});
router.get('/:lang/rubriques', [param('lang').matches(LANG_RE)], validate, async (req, res, next) => {
  try { res.json({ rubriques: await articleService.listRubriquesWithCounts(reqLanguage(req)) }); }
  catch (e) { next(e); }
});

router.post('/newsletter/subscribe', [body('email').trim().isLength({ min: 3, max: 191 })], validate, async (req, res, next) => {
  try { await articleService.subscribeNewsletter(req.body.email); res.status(201).json({ ok: true }); }
  catch (e) { if (e.code === 'INVALID_EMAIL') return res.status(400).json({ error: e.message }); next(e); }
});

async function detailHandler(req, res, next) {
  try {
    const article = await articleService.getArticleBySlug(req.params.slug, reqLanguage(req));
    if (!article) return res.status(404).json({ error: 'Article introuvable' });
    trackTraffic(req, res, { module: 'discover', entityType: 'article', entityId: article.id });
    res.json({ article, language: reqLanguage(req) });
  } catch (e) { next(e); }
}
router.get('/articles/:slug', [query('lang').optional().isIn(SUPPORTED_LANGUAGES), param('slug').trim().isLength({ min: 1, max: 191 })], validate, detailHandler);
router.get('/:lang/articles/:slug', [param('lang').matches(LANG_RE), param('slug').trim().isLength({ min: 1, max: 191 })], validate, detailHandler);

module.exports = router;
