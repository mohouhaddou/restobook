'use strict';

/**
 * CRUD + lecture publique des gaming_articles (Top X, comparatifs, astuces,
 * actualités éditoriales...). Version mono-langue pour la Phase 3 — les
 * traductions (gaming_article_translations) restent hors scope tant que la
 * traduction IA n'est pas branchée (voir plan Gaming Hub §Phase 5), même
 * choix que la fiche Dofus/Minecraft en Phase 1/2.
 */
const { marked } = require('marked');
const { GamingArticle, GamingGame } = require('../../../models');
const { generateUniqueSlug } = require('../../shared/utils/slug');

const CARD_ATTRIBUTES = ['id', 'slug', 'title', 'excerpt', 'cover_image_url', 'article_type', 'tags', 'published_at', 'view_count'];

async function resolveRelatedGames(relatedGameIds) {
  if (!Array.isArray(relatedGameIds) || !relatedGameIds.length) return [];
  const games = await GamingGame.findAll({
    where: { id: relatedGameIds, status: 'published' },
    attributes: ['id', 'slug', 'name', 'genre', 'cover_image_url'],
  });
  // Préserve l'ordre choisi par l'auteur (related_game_ids), pas l'ordre SQL.
  const bySlugId = new Map(games.map(g => [g.id, g]));
  return relatedGameIds.map(id => bySlugId.get(id)).filter(Boolean);
}

async function listArticles({ status = 'published', articleType = null, page = 1, limit = 12 } = {}) {
  const where = {};
  if (status) where.status = status;
  if (articleType) where.article_type = articleType;
  const offset = (Math.max(1, page) - 1) * limit;
  const { count, rows } = await GamingArticle.findAndCountAll({
    where, attributes: CARD_ATTRIBUTES, order: [['published_at', 'DESC']], limit, offset,
  });
  return { count, page, pages: Math.ceil(count / limit), articles: rows };
}

async function getArticleBySlug(slug, { onlyPublished = true } = {}) {
  const where = { slug };
  if (onlyPublished) where.status = 'published';
  const article = await GamingArticle.findOne({ where });
  if (!article) return null;
  GamingArticle.increment('view_count', { where: { id: article.id } }).catch(() => {});
  const relatedGames = await resolveRelatedGames(article.related_game_ids);
  // Markdown déjà rendu et échappé côté backend (marked) — auteurs = staff
  // de confiance ou brouillons IA validés par un admin avant publication,
  // même convention que discover/articleService.js.
  const body_html = article.body ? marked.parse(article.body) : '';
  return { article: { ...article.toJSON(), body_html }, relatedGames };
}

async function createArticle(fields) {
  const slug = await generateUniqueSlug(GamingArticle, fields.slug || fields.title);
  return GamingArticle.create({ ...fields, slug });
}

async function updateArticle(id, fields) {
  const article = await GamingArticle.findByPk(id);
  if (!article) return null;
  Object.assign(article, fields);
  await article.save();
  return article;
}

async function publishArticle(id) {
  const article = await GamingArticle.findByPk(id);
  if (!article) return null;
  const next = article.status === 'published' ? 'draft' : 'published';
  article.status = next;
  article.published_at = next === 'published' ? (article.published_at || new Date()) : article.published_at;
  await article.save();
  return article;
}

module.exports = { listArticles, getArticleBySlug, createArticle, updateArticle, publishArticle, resolveRelatedGames };
