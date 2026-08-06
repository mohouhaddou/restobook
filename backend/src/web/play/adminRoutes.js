'use strict';

/**
 * iFilino Play — administration SuperAdmin. Monté sous /api/superadmin/play.
 * CRUD simple pour games / quizzes(+questions+answers) / rewards / badges /
 * daily-missions / levels, + un endpoint de stats calculées à la volée.
 */

const express = require('express');
const { literal } = require('sequelize');
const { requireAuth, requireSuperAdmin } = require('../../../middleware/auth');
const {
  PlayGame, PlayProvider, PlayQuiz, PlayQuestion, PlayAnswer, PlayReward, PlayBadge,
  PlayDailyMission, PlayLevel,
} = require('../../../models');
const { query } = require('./services/repository');
const xpCurve = require('./services/xpCurve');

const router = express.Router();
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth, requireSuperAdmin);

function crud(router, path, Model, { include, afterWrite } = {}) {
  router.get(path, ah(async (req, res) => {
    res.json({ items: await Model.findAll({ include, order: [['id', 'ASC']] }) });
  }));
  router.get(`${path}/:id`, ah(async (req, res) => {
    const item = await Model.findByPk(req.params.id, { include });
    if (!item) return res.status(404).json({ error: 'Introuvable' });
    res.json({ item });
  }));
  router.post(path, ah(async (req, res) => {
    const item = await Model.create(req.body || {});
    if (afterWrite) afterWrite();
    res.status(201).json({ ok: true, item });
  }));
  router.put(`${path}/:id`, ah(async (req, res) => {
    const item = await Model.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Introuvable' });
    await item.update(req.body || {});
    if (afterWrite) afterWrite();
    res.json({ ok: true, item });
  }));
  router.delete(`${path}/:id`, ah(async (req, res) => {
    const item = await Model.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Introuvable' });
    await item.destroy();
    if (afterWrite) afterWrite();
    res.json({ ok: true });
  }));
}

const gameInclude = [{ model: PlayProvider, as: "provider", attributes: ["id", "code", "name", "active", "license_type", "license_reference", "base_url"] }];
async function gamePayload(body, currentId = null) {
  const value = { ...(body || {}) };
  if (!value.slug?.trim()) throw Object.assign(new Error('Slug du jeu requis'), { status: 400 });
  if (!value.name?.trim()) throw Object.assign(new Error('Nom du jeu requis'), { status: 400 });
  if (!value.game_type) throw Object.assign(new Error('Type du jeu requis'), { status: 400 });
  const duplicate = await PlayGame.findOne({ where: { slug: value.slug } });
  if (duplicate && Number(duplicate.id) !== Number(currentId)) throw Object.assign(new Error('Ce slug existe déjà'), { status: 409 });
  delete value.id; delete value.created_at; delete value.updated_at; delete value.provider;
  if (value.source !== "partner") { value.source = "internal"; value.provider_id = null; value.launch_url = null; return value; }
  const provider = await PlayProvider.findByPk(value.provider_id);
  if (!provider) throw Object.assign(new Error("Fournisseur introuvable"), { status: 400 });
  if (value.active && (!provider.active || !provider.license_reference)) throw Object.assign(new Error("Le fournisseur doit être actif et licencié"), { status: 400 });
  let launch;
  try { launch = new URL(value.launch_url); } catch { throw Object.assign(new Error("URL de lancement invalide"), { status: 400 }); }
  if (launch.protocol !== "https:") throw Object.assign(new Error("Le lancement partenaire exige HTTPS"), { status: 400 });
  if (provider.base_url && launch.origin !== new URL(provider.base_url).origin) throw Object.assign(new Error("Le domaine du jeu ne correspond pas au fournisseur"), { status: 400 });
  return value;
}
router.get("/games", ah(async (req, res) => res.json({
  items: await PlayGame.findAll({
    attributes: {
      include: [[literal(`(
        SELECT COUNT(DISTINCT te.visitor_hash)
        FROM traffic_events te
        WHERE te.module = 'play'
          AND te.entity_type = 'game'
          AND te.entity_id = CAST(play_game.id AS CHAR)
      )`), 'unique_players_count'],
        [literal(`(
          SELECT COUNT(*)
          FROM play_sessions ps
          WHERE ps.game_id = play_game.id
        )`), 'games_played_count']],
    },
    include: gameInclude,
    order: [["sort_order", "ASC"]],
  }),
})));
router.post("/games", ah(async (req, res) => { const item = await PlayGame.create(await gamePayload(req.body)); res.status(201).json({ ok: true, item }); }));
router.put("/games/:id", ah(async (req, res) => { const item = await PlayGame.findByPk(req.params.id); if (!item) return res.status(404).json({ error: "Introuvable" }); await item.update(await gamePayload(req.body, item.id)); res.json({ ok: true, item }); }));
router.delete("/games/:id", ah(async (req, res) => { const item = await PlayGame.findByPk(req.params.id); if (!item) return res.status(404).json({ error: "Introuvable" }); await item.destroy(); res.json({ ok: true }); }));

