'use strict';

const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { resolvePlayer } = require('./middleware/resolvePlayer');
const playerService = require('./services/playerService');
const gameService = require('./services/gameService');
const quizService = require('./services/quizService');
const scoreService = require('./services/scoreService');
const missionService = require('./services/missionService');
const rewardService = require('./services/rewardService');
const leaderboardService = require('./services/leaderboardService');
const puzzleImageService = require('./services/puzzleImageService');
const guestMergeService = require('./services/guestMergeService');
const { PlayBadge, PlayUserBadge, PlaySession } = require('../../../models');
const PlayGameFavorite = require('../../../models/playGameFavorite');
const PlayGameReport = require('../../../models/playGameReport');
const { trackTraffic } = require('../../../utils/traffic');

const router = express.Router();
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(resolvePlayer);

router.get('/games', ah(async (req, res) => {
  trackTraffic(req, res, { module: 'play', entityType: 'home', entityId: null });
  res.json({ games: await gameService.listGames() });
}));

router.get('/trending', ah(async (req, res) => {
  res.json({ slugs: await gameService.listTrendingSlugs(12, 7) });
}));

router.get('/games/:slug', ah(async (req, res) => {
  const game = await gameService.getGameBySlug(req.params.slug);
  if (!game) return res.status(404).json({ error: 'Jeu introuvable' });
  trackTraffic(req, res, { module: 'play', entityType: 'game', entityId: game.id });
  res.json({ game });
}));

router.get('/quizzes', ah(async (req, res) => {
  res.json({ quizzes: await quizService.listQuizzes({ category: req.query.category || null, gameId: req.query.gameId || null }) });
}));

router.get('/quizzes/:id/questions', ah(async (req, res) => {
  res.json({ questions: await quizService.getQuizQuestions(req.params.id, req.query.locale || req.headers['accept-language']) });
}));

const scoreLimiter = rateLimit({ windowMs: 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false });
const reportLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
router.post('/scores', scoreLimiter, ah(async (req, res) => {
  const playerRef = playerService.resolvePlayerRef(req);
  const result = await scoreService.submitScore(playerRef, req.body || {});
  res.status(201).json({ ok: true, result });
}));

router.get('/history', ah(async (req, res) => {
  const playerRef = playerService.resolvePlayerRef(req);
  res.json(await scoreService.getHistory(playerRef, req.query.limit));
}));

router.get('/favorites', ah(async (req, res) => {
  if (req.isGuest) return res.json({ favorites: [] });
  const rows = await PlayGameFavorite.findAll({ where: { user_id: req.playerId }, order: [['created_at', 'DESC']], raw: true });
  res.json({ favorites: rows.map(row => ({ slug: row.game_slug, createdAt: row.created_at })) });
}));

router.post('/favorites/:slug', ah(async (req, res) => {
  if (req.isGuest) return res.status(401).json({ error: 'Connexion requise pour synchroniser les favoris' });
  const slug = String(req.params.slug || '');
  if (!/^[a-z0-9-]{1,64}$/i.test(slug)) return res.status(400).json({ error: 'Identifiant de jeu invalide' });
  const [favorite] = await PlayGameFavorite.findOrCreate({ where: { user_id: req.playerId, game_slug: slug }, defaults: { user_id: req.playerId, game_slug: slug } });
  res.status(201).json({ ok: true, favorite: { slug: favorite.game_slug, createdAt: favorite.created_at } });
}));

router.delete('/favorites/:slug', ah(async (req, res) => {
  if (req.isGuest) return res.status(401).json({ error: 'Connexion requise pour synchroniser les favoris' });
  const slug = String(req.params.slug || '');
  if (!/^[a-z0-9-]{1,64}$/i.test(slug)) return res.status(400).json({ error: 'Identifiant de jeu invalide' });
  await PlayGameFavorite.destroy({ where: { user_id: req.playerId, game_slug: slug } });
  res.json({ ok: true });
}));

router.get('/best-scores', ah(async (req, res) => {
  const playerRef = playerService.resolvePlayerRef(req);
  res.json({ bestScores: await scoreService.getBestScores(playerRef) });
}));

router.get('/profile', ah(async (req, res) => {
  const playerRef = playerService.resolvePlayerRef(req);
  res.json({ profile: await playerService.getProfile(playerRef) });
}));

router.patch('/profile', ah(async (req, res) => {
  const playerRef = playerService.resolvePlayerRef(req);
  await playerService.updateProfile(playerRef, { displayName: req.body?.displayName, avatarIcon: req.body?.avatarIcon });
  res.json({ profile: await playerService.getProfile(playerRef) });
}));

