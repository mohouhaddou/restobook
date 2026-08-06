'use strict';

/**
 * iFilino Gaming Hub — CRUD admin. Montées sous /api/superadmin/gaminghub,
 * même pattern que backend/src/modules/discover/adminRoutes.js.
 *
 * GET    /games                       — liste paginée (tous statuts)
 * GET    /games/:id                   — détail pour l'éditeur
 * POST   /games                       — créer (brouillon)
 * PUT    /games/:id                   — mettre à jour
 * DELETE /games/:id                   — supprimer
 * PATCH  /games/:id/publish           — bascule draft <-> published
 * GET    /games/:id/similar           — tous les liens (approuvés ou non)
 * POST   /games/:id/similar           — rattachement manuel à un play_game
 * POST   /games/:id/similar/suggest   — calcule des suggestions auto (source='auto', approved=false)
 * PATCH  /similar/:linkId/approve     — approuve/désapprouve un lien
 * DELETE /similar/:linkId             — retire un lien
 * GET    /ai/status                   — statut public du moteur IA
 * POST   /ai/test-connection          — test de connexion au provider IA
 * POST   /ai/generate-draft           — crée un nouveau jeu en brouillon via IA (voir aiDraftService.js)
 * GET    /articles                    — liste paginée (tous statuts)
 * GET    /articles/:id                — détail pour l'éditeur
 * POST   /articles                    — créer (brouillon)
 * PUT    /articles/:id                — mettre à jour
 * DELETE /articles/:id                — supprimer
 * PATCH  /articles/:id/publish        — bascule draft <-> published
 * POST   /ai/generate-article-draft   — crée un nouvel article en brouillon via IA
 * GET|POST /publishers, /categories, /platforms, /tags (+/:id pour PUT/DELETE)
 *          — CRUD générique (même factory que backend/src/modules/play/adminRoutes.js)
 */
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { literal } = require('sequelize');
const { requireAuth, requireSuperAdmin } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { GamingGame, GamingSimilarHtml5Game, GamingPublisher, GamingCategory, GamingPlatform, GamingTag, GamingFaq, GamingArticle, PlayGame } = require('../../../models');
const gameService = require('./gameService');
const articleService = require('./articleService');
const similarityService = require('./similarityService');
const aiDraftService = require('./aiDraftService');

const ARTICLE_TYPES = ['actualite', 'guide', 'astuce', 'test', 'classement', 'comparatif', 'top', 'collection'];

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth, requireSuperAdmin);

// CRUD générique pour les entités simples (mêmes conventions que
// play/adminRoutes.js:crud) — consommé tel quel par l'EntityPanel générique
// du frontend (GamingHubAdminPage.jsx).
function crud(path, Model) {
  router.get(path, ah(async (req, res) => {
    res.json({ items: await Model.findAll({ order: [['id', 'ASC']] }) });
  }));
  router.post(path, ah(async (req, res) => {
    const item = await Model.create(req.body || {});
    res.status(201).json({ ok: true, item });
  }));
  router.put(`${path}/:id`, ah(async (req, res) => {
    const item = await Model.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Introuvable' });
    await item.update(req.body || {});
    res.json({ ok: true, item });
  }));
  router.delete(`${path}/:id`, ah(async (req, res) => {
    const item = await Model.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Introuvable' });
    await item.destroy();
    res.json({ ok: true });
  }));
}
crud('/publishers', GamingPublisher);
crud('/categories', GamingCategory);
crud('/platforms', GamingPlatform);
crud('/tags', GamingTag);

const GAME_FIELDS = [
  'name', 'publisher_id', 'category_id', 'platform_ids', 'tags', 'genre', 'universe', 'mechanics',
  'view_mode', 'difficulty', 'cover_image_url', 'gallery', 'description', 'presentation',
  'why_popular', 'gameplay', 'configuration', 'release_date', 'official_links', 'sources',
  'seo_title', 'seo_description',
];
function extractFields(src) {
  const out = {};
  for (const f of GAME_FIELDS) if (src[f] !== undefined) out[f] = src[f];
  return out;
}

