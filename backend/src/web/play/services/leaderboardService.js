'use strict';

const { query } = require('./repository');

const PERIOD_CLAUSES = {
  weekly: 'AND ps.played_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
  monthly: 'AND ps.played_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)',
  global: '',
};

async function worldLeaderboard(period = 'global', limit = 50) {
  if (period === 'global') {
    const rows = await query(
      `SELECT px.display_name, px.avatar_icon, px.total_xp AS xp, px.current_level, u.id AS user_id
       FROM play_xp px
       LEFT JOIN users u ON u.id = px.user_id
       ORDER BY px.total_xp DESC
       LIMIT :limit`,
      { limit }
    );
    return rows.map((r, i) => ({
      rank: i + 1,
      displayName: r.display_name || (r.user_id ? `Joueur #${r.user_id}` : 'Invité'),
      avatarIcon: r.avatar_icon,
      xp: Number(r.xp),
      level: r.current_level,
    }));
  }

  const clause = PERIOD_CLAUSES[period] || '';
  const rows = await query(
    `SELECT COALESCE(px.display_name, CONCAT('Joueur #', ps.user_id)) AS display_name,
            px.avatar_icon, SUM(ps.xp_earned) AS xp
     FROM play_scores ps
     LEFT JOIN play_xp px ON (px.user_id = ps.user_id AND ps.user_id IS NOT NULL)
                            OR (px.guest_id = ps.guest_id AND ps.guest_id IS NOT NULL)
     WHERE 1=1 ${clause}
     GROUP BY COALESCE(ps.user_id, ps.guest_id)
     ORDER BY xp DESC
     LIMIT :limit`,
    { limit }
  );
  return rows.map((r, i) => ({
    rank: i + 1,
    displayName: r.display_name || 'Invité',
    avatarIcon: r.avatar_icon,
    xp: Number(r.xp),
  }));
}

async function getLeaderboard({ scope = 'world', period = 'global', limit = 50 } = {}) {
  if (scope === 'friends') {
    // Aucun graphe social dans le codebase actuel — stub explicite, pas de faux résultats.
    return { scope, period, entries: [], note: 'coming soon' };
  }
  // scope=country|city retombent sur le classement mondial en Phase 1 : aucune
  // colonne city/country exploitable de façon fiable sur `users` pour ce module.
  const entries = await worldLeaderboard(period, limit);
  return { scope: 'world', period, entries };
}

module.exports = { getLeaderboard };
