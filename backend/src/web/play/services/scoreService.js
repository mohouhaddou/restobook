'use strict';

const { PlaySession, PlayScore, PlayXp, PlayGame } = require('../../../../models');
const gameService = require('./gameService');
const quizService = require('./quizService');
const badgeService = require('./badgeService');
const missionService = require('./missionService');
const xpCurve = require('./xpCurve');
const { haversineKm, guessPlaceScore } = require('./geoScoring');
const { whereForPlayer, findOrCreatePlayerXp, creditXpAndIcoins } = require('./playerService');

const QUIZ_TYPES = new Set(['quiz', 'true_false', 'geo_quiz']);
const CASUAL_TYPES = new Set(['2048', 'memory', 'puzzle_image', 'memory_cards', 'reaction_test', 'color_match', 'bubble_pop', 'brick_smash', 'tower_stack', 'penalty_master', 'snake']);
const CASUAL_LIMITS = {
  memory_cards: { minDuration: 5, maxDuration: 3600, maxScore: 5000 },
  reaction_test: { minDuration: 2, maxDuration: 300, maxScore: 3000 },
  color_match: { minDuration: 3, maxDuration: 600, maxScore: 5000 },
  bubble_pop: { minDuration: 5, maxDuration: 1800, maxScore: 25000 },
  brick_smash: { minDuration: 5, maxDuration: 1800, maxScore: 30000 },
  tower_stack: { minDuration: 3, maxDuration: 1800, maxScore: 1000 },
  penalty_master: { minDuration: 3, maxDuration: 600, maxScore: 2000 },
  snake: { minDuration: 3, maxDuration: 3600, maxScore: 25000 },
};
const MAX_CASUAL_SCORE = 100000; // borne de bon sens — pas d'anti-triche fort en V1 pour ces jeux libres
const recentSubmissions = new Map();
function reject(message, status = 400) { console.warn("[play-score] suspicious result rejected:", message); const error = new Error(message); error.status = status; throw error; }
function playerKey(playerRef) { return playerRef.isGuest ? "g:" + playerRef.guest_id : "u:" + playerRef.user_id; }

function yesterday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

async function applyDailyLoginBonus(xpRow) {
  const today = todayDate();
  if (xpRow.last_played_date === today) return { xp: 0, icoins: 0, streakBonus: null };

  let nextStreak = 1;
  if (xpRow.last_played_date && xpRow.last_played_date === yesterday(today)) {
    nextStreak = xpRow.current_streak_days + 1;
  }

  let streakBonus = null;
  let bonusXp = 0;
  let bonusIcoins = 0;
  if (nextStreak === 3) { streakBonus = '3-day'; bonusIcoins += 10; }
  if (nextStreak === 7) { streakBonus = '7-day'; bonusIcoins += 30; }

  await xpRow.update({
    last_played_date: today,
    current_streak_days: nextStreak,
    longest_streak_days: Math.max(xpRow.longest_streak_days, nextStreak),
  });

  return { xp: 10 + bonusXp, icoins: 5 + bonusIcoins, streakBonus };
}

async function scoreQuizRound(quizId, answers = []) {
  const questions = await quizService.getQuestionsForScoring(quizId);
  const byId = new Map(questions.map(q => [q.id, q]));
  let correctCount = 0;
  let earnedPoints = 0;
  let maxPoints = 0;
  const meta = [];

  for (const q of questions) {
    maxPoints += q.points;
    const given = answers.find(a => Number(a.questionId) === q.id);
    if (!given) { meta.push({ questionId: q.id, correct: false }); continue; }
    const correctAnswer = (q.answers || []).find(a => a.is_correct);
    const isCorrect = correctAnswer && Number(given.answerId) === correctAnswer.id;
    if (isCorrect) { correctCount += 1; earnedPoints += q.points; }
    meta.push({ questionId: q.id, correct: !!isCorrect });
  }

  return { score: earnedPoints, maxScore: maxPoints, correctAnswers: correctCount, totalQuestions: questions.length, meta };
}

async function scoreGuessPlaceRound(quizId, guesses = []) {
  const questions = await quizService.getQuestionsForScoring(quizId);
  let totalScore = 0;
  let correctCount = 0;
  const meta = [];

  for (const q of questions) {
    const given = guesses.find(g => Number(g.questionId) === q.id);
    if (!given) { meta.push({ questionId: q.id, score: 0 }); continue; }

    let roundScore = 0;
    let distanceKm = null;
    if (given.lat != null && given.lng != null) {
      distanceKm = haversineKm(Number(given.lat), Number(given.lng), Number(q.correct_lat), Number(q.correct_lng));
      roundScore = guessPlaceScore(distanceKm, Number(q.tolerance_km || 5));
    } else if (given.answerId != null) {
      const answer = (q.answers || []).find(a => a.id === Number(given.answerId));
      roundScore = answer?.is_correct ? 100 : 0;
      if (answer) distanceKm = haversineKm(Number(answer.city_lat), Number(answer.city_lng), Number(q.correct_lat), Number(q.correct_lng));
    }
    if (roundScore >= 90) correctCount += 1;
    totalScore += roundScore;
    meta.push({ questionId: q.id, score: roundScore, distanceKm });
  }

  const avgScore = questions.length ? Math.round(totalScore / questions.length) : 0;
  return { score: avgScore, maxScore: 100, correctAnswers: correctCount, totalQuestions: questions.length, meta };
}