router.get('/games', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], validate, ah(async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
  const offset = (page - 1) * limit;
  const { count, rows } = await GamingGame.findAndCountAll({
    include: [{ model: GamingPublisher, as: 'publisher' }, { model: GamingCategory, as: 'category' }],
    order: [['createdAt', 'DESC']],
    distinct: true,
    limit,
    offset,
  });
  res.json({ games: rows, total: count, page, pages: Math.ceil(count / limit), limit });
}));

router.get('/games/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const game = await GamingGame.findByPk(req.params.id, {
    include: [{ model: GamingPublisher, as: 'publisher' }, { model: GamingCategory, as: 'category' }],
  });
  if (!game) return res.status(404).json({ error: 'Jeu introuvable' });
  res.json({ game });
}));

router.post('/games', [body('name').trim().notEmpty().isLength({ max: 191 })], validate, ah(async (req, res) => {
  const game = await gameService.createGame({ ...extractFields(req.body), name: req.body.name, author_id: req.user.id });
  res.status(201).json({ ok: true, game });
}));

router.put('/games/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const game = await gameService.updateGame(req.params.id, extractFields(req.body));
  if (!game) return res.status(404).json({ error: 'Jeu introuvable' });
  res.json({ ok: true, game });
}));

router.delete('/games/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const n = await GamingGame.destroy({ where: { id: req.params.id } });
  if (!n) return res.status(404).json({ error: 'Jeu introuvable' });
  res.json({ ok: true });
}));

router.patch('/games/:id/publish', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const game = await gameService.publishGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Jeu introuvable' });
  res.json({ ok: true, game });
}));

// ── Jeux similaires (le pont vers iFilino Play) ─────────────────────────────

router.get('/games/:id/similar', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const links = await GamingSimilarHtml5Game.findAll({
    where: { gaming_game_id: req.params.id },
    include: [{ model: PlayGame, as: 'playGame' }],
    order: [['sort_order', 'ASC']],
  });
  res.json({ links });
}));

router.post('/games/:id/similar', [
  param('id').isInt({ min: 1 }),
  body('play_game_id').isInt({ min: 1 }),
  body('approved').optional().isBoolean(),
  body('match_reasons').optional().isArray(),
], validate, ah(async (req, res) => {
  const link = await GamingSimilarHtml5Game.create({
    gaming_game_id: req.params.id,
    play_game_id: req.body.play_game_id,
    match_reasons: req.body.match_reasons || [],
    match_score: req.body.match_score || 1,
    source: 'manual',
    approved: req.body.approved !== false,
  });
  res.status(201).json({ ok: true, link });
}));

router.post('/games/:id/similar/suggest', [
  param('id').isInt({ min: 1 }),
  body('limit').optional().isInt({ min: 1, max: 30 }),
], validate, ah(async (req, res) => {
  const links = await similarityService.suggestSimilarGames(req.params.id, { limit: req.body.limit || 30 });
  res.json({ ok: true, count: links.length, links });
}));

router.patch('/similar/:linkId/approve', [
  param('linkId').isInt({ min: 1 }),
  body('approved').optional().isBoolean(),
], validate, ah(async (req, res) => {
  const link = await GamingSimilarHtml5Game.findByPk(req.params.linkId);
  if (!link) return res.status(404).json({ error: 'Lien introuvable' });
  link.approved = req.body.approved !== false;
  await link.save();
  res.json({ ok: true, link });
}));

router.delete('/similar/:linkId', [param('linkId').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const n = await GamingSimilarHtml5Game.destroy({ where: { id: req.params.linkId } });
  if (!n) return res.status(404).json({ error: 'Lien introuvable' });
  res.json({ ok: true });
}));

// ── Articles éditoriaux (gaming_articles) ───────────────────────────────────

