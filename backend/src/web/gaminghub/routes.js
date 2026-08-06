'use strict';

/**
 * iFilino Gaming Hub — routes publiques. Montées sous /api/gaminghub.
 * Portail éditorial SEO sur des jeux tiers célèbres (Dofus, Minecraft...) —
 * ne distribue rien, renvoie vers les jeux réellement jouables du catalogue
 * iFilino Play via /games/:slug/similar (voir similarityService.js).
 */
const express = require('express');
const router = express.Router();
const { query, param } = require('express-validator');
const validate = require('../../../middleware/validate');
const gameService = require('./gameService');
const articleService = require('./articleService');
const taxonomy = require('./taxonomy');
const { trackTraffic } = require('../../../utils/traffic');

const ARTICLE_TYPES = ['actualite', 'guide', 'astuce', 'test', 'classement', 'comparatif', 'top', 'collection'];

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/games', [
  query('category').optional().trim().isLength({ max: 100 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], validate, ah(async (req, res) => {
  const result = await gameService.listGames({
    status: 'published',
    categorySlug: req.query.category || null,
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 20),
  });
  res.json(result);
}));

router.get('/categories', [query('lang').optional().isIn(['ar', 'fr', 'en'])], validate, ah(async (req, res) => {
  res.json({ categories: await taxonomy.listCategories(req.query.lang || 'fr') });
}));

router.get('/games/:slug', [param('slug').trim().isLength({ min: 1, max: 191 })], validate, ah(async (req, res) => {
  const game = await gameService.getGameBySlug(req.params.slug);
  if (!game) return res.status(404).json({ error: 'Jeu introuvable' });
  trackTraffic(req, res, { module: 'gaminghub', entityType: 'game', entityId: game.id });
  res.json({ game });
}));

router.get('/games/:slug/similar', [
  param('slug').trim().isLength({ min: 1, max: 191 }),
  query('limit').optional().isInt({ min: 1, max: 30 }),
], validate, ah(async (req, res) => {
  const game = await gameService.getGameBySlug(req.params.slug, { onlyPublished: false });
  if (!game) return res.status(404).json({ error: 'Jeu introuvable' });
  const games = await gameService.similarityService.listApprovedSimilarGames(game.id, { limit: Number(req.query.limit || 15) });
  res.json({ games });
}));

router.get('/articles', [
  query('type').optional().isIn(ARTICLE_TYPES),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], validate, ah(async (req, res) => {
  const result = await articleService.listArticles({
    status: 'published',
    articleType: req.query.type || null,
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 12),
  });
  res.json(result);
}));

router.get('/articles/:slug', [param('slug').trim().isLength({ min: 1, max: 191 })], validate, ah(async (req, res) => {
  const result = await articleService.getArticleBySlug(req.params.slug);
  if (!result) return res.status(404).json({ error: 'Article introuvable' });
  trackTraffic(req, res, { module: 'gaminghub', entityType: 'article', entityId: result.article.id });
  res.json(result);
}));

module.exports = router;