async function submitScore(playerRef, payload) {
  const { gameSlug, sessionId = null, quizId = null, answers = [], guesses = [], won = false, score: casualScore = 0, durationSeconds = null, deviceType = null, difficulty = null, stats = {} } = payload;
  if (typeof gameSlug !== 'string' || gameSlug.length > 64) reject('Identifiant de jeu invalide');
  if (durationSeconds != null && (!Number.isFinite(Number(durationSeconds)) || Number(durationSeconds) < 0 || Number(durationSeconds) > 86400)) reject('Durée de partie invalide');
  const signature = [playerKey(playerRef), gameSlug, Number(casualScore) || 0, Number(durationSeconds) || 0].join(":");
  const previous = recentSubmissions.get(signature);
  if (previous && Date.now() - previous < 2500) reject('Résultat déjà soumis', 429);
  recentSubmissions.set(signature, Date.now());
  if (recentSubmissions.size > 2000) for (const [key,time] of recentSubmissions) if (Date.now()-time > 60000) recentSubmissions.delete(key);

  const game = await gameService.getGameBySlug(gameSlug);
  if (!game) throw new Error('Jeu introuvable');

  let result;
  if (QUIZ_TYPES.has(game.game_type) && game.game_type !== 'geo_quiz' && quizId) {
    result = await scoreQuizRound(quizId, answers);
  } else if (game.game_type === 'geo_quiz' && quizId) {
    result = await scoreQuizRound(quizId, answers);
  } else if (game.game_type === 'guess_place' && quizId) {
    result = await scoreGuessPlaceRound(quizId, guesses);
  } else if (CASUAL_TYPES.has(game.game_type)) {
    const limits = CASUAL_LIMITS[game.game_type] || { minDuration: 0, maxDuration: 86400, maxScore: MAX_CASUAL_SCORE };
    const duration = Number(durationSeconds || 0);
    if (duration < limits.minDuration || duration > limits.maxDuration) reject('Durée incohérente pour ce jeu');
    const clamped = Math.max(0, Math.min(limits.maxScore, Number(casualScore) || 0));
    const safeStats = stats && typeof stats === 'object' && !Array.isArray(stats) ? JSON.parse(JSON.stringify(stats).slice(0, 4000)) : {};
    result = { score: clamped, maxScore: null, correctAnswers: null, totalQuestions: null, meta: { won: !!won, difficulty, stats: safeStats } };
  } else {
    throw new Error('Type de jeu non supporté pour la soumission de score');
  }

  const where = whereForPlayer(playerRef);
  const now = new Date();
  const startedAt = durationSeconds ? new Date(now.getTime() - durationSeconds * 1000) : now;
  let session = sessionId ? await PlaySession.findOne({ where: { id: Number(sessionId), game_id: game.id, ...where } }) : null;
  if (session) await session.update({ quiz_id: quizId, ended_at: now, duration_seconds: durationSeconds, status: 'completed', device_type: deviceType || session.device_type });
  else session = await PlaySession.create({ ...where, game_id: game.id, quiz_id: quizId, started_at: startedAt, ended_at: now, duration_seconds: durationSeconds, status: 'completed', device_type: deviceType });

  // ── XP / iCoins ────────────────────────────────────────────────────────────
  const xpRow = await findOrCreatePlayerXp(playerRef);
  const daily = await applyDailyLoginBonus(xpRow);

  let roundXp = 0;
  let roundIcoins = 0;
  const isWin = game.game_type === 'guess_place' ? result.score >= 90 : !!won;

  if (game.game_type === 'guess_place') {
    roundXp += result.score;
    roundIcoins += Math.round(result.score / 10);
  } else if (QUIZ_TYPES.has(game.game_type)) {
    roundXp += result.correctAnswers * 5;
    roundIcoins += result.correctAnswers * 2;
    if (result.totalQuestions > 0 && result.correctAnswers === result.totalQuestions) {
      roundXp += 10;
      roundIcoins += 10;
    }
  } else if (CASUAL_TYPES.has(game.game_type) && won) {
    roundXp += 20;
    roundIcoins += 15;
  }

  const totalXpEarned = daily.xp + roundXp;
  const totalIcoinsEarned = daily.icoins + roundIcoins;

  const playScore = await PlayScore.create({
    ...where,
    game_id: game.id,
    session_id: session.id,
    quiz_id: quizId,
    score: result.score,
    max_score: result.maxScore,
    correct_answers: result.correctAnswers,
    total_questions: result.totalQuestions,
    duration_seconds: durationSeconds,
    difficulty: ['easy','medium','hard'].includes(difficulty) ? difficulty : null,
    xp_earned: totalXpEarned,
    icoins_earned: totalIcoinsEarned,
    meta: result.meta,
  });

  // ── Missions ──────────────────────────────────────────────────────────────
  await missionService.updateMissionProgress(playerRef, 'play_games_count', 1);
  if (isWin) await missionService.updateMissionProgress(playerRef, 'win_games_count', 1);
  if (QUIZ_TYPES.has(game.game_type) && result.correctAnswers) {
    await missionService.updateMissionProgress(playerRef, 'quiz_correct_count', result.correctAnswers);
  }
  if (totalXpEarned > 0) await missionService.updateMissionProgress(playerRef, 'earn_xp', totalXpEarned);
  if (totalIcoinsEarned > 0) await missionService.updateMissionProgress(playerRef, 'earn_icoins', totalIcoinsEarned);

  // ── Badges (après mise à jour du streak, avant écriture finale du XP) ──────
  const newBadges = await badgeService.checkAndAwardBadges(playerRef, xpRow.current_streak_days);
  const badgeXp = newBadges.reduce((sum, b) => sum + (b.xpBonus || 0), 0);
  const badgeIcoins = newBadges.reduce((sum, b) => sum + (b.icoinsBonus || 0), 0);

  const finalXp = xpRow.total_xp + totalXpEarned + badgeXp;
  const level = await xpCurve.levelForXp(finalXp);
  await xpRow.update({
    total_xp: finalXp,
    current_level: level.level_number,
    icoins_balance: xpRow.icoins_balance + totalIcoinsEarned + badgeIcoins,
    icoins_lifetime: xpRow.icoins_lifetime + totalIcoinsEarned + badgeIcoins,
  });

  return {
    score: playScore.score,
    maxScore: playScore.max_score,
    correctAnswers: playScore.correct_answers,
    totalQuestions: playScore.total_questions,
    xpEarned: totalXpEarned + badgeXp,
    icoinsEarned: totalIcoinsEarned + badgeIcoins,
    dailyLoginBonus: daily.xp > 0 ? daily : null,
    streakDays: xpRow.current_streak_days,
    newLevel: level.level_number,
    newBadges,
  };
}