const ARTICLE_FIELDS = ['title', 'excerpt', 'cover_image_url', 'article_type', 'body', 'gallery', 'tags', 'related_game_ids', 'faq', 'sources', 'seo_title', 'seo_description', 'scheduled_at'];
function extractArticleFields(src) {
  const out = {};
  for (const f of ARTICLE_FIELDS) if (src[f] !== undefined) out[f] = src[f];
  return out;
}

router.get('/articles', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], validate, ah(async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
  const offset = (page - 1) * limit;
  const { count, rows } = await GamingArticle.findAndCountAll({
    attributes: {
      include: [[literal(`(
        SELECT COUNT(DISTINCT te.visitor_hash)
        FROM traffic_events te
        WHERE te.module = 'gaminghub'
          AND te.entity_type = 'article'
          AND te.entity_id = CAST(gaming_article.id AS CHAR)
      )`), 'unique_readers_count']],
    },
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  res.json({ articles: rows, total: count, page, pages: Math.ceil(count / limit), limit });
}));

router.get('/articles/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const article = await GamingArticle.findByPk(req.params.id);
  if (!article) return res.status(404).json({ error: 'Article introuvable' });
  res.json({ article });
}));

router.post('/articles', [
  body('title').trim().notEmpty().isLength({ max: 191 }),
  body('article_type').isIn(ARTICLE_TYPES),
], validate, ah(async (req, res) => {
  const article = await articleService.createArticle({ ...extractArticleFields(req.body), author_id: req.user.id });
  res.status(201).json({ ok: true, article });
}));

router.put('/articles/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const article = await articleService.updateArticle(req.params.id, extractArticleFields(req.body));
  if (!article) return res.status(404).json({ error: 'Article introuvable' });
  res.json({ ok: true, article });
}));

router.delete('/articles/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const n = await GamingArticle.destroy({ where: { id: req.params.id } });
  if (!n) return res.status(404).json({ error: 'Article introuvable' });
  res.json({ ok: true });
}));

router.patch('/articles/:id/publish', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const article = await articleService.publishArticle(req.params.id);
  if (!article) return res.status(404).json({ error: 'Article introuvable' });
  res.json({ ok: true, article });
}));

// ── Moteur IA de brouillons ─────────────────────────────────────────────────

function sendAiError(res, error) {
  const status = error.status || 500;
  const retryable = !!error.retryable;
  const code = error.code || 'AI_PROVIDER_ERROR';
  const publicMessages = {
    AI_NOT_CONFIGURED: "La génération IA n'est pas configurée sur le serveur.",
    AI_MODEL_NOT_CONFIGURED: "Le modèle IA n'est pas configuré.",
    AI_AUTH_ERROR: 'La configuration IA est invalide ou non autorisée.',
    AI_BILLING_ERROR: 'Le service IA est indisponible pour des raisons de quota ou de facturation.',
    AI_RATE_LIMIT: 'Le service IA est temporairement limité. Réessayez dans quelques instants.',
    AI_TIMEOUT: 'La génération a dépassé le délai autorisé.',
    AI_EMPTY_RESPONSE: 'Le service IA a renvoyé une réponse vide.',
    AI_INVALID_JSON: 'Le service IA a renvoyé une réponse invalide.',
    AI_VALIDATION_ERROR: error.message || 'Le résultat IA ne respecte pas le format attendu.',
    AI_INPUT_TOO_LONG: error.message,
    AI_INVALID_INPUT: error.message,
  };
  console.warn('[gaminghub.ai]', { code, status, retryable });
  return res.status(status >= 400 && status < 600 ? status : 500).json({
    success: false, code, message: publicMessages[code] || 'Le service de génération est temporairement indisponible.', retryable,
  });
}

router.get('/ai/status', ah(async (req, res) => {
  res.json({ success: true, ...aiDraftService.getAiPublicStatus() });
}));

