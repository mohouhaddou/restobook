'use strict';

/**
 * Lecture/écriture des fiches GamingGame (jeux tiers célèbres) — CRUD complet
 * réservé à adminRoutes.js, lecture publique réservée aux fiches `published`.
 */
const { GamingGame, GamingPublisher, GamingCategory, GamingFaq, GamingVideo, GamingUpdate } = require('../../../models');
const { generateUniqueSlug } = require('../../shared/utils/slug');
const similarityService = require('./similarityService');

const PUBLIC_INCLUDE = [
  { model: GamingPublisher, as: 'publisher' },
  { model: GamingCategory, as: 'category' },
  { model: GamingFaq, as: 'faqs', separate: true, order: [['sort_order', 'ASC']] },
  { model: GamingVideo, as: 'videos', separate: true, where: { is_official: true }, required: false, order: [['sort_order', 'ASC']] },
  { model: GamingUpdate, as: 'updates', separate: true, order: [['released_at', 'DESC']], limit: 10 },
];

async function listGames({ status = 'published', categorySlug = null, page = 1, limit = 20 } = {}) {
  const where = {};
  if (status) where.status = status;
  const include = [{ model: GamingPublisher, as: 'publisher' }, { model: GamingCategory, as: 'category' }];
  if (categorySlug) include[1].where = { slug: categorySlug };

  const offset = (Math.max(1, page) - 1) * limit;
  const { count, rows } = await GamingGame.findAndCountAll({
    where, include, order: [['published_at', 'DESC']], limit, offset, distinct: true,
  });
  return { count, page, pages: Math.ceil(count / limit), games: rows };
}

async function getGameBySlug(slug, { onlyPublished = true } = {}) {
  const where = { slug };
  if (onlyPublished) where.status = 'published';
  const game = await GamingGame.findOne({ where, include: PUBLIC_INCLUDE });
  if (!game) return null;
  GamingGame.increment('view_count', { where: { id: game.id } }).catch(() => {});
  return game;
}

async function createGame(fields) {
  const slug = await generateUniqueSlug(GamingGame, fields.slug || fields.name);
  return GamingGame.create({ ...fields, slug });
}

async function updateGame(id, fields) {
  const game = await GamingGame.findByPk(id);
  if (!game) return null;
  Object.assign(game, fields);
  await game.save();
  return game;
}

async function publishGame(id) {
  const game = await GamingGame.findByPk(id);
  if (!game) return null;
  const next = game.status === 'published' ? 'draft' : 'published';
  game.status = next;
  game.published_at = next === 'published' ? (game.published_at || new Date()) : game.published_at;
  await game.save();
  return game;
}

module.exports = { listGames, getGameBySlug, createGame, updateGame, publishGame, similarityService };