// "Jeu du jour" — un seul élu à la fois, indépendant de la promotion hero
// (qui elle peut concerner plusieurs jeux affichés en carrousel).
router.post("/games/:id/game-of-day", ah(async (req, res) => {
  const item = await PlayGame.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: "Introuvable" });
  await PlayGame.sequelize.transaction(async transaction => {
    await PlayGame.update({ is_game_of_day: false }, { where: {}, transaction });
    await item.update({ is_game_of_day: true }, { transaction });
  });
  res.json({ ok: true, item });
}));
router.delete("/games/:id/game-of-day", ah(async (req, res) => {
  const item = await PlayGame.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: "Introuvable" });
  await item.update({ is_game_of_day: false });
  res.json({ ok: true, item });
}));

const providerTableReady = PlayProvider.sync();
const providerPayload = body => {
  const value = { ...(body || {}) };
  delete value.id; delete value.created_at; delete value.updated_at;
  if (typeof value.code !== "string" || value.code.length < 2 || value.code.length > 64 || /[^a-z0-9-]/.test(value.code)) throw Object.assign(new Error("Code fournisseur invalide"), { status: 400 });
  if (!value.name?.trim()) throw Object.assign(new Error('Nom fournisseur requis'), { status: 400 });
  if (value.launch_mode !== 'internal' && value.base_url && !String(value.base_url).startsWith('https://')) throw Object.assign(new Error('L’URL fournisseur doit utiliser HTTPS'), { status: 400 });
  if (value.active && value.license_type !== 'internal' && !value.license_reference?.trim()) throw Object.assign(new Error('Une référence de licence est requise avant activation'), { status: 400 });
  return value;
};
router.get('/providers', ah(async (req, res) => { await providerTableReady; res.json({ items: await PlayProvider.findAll({ order: [['name', 'ASC']] }) }); }));
router.post('/providers', ah(async (req, res) => { await providerTableReady; const item = await PlayProvider.create(providerPayload(req.body)); res.status(201).json({ ok: true, item }); }));
router.put('/providers/:id', ah(async (req, res) => { await providerTableReady; const item = await PlayProvider.findByPk(req.params.id); if (!item) return res.status(404).json({ error: 'Introuvable' }); await item.update(providerPayload(req.body)); res.json({ ok: true, item }); }));
router.delete('/providers/:id', ah(async (req, res) => { await providerTableReady; const item = await PlayProvider.findByPk(req.params.id); if (!item) return res.status(404).json({ error: 'Introuvable' }); await item.destroy(); res.json({ ok: true }); }));
crud(router, '/rewards', PlayReward);
crud(router, '/badges', PlayBadge);
crud(router, '/daily-missions', PlayDailyMission);
crud(router, '/levels', PlayLevel, { afterWrite: () => xpCurve.invalidate() });
crud(router, '/quizzes', PlayQuiz, { include: [{ model: PlayQuestion, as: 'questions', include: [{ model: PlayAnswer, as: 'answers' }] }] });

// Questions/réponses imbriquées sous un quiz — CRUD dédié plutôt que générique
// (FK obligatoire vers le quiz parent).
router.post('/quizzes/:quizId/questions', ah(async (req, res) => {
  const question = await PlayQuestion.create({ ...req.body, quiz_id: req.params.quizId });
  res.status(201).json({ ok: true, question });
}));
router.put('/questions/:id', ah(async (req, res) => {
  const question = await PlayQuestion.findByPk(req.params.id);
  if (!question) return res.status(404).json({ error: 'Introuvable' });
  await question.update(req.body || {});
  res.json({ ok: true, question });
}));
router.delete('/questions/:id', ah(async (req, res) => {
  const question = await PlayQuestion.findByPk(req.params.id);
  if (!question) return res.status(404).json({ error: 'Introuvable' });
  await question.destroy();
  res.json({ ok: true });
}));
router.post('/questions/:questionId/answers', ah(async (req, res) => {
  const answer = await PlayAnswer.create({ ...req.body, question_id: req.params.questionId });
  res.status(201).json({ ok: true, answer });
}));
router.put('/answers/:id', ah(async (req, res) => {
  const answer = await PlayAnswer.findByPk(req.params.id);
  if (!answer) return res.status(404).json({ error: 'Introuvable' });
  await answer.update(req.body || {});
  res.json({ ok: true, answer });
}));
router.delete('/answers/:id', ah(async (req, res) => {
  const answer = await PlayAnswer.findByPk(req.params.id);
  if (!answer) return res.status(404).json({ error: 'Introuvable' });
  await answer.destroy();
  res.json({ ok: true });
}));