router.post('/ai/test-connection', ah(async (req, res) => {
  try {
    const status = await aiDraftService.testConnection();
    res.json({ success: true, ...status });
  } catch (e) {
    return sendAiError(res, e);
  }
}));

// Crée un nouveau jeu en brouillon (status='draft', generated_by_ai=true) —
// jamais publié automatiquement. Ne demande jamais release_date/configuration/
// official_links à l'IA (voir garde-fou légal dans aiDraftService.js) : ces
// champs restent à saisir manuellement par l'admin après vérification.
router.post('/ai/generate-draft',
  [
    body('name').trim().notEmpty().isLength({ max: 191 }),
    body('publisher_name').optional({ nullable: true }).trim().isLength({ max: 191 }),
    body('genre').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('universe').optional({ nullable: true }).trim().isLength({ max: 191 }),
    body('publisher_id').optional({ nullable: true }).isInt({ min: 1 }),
    body('category_id').optional({ nullable: true }).isInt({ min: 1 }),
    body('factual_info').optional({ nullable: true }).isString().isLength({ max: 3000 }),
    body('editorial_instructions').optional({ nullable: true }).isString().isLength({ max: 1200 }),
    body('sources').optional().isArray({ max: 8 }),
  ],
  validate,
  ah(async (req, res) => {
    try {
      const { game, faq } = await aiDraftService.generateGameDraft({
        name: req.body.name,
        publisherName: req.body.publisher_name || null,
        genre: req.body.genre || null,
        universe: req.body.universe || null,
        publisherId: req.body.publisher_id || null,
        categoryId: req.body.category_id || null,
        factualInfo: req.body.factual_info || '',
        editorialInstructions: req.body.editorial_instructions || '',
        sources: Array.isArray(req.body.sources) ? req.body.sources : [],
        authorId: req.user.id,
      });
      if (faq.length) await GamingFaq.bulkCreate(faq.map((f, i) => ({ gaming_game_id: game.id, question: f.question, answer: f.answer, sort_order: i })));
      const saved = await GamingGame.findByPk(game.id, {
        include: [{ model: GamingPublisher, as: 'publisher' }, { model: GamingCategory, as: 'category' }, { model: GamingFaq, as: 'faqs' }],
      });
      res.status(201).json({ ok: true, success: true, game: saved, ai_metadata: game.getDataValue('ai_metadata') || null });
    } catch (e) {
      return sendAiError(res, e);
    }
  })
);

// Crée un nouvel article en brouillon (status='draft', generated_by_ai=true).
// Ne cite que des jeux réellement présents dans gaming_games (voir garde-fou
// dans aiDraftService.generateArticleDraft) — jamais un jeu tiers inventé.
router.post('/ai/generate-article-draft',
  [
    body('topic').trim().notEmpty().isLength({ max: 300 }),
    body('article_type').isIn(ARTICLE_TYPES),
    body('game_slugs').optional().isArray({ max: 30 }),
    body('factual_info').optional({ nullable: true }).isString().isLength({ max: 3000 }),
    body('editorial_instructions').optional({ nullable: true }).isString().isLength({ max: 1200 }),
    body('sources').optional().isArray({ max: 8 }),
    body('word_count').optional({ nullable: true }).isInt({ min: 400, max: 2000 }),
  ],
  validate,
  ah(async (req, res) => {
    try {
      const { article } = await aiDraftService.generateArticleDraft({
        topic: req.body.topic,
        articleType: req.body.article_type,
        gameSlugs: Array.isArray(req.body.game_slugs) ? req.body.game_slugs : [],
        factualInfo: req.body.factual_info || '',
        editorialInstructions: req.body.editorial_instructions || '',
        sources: Array.isArray(req.body.sources) ? req.body.sources : [],
        wordCount: req.body.word_count || 800,
        authorId: req.user.id,
      });
      res.status(201).json({ ok: true, success: true, article, ai_metadata: article.getDataValue('ai_metadata') || null });
    } catch (e) {
      return sendAiError(res, e);
    }
  })
);

module.exports = router;
