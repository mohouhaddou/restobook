'use strict';

const { PlayGame, PlayProvider } = require("../../../../models");
const { query } = require("./repository");

const providerInclude = [{ model: PlayProvider, as: "provider", required: false }];
function serialize(game) {
  const row = game.toJSON ? game.toJSON() : game;
  const provider = row.provider;
  if (row.source === "partner" && (!provider?.active || !provider.license_reference)) return null;
  return { ...row, providerId: provider?.code || "ifilino-api", providerName: provider?.name || "iFilino", launchMethod: row.source === "partner" ? (provider?.launch_mode === "redirect" ? "redirect" : provider?.launch_mode === "sdk" ? "sdk" : "embed") : "react", launchConfig: row.source === "partner" ? { url: row.launch_url } : { legacyType: row.game_type }, thumbnail: row.thumbnail_url, averageDuration: row.average_duration, compatibility: { mobile: Boolean(row.supports_mobile), keyboard: Boolean(row.supports_keyboard), fullscreen: Boolean(row.supports_fullscreen) }, license: provider?.license_reference || "iFilino", ads: Boolean(provider?.has_ads) };
}

async function listGames() {
  const games = await PlayGame.findAll({ where: { active: true }, include: providerInclude, order: [["sort_order", "ASC"]] });
  return games.map(serialize).filter(Boolean);
}

async function getGameBySlug(slug) {
  const game = await PlayGame.findOne({ where: { slug, active: true }, include: providerInclude });
  return game ? serialize(game) : null;
}

async function getGameById(id) {
  return PlayGame.findByPk(id, { raw: true });
}

// "Tendance" — basé sur les sessions réellement lancées (play_sessions),
// pas sur un score externe : couvre aussi bien les jeux internes que les
// jeux partenaires (GamePix) qui ne soumettent pas toujours de score.
async function listTrendingSlugs(limit = 12, days = 7) {
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 12));
  const rows = await query(`
    SELECT pg.slug AS slug, COUNT(*) AS play_count
    FROM play_sessions ps
    JOIN play_games pg ON pg.id = ps.game_id
    WHERE ps.started_at >= :since AND pg.active = 1
    GROUP BY pg.id
    ORDER BY play_count DESC
    LIMIT ${safeLimit}
  `, { since: new Date(Date.now() - days * 24 * 60 * 60 * 1000) });
  return rows.map(row => row.slug);
}

module.exports = { getGameById, getGameBySlug, listGames, listTrendingSlugs };