router.get('/stats', ah(async (req, res) => {
  const totalsRows = await query(`
    SELECT
      COUNT(*) AS games_played_count,
      COUNT(DISTINCT COALESCE(user_id, guest_id)) AS unique_players_count,
      COUNT(DISTINCT CASE WHEN guest_id IS NOT NULL THEN guest_id END) AS unique_guests_count,
      COALESCE(SUM(xp_earned), 0) AS xp_distributed,
      COALESCE(SUM(icoins_earned), 0) AS icoins_distributed,
      COALESCE(AVG(duration_seconds), 0) AS avg_session_duration_seconds
    FROM play_scores
  `);
  const topGames = await query(`
    SELECT pg.slug, pg.name, COUNT(*) AS plays
    FROM play_scores ps
    JOIN play_games pg ON pg.id = ps.game_id
    GROUP BY pg.id
    ORDER BY plays DESC
    LIMIT 5
  `);
  const topFavorited = await query(`
    SELECT pg.slug, pg.name, COUNT(*) AS favorites
    FROM play_game_favorites f
    JOIN play_games pg ON pg.slug = f.game_slug
    GROUP BY pg.id
    ORDER BY favorites DESC
    LIMIT 5
  `);
  const mostReported = await query(`
    SELECT pg.slug, pg.name, COUNT(*) AS reports, SUM(r.status = 'open') AS open_reports
    FROM play_game_reports r
    JOIN play_games pg ON pg.slug = r.game_slug
    GROUP BY pg.id
    ORDER BY reports DESC
    LIMIT 5
  `);
  const sourceSplit = await query(`
    SELECT pg.source, COUNT(DISTINCT pg.id) AS games_count, COUNT(ps.id) AS plays_count
    FROM play_games pg
    LEFT JOIN play_scores ps ON ps.game_id = pg.id
    WHERE pg.active = 1
    GROUP BY pg.source
  `);
  const [[activePlayers]] = [await query(`
    SELECT
      COUNT(DISTINCT CASE WHEN started_at >= CURDATE() THEN COALESCE(user_id, guest_id) END) AS dau,
      COUNT(DISTINCT CASE WHEN started_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN COALESCE(user_id, guest_id) END) AS wau
    FROM play_sessions
  `)];
  const [[playerAccounts]] = [await query(`
    SELECT SUM(user_id IS NOT NULL) AS registered_players, SUM(guest_id IS NOT NULL) AS guest_players
    FROM play_xp
  `)];
  const topPlayers = await query(`
    SELECT px.display_name, px.total_xp, px.current_level, px.icoins_balance, px.user_id, u.nom AS account_name
    FROM play_xp px
    LEFT JOIN users u ON u.id = px.user_id
    ORDER BY px.total_xp DESC
    LIMIT 10
  `);
  const deviceSplit = await query(`
    SELECT device_type, COUNT(*) AS sessions
    FROM play_sessions
    WHERE device_type IS NOT NULL
    GROUP BY device_type
  `);
  const dailyActivity = await query(`
    SELECT DATE(started_at) AS day, COUNT(DISTINCT COALESCE(user_id, guest_id)) AS players
    FROM play_sessions
    WHERE started_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
    GROUP BY DATE(started_at)
    ORDER BY day ASC
  `);
  // Trafic réel (visites de pages, dédupliqué par visiteur+jour via traffic_events —
  // voir backend/utils/traffic.js) : indépendant des play_sessions ci-dessus qui ne
  // couvrent que les parties effectivement lancées.
  const [[realTraffic]] = [await query(`
    SELECT
      COUNT(DISTINCT CASE WHEN view_date = CURDATE() THEN visitor_hash END) AS visitors_today,
      COUNT(DISTINCT CASE WHEN view_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) THEN visitor_hash END) AS visitors_7d,
      COUNT(DISTINCT CASE WHEN view_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) THEN visitor_hash END) AS visitors_30d
    FROM traffic_events
    WHERE module = 'play'
  `)];
  const dailyVisitors = await query(`
    SELECT view_date AS day, COUNT(DISTINCT visitor_hash) AS visitors
    FROM traffic_events
    WHERE module = 'play' AND view_date >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
    GROUP BY view_date
    ORDER BY day ASC
  `);
  const topReferrers = await query(`
    SELECT referrer_domain, COUNT(DISTINCT visitor_hash) AS visitors
    FROM traffic_events
    WHERE module = 'play' AND view_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
    GROUP BY referrer_domain
    ORDER BY visitors DESC
    LIMIT 8
  `);
  const realDeviceSplit = await query(`
    SELECT device_type, COUNT(DISTINCT visitor_hash) AS visitors
    FROM traffic_events
    WHERE module = 'play' AND view_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
    GROUP BY device_type
  `);
  res.json({
    stats: {
      ...totalsRows[0],
      topGames,
      topFavorited,
      mostReported,
      sourceSplit,
      activePlayers,
      playerAccounts,
      topPlayers: topPlayers.map(p => ({ ...p, name: p.account_name || p.display_name || (p.user_id ? `Joueur #${p.user_id}` : 'Invité') })),
      deviceSplit,
      dailyActivity,
      realTraffic,
      dailyVisitors,
      topReferrers,
      realDeviceSplit,
    },
  });
}));

module.exports = router;
