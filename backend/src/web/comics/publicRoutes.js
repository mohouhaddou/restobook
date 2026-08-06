'use strict';
const express = require('express');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../../models');

const router = express.Router();
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function jsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try { return JSON.parse(value); } catch { return []; }
}

async function hydrate(series) {
  series.genres = jsonArray(series.genres);
  series.tags = jsonArray(series.tags);
  series.episodes = await sequelize.query(
    'SELECT id,episode_uid,episode_version,publication_order,number,title,synopsis,language,cover_image,published_at FROM comic_episodes WHERE series_id=:id AND status="published" ORDER BY COALESCE(publication_order,number) ASC',
    { replacements: { id: series.id }, type: QueryTypes.SELECT }
  );
  for (const episode of series.episodes) {
    episode.pages = await sequelize.query(
      'SELECT page_number,image_url,thumbnail_url,width,height FROM comic_pages WHERE episode_id=:id ORDER BY page_number ASC',
      { replacements: { id: episode.id }, type: QueryTypes.SELECT }
    );
  }
  return series;
}

router.get('/public/series', asyncHandler(async (_req, res) => {
  const rows = await sequelize.query(
    `SELECT s.id,s.slug,s.title,s.subtitle,s.synopsis,s.cover_url,s.banner_url,s.language,
            s.age_rating,s.genres,s.tags,s.view_count,s.follower_count,s.published_at,(SELECT COALESCE(ROUND(AVG(r.rating),1),0) FROM comic_reviews r WHERE r.series_id=s.id AND r.status='published') avg_rating,(SELECT COUNT(*) FROM comic_reviews r WHERE r.series_id=s.id AND r.status='published') review_count,
            COALESCE(p.name,'iFilino Comics') publisher_name
       FROM comic_series s LEFT JOIN comic_publishers p ON p.id=s.publisher_id
      WHERE s.status='published' ORDER BY s.published_at DESC,s.updated_at DESC`,
    { type: QueryTypes.SELECT }
  );
  res.json({ items: await Promise.all(rows.map(hydrate)) });
}));

router.get('/public/series/:slug', asyncHandler(async (req, res) => {
  const row = (await sequelize.query(
    `SELECT s.*,COALESCE(p.name,'iFilino Comics') publisher_name
       FROM comic_series s LEFT JOIN comic_publishers p ON p.id=s.publisher_id
      WHERE s.slug=:slug AND s.status='published' LIMIT 1`,
    { replacements: { slug: req.params.slug }, type: QueryTypes.SELECT }
  ))[0];
  if (!row) return res.status(404).json({ error: 'Published series not found' });
  res.json({ item: await hydrate(row) });
}));

module.exports = router;
