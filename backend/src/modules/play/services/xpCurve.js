'use strict';

const { PlayLevel } = require('../../../../models');

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = null;
let cacheAt = 0;

async function getLevels() {
  const fresh = cache && (Date.now() - cacheAt) < CACHE_TTL_MS;
  if (fresh) return cache;
  const levels = await PlayLevel.findAll({ order: [['xp_threshold', 'DESC']], raw: true });
  cache = levels;
  cacheAt = Date.now();
  return levels;
}

function invalidate() {
  cache = null;
}

async function levelForXp(totalXp) {
  const levels = await getLevels();
  const match = levels.find(l => totalXp >= l.xp_threshold);
  return match || levels[levels.length - 1] || { level_number: 1, xp_threshold: 0, name: 'Débutant' };
}

async function xpToNextLevel(totalXp) {
  const levels = await getLevels();
  const ascending = [...levels].sort((a, b) => a.xp_threshold - b.xp_threshold);
  const next = ascending.find(l => l.xp_threshold > totalXp);
  if (!next) return null;
  return { nextLevel: next, xpRemaining: next.xp_threshold - totalXp };
}

module.exports = { getLevels, invalidate, levelForXp, xpToNextLevel };
