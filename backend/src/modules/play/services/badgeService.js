'use strict';

const { PlayBadge, PlayUserBadge } = require('../../../../models');
const { query } = require('./repository');
const { whereForPlayer } = require('./playerService');

function playerSqlCondition(playerRef) {
  return playerRef.isGuest
    ? { clause: 'guest_id = :pid', pid: playerRef.guest_id }
    : { clause: 'user_id = :pid', pid: playerRef.user_id };
}

async function countDistinctGamesPlayed(playerRef) {
  const { clause, pid } = playerSqlCondition(playerRef);
  const rows = await query(`SELECT COUNT(DISTINCT game_id) AS c FROM play_scores WHERE ${clause}`, { pid });
  return Number(rows[0]?.c || 0);
}

async function bestScoreForGameSlug(playerRef, gameSlug) {
  const { clause, pid } = playerSqlCondition(playerRef);
  const rows = await query(
    `SELECT MAX(ps.score) AS best FROM play_scores ps
     JOIN play_games pg ON pg.id = ps.game_id
     WHERE ps.${clause} AND pg.slug = :slug`,
    { pid, slug: gameSlug }
  );
  return Number(rows[0]?.best || 0);
}

async function countCompletedForGameSlug(playerRef, gameSlug) {
  const { clause, pid } = playerSqlCondition(playerRef);
  const rows = await query(
    `SELECT COUNT(*) AS c FROM play_scores ps
     JOIN play_games pg ON pg.id = ps.game_id
     WHERE ps.${clause} AND pg.slug = :slug`,
    { pid, slug: gameSlug }
  );
  return Number(rows[0]?.c || 0);
}

async function sumCorrectAnswers(playerRef) {
  const { clause, pid } = playerSqlCondition(playerRef);
  const rows = await query(
    `SELECT COALESCE(SUM(correct_answers), 0) AS c FROM play_scores WHERE ${clause} AND quiz_id IS NOT NULL`,
    { pid }
  );
  return Number(rows[0]?.c || 0);
}

async function countCategoryWins(playerRef, category) {
  const { clause, pid } = playerSqlCondition(playerRef);
  const rows = await query(
    `SELECT COUNT(*) AS c FROM play_scores ps
     JOIN play_quizzes pq ON pq.id = ps.quiz_id
     WHERE ps.${clause} AND pq.category = :category
       AND ps.max_score > 0 AND (ps.score / ps.max_score) >= 0.7`,
    { pid, category }
  );
  return Number(rows[0]?.c || 0);
}

async function countTimeWindowSessions(playerRef, start, end) {
  const { clause, pid } = playerSqlCondition(playerRef);
  const rows = await query(
    `SELECT COUNT(*) AS c FROM play_sessions
     WHERE ${clause} AND TIME(started_at) BETWEEN :start AND :end`,
    { pid, start, end }
  );
  return Number(rows[0]?.c || 0);
}

// Dispatcher condition_type — modelé sur marketplace/loyaltyService.js checkAndAwardBadges().
async function checkAndAwardBadges(playerRef, currentStreakDays = 0) {
  const where = whereForPlayer(playerRef);
  const allBadges = await PlayBadge.findAll({ where: { active: true } });
  const earned = await PlayUserBadge.findAll({ where, attributes: ['badge_id'] });
  const earnedIds = new Set(earned.map(e => e.badge_id));

  const newBadges = [];
  for (const badge of allBadges) {
    if (earnedIds.has(badge.id)) continue;
    let qualifies = false;
    const meta = badge.condition_meta || {};

    switch (badge.condition_type) {
      case 'games_played_count':
        qualifies = (await countDistinctGamesPlayed(playerRef)) >= badge.condition_value;
        break;
      case 'score_threshold':
        qualifies = meta.game_slug
          ? (await bestScoreForGameSlug(playerRef, meta.game_slug)) >= badge.condition_value
          : false;
        break;
      case 'puzzle_completed_count':
        qualifies = meta.game_slug
          ? (await countCompletedForGameSlug(playerRef, meta.game_slug)) >= badge.condition_value
          : false;
        break;
      case 'quiz_correct_count':
        qualifies = (await sumCorrectAnswers(playerRef)) >= badge.condition_value;
        break;
      case 'category_wins':
        qualifies = meta.category
          ? (await countCategoryWins(playerRef, meta.category)) >= badge.condition_value
          : false;
        break;
      case 'time_window_sessions':
        qualifies = (meta.start && meta.end)
          ? (await countTimeWindowSessions(playerRef, meta.start, meta.end)) >= badge.condition_value
          : false;
        break;
      case 'daily_streak':
        qualifies = currentStreakDays >= badge.condition_value;
        break;
      case 'manual':
      default:
        break;
    }

    if (qualifies) {
      await PlayUserBadge.create({ ...where, badge_id: badge.id });
      newBadges.push({ id: badge.id, code: badge.code, name: badge.name, icon: badge.icon, xpBonus: badge.xp_bonus, icoinsBonus: badge.icoins_bonus });
    }
  }
  return newBadges;
}

module.exports = { checkAndAwardBadges };