router.get('/badges', ah(async (req, res) => {
  const playerRef = playerService.resolvePlayerRef(req);
  const where = playerRef.isGuest ? { guest_id: playerRef.guest_id } : { user_id: playerRef.user_id };
  const allBadges = await PlayBadge.findAll({ where: { active: true }, order: [['id', 'ASC']], raw: true });
  const earned = await PlayUserBadge.findAll({ where, raw: true });
  const earnedIds = new Set(earned.map(e => e.badge_id));
  res.json({
    badges: allBadges.map(b => ({ ...b, earned: earnedIds.has(b.id) })),
  });
}));

router.get('/missions/daily', ah(async (req, res) => {
  const playerRef = playerService.resolvePlayerRef(req);
  res.json({ missions: await missionService.getDailyMissions(playerRef) });
}));

router.post('/missions/:id/claim', ah(async (req, res) => {
  const playerRef = playerService.resolvePlayerRef(req);
  const result = await missionService.claimMission(playerRef, req.params.id);
  res.json({ ok: true, result });
}));

router.get('/rewards', ah(async (req, res) => {
  res.json({ rewards: await rewardService.listRewards({}) });
}));

router.post('/rewards/:id/claim', ah(async (req, res) => {
  const playerRef = playerService.resolvePlayerRef(req);
  try {
    const userReward = await rewardService.claimReward(playerRef, req.params.id);
    res.status(201).json({ ok: true, userReward });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
}));

router.get('/leaderboard', ah(async (req, res) => {
  const { scope = 'world', period = 'global' } = req.query;
  res.json(await leaderboardService.getLeaderboard({ scope, period }));
}));

router.post('/merge-guest', ah(async (req, res) => {
  if (req.isGuest) return res.status(400).json({ error: 'Connexion requise pour fusionner une progression invité' });
  const guestId = req.body?.guest_id;
  if (!guestId) return res.status(400).json({ error: 'guest_id manquant' });
  const result = await guestMergeService.mergeGuestIntoUser(guestId, req.playerId);
  res.json({ ok: true, ...result });
}));

router.get('/puzzle/images', ah(async (req, res) => {
  res.json({ images: await puzzleImageService.listPuzzleImages({}) });
}));

router.post('/reports', reportLimiter, ah(async (req, res) => {
  const slug = String(req.body?.gameSlug || '').trim();
  const reason = String(req.body?.reason || '').trim();
  const details = String(req.body?.details || '').trim();
  const pageUrl = String(req.body?.pageUrl || '').trim();
  if (!/^[a-z0-9-]{1,64}$/i.test(slug)) return res.status(400).json({ error: 'Identifiant de jeu invalide' });
  if (!['loading', 'controls', 'display', 'other'].includes(reason)) return res.status(400).json({ error: 'Motif de signalement invalide' });
  if (details.length > 500) return res.status(400).json({ error: 'La description ne peut pas dépasser 500 caractères' });
  const report = await PlayGameReport.create({
    user_id: req.isGuest ? null : req.playerId,
    guest_id: req.isGuest ? req.playerGuestId : null,
    game_slug: slug,
    reason,
    details: details || null,
    page_url: pageUrl.slice(0, 500) || null,
  });
  res.status(201).json({ ok: true, report: { id: report.id, status: report.status } });
}));

router.post('/sessions', ah(async (req, res) => {
  const game = await gameService.getGameBySlug(String(req.body?.gameSlug || ''));
  if (!game) return res.status(404).json({ error: 'Jeu introuvable' });
  const playerRef = playerService.resolvePlayerRef(req);
  const session = await PlaySession.create({
    ...(playerRef.isGuest ? { guest_id: playerRef.guest_id } : { user_id: playerRef.user_id }),
    game_id: game.id,
    device_type: ['mobile', 'tablet', 'desktop'].includes(req.body?.deviceType) ? req.body.deviceType : null,
    status: 'started',
  });
  res.status(201).json({ session: { id: session.id, startedAt: session.started_at } });
}));

router.patch('/sessions/:id', ah(async (req, res) => {
  const playerRef = playerService.resolvePlayerRef(req);
  const where = { id: Number(req.params.id), ...(playerRef.isGuest ? { guest_id: playerRef.guest_id } : { user_id: playerRef.user_id }) };
  const session = await PlaySession.findOne({ where });
  if (!session) return res.status(404).json({ error: 'Session introuvable' });
  if (session.status !== 'started') return res.json({ ok: true, session: { id: session.id, status: session.status } });
  const endedAt = new Date();
  const measured = Math.max(0, Math.min(86400, Math.round((endedAt - new Date(session.started_at)) / 1000)));
  await session.update({ ended_at: endedAt, duration_seconds: measured, status: req.body?.status === 'completed' ? 'completed' : 'abandoned' });
  res.json({ ok: true, session: { id: session.id, status: session.status, durationSeconds: measured } });
}));

module.exports = router;