async function getHistory(playerRef, limit = 30) {
  const where = whereForPlayer(playerRef);
  const sessions = await PlaySession.findAll({ where, order: [['started_at','DESC']], limit: Math.min(100, Math.max(1, Number(limit)||30)), raw: true });
  const gameIds = [...new Set(sessions.map(row => row.game_id))];
  const sessionIds = sessions.map(row => row.id);
  const [games, scores, totalPlays, totalTime, completed, abandoned] = await Promise.all([
    gameIds.length ? PlayGame.findAll({ where: { id: gameIds }, raw: true }) : [],
    sessionIds.length ? PlayScore.findAll({ where: { session_id: sessionIds }, raw: true }) : [],
    PlaySession.count({ where }),
    PlaySession.sum('duration_seconds', { where }),
    PlaySession.count({ where: { ...where, status: 'completed' } }),
    PlaySession.count({ where: { ...where, status: 'abandoned' } }),
  ]);
  const byGame = new Map(games.map(game => [game.id, game]));
  const bySession = new Map(scores.map(score => [score.session_id, score]));
  const history = sessions.map(row => { const score = bySession.get(row.id); return { id: row.id, game: byGame.get(row.game_id) || null, status: row.status, score: score?.score ?? null, durationSeconds: row.duration_seconds || 0, difficulty: score?.difficulty || null, xpEarned: score?.xp_earned || 0, deviceType: row.device_type, playedAt: row.started_at }; });
  return { history, summary: { totalPlays, totalTimeSeconds: Number(totalTime || 0), completed, abandoned } };
}
async function getBestScores(playerRef) {
  const rows = await PlayScore.findAll({ where: whereForPlayer(playerRef), order: [['score','DESC']], limit: 1000, raw: true });
  const best = new Map(); for (const row of rows) if (!best.has(row.game_id)) best.set(row.game_id,row);
  const games = best.size ? await PlayGame.findAll({ where: { id: [...best.keys()] }, raw: true }) : [];
  return games.map(game => { const row=best.get(game.id); return { game, score: row.score, durationSeconds: row.duration_seconds, difficulty: row.difficulty, playedAt: row.played_at }; });
}
module.exports = { submitScore, getHistory, getBestScores };
