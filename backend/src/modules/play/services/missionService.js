'use strict';

const crypto = require('crypto');
const { PlayDailyMission, PlayUserMission } = require('../../../../models');
const { whereForPlayer, creditXpAndIcoins } = require('./playerService');
const badgeService = require('./badgeService');

const DAILY_MISSION_COUNT = 3;

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function playerKey(playerRef) {
  return playerRef.isGuest ? `guest:${playerRef.guest_id}` : `user:${playerRef.user_id}`;
}

// Sélection déterministe (même joueur + même jour => mêmes missions), sans cron.
function pickMissionsForToday(missions, playerRef, date) {
  const seed = `${playerKey(playerRef)}:${date}`;
  const scored = missions.map(m => {
    const hash = crypto.createHash('md5').update(`${seed}:${m.id}`).digest('hex');
    return { mission: m, score: parseInt(hash.slice(0, 8), 16) };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, DAILY_MISSION_COUNT).map(s => s.mission);
}

async function getDailyMissions(playerRef) {
  const date = todayDate();
  const where = whereForPlayer(playerRef);
  const allMissions = await PlayDailyMission.findAll({ where: { active: true } });
  if (allMissions.length === 0) return [];

  const selected = pickMissionsForToday(allMissions, playerRef, date);
  const results = [];
  for (const mission of selected) {
    let userMission = await PlayUserMission.findOne({ where: { ...where, mission_id: mission.id, mission_date: date } });
    if (!userMission) {
      userMission = await PlayUserMission.create({ ...where, mission_id: mission.id, mission_date: date, progress_value: 0, status: 'in_progress' });
    }
    results.push({
      id: userMission.id,
      missionId: mission.id,
      code: mission.code,
      title: mission.title,
      description: mission.description,
      icon: mission.icon,
      missionType: mission.mission_type,
      targetValue: mission.target_value,
      progressValue: userMission.progress_value,
      status: userMission.status,
      xpReward: mission.xp_reward,
      icoinsReward: mission.icoins_reward,
    });
  }
  return results;
}

// Incrémente la progression de toutes les missions du jour correspondant à eventType.
async function updateMissionProgress(playerRef, eventType, amount = 1) {
  const date = todayDate();
  const where = whereForPlayer(playerRef);
  const userMissions = await PlayUserMission.findAll({
    where: { ...where, mission_date: date, status: 'in_progress' },
    include: [{ model: PlayDailyMission, as: 'mission' }],
  });
  for (const um of userMissions) {
    if (!um.mission || um.mission.mission_type !== eventType) continue;
    const nextValue = um.progress_value + amount;
    const completed = nextValue >= um.mission.target_value;
    await um.update({
      progress_value: nextValue,
      status: completed ? 'completed' : 'in_progress',
      completed_at: completed ? new Date() : null,
    });
  }
}

async function claimMission(playerRef, userMissionId) {
  const where = whereForPlayer(playerRef);
  const userMission = await PlayUserMission.findOne({
    where: { ...where, id: userMissionId },
    include: [{ model: PlayDailyMission, as: 'mission' }],
  });
  if (!userMission) throw new Error('Mission introuvable');
  if (userMission.status === 'claimed') throw new Error('Mission déjà réclamée');
  if (userMission.status !== 'completed') throw new Error('Mission non terminée');

  await userMission.update({ status: 'claimed', claimed_at: new Date() });

  const xpRow = await creditXpAndIcoins(playerRef, userMission.mission.xp_reward, userMission.mission.icoins_reward);
  const newBadges = await badgeService.checkAndAwardBadges(playerRef, xpRow.current_streak_days);
  const badgeXp = newBadges.reduce((sum, b) => sum + (b.xpBonus || 0), 0);
  const badgeIcoins = newBadges.reduce((sum, b) => sum + (b.icoinsBonus || 0), 0);
  if (badgeXp || badgeIcoins) await creditXpAndIcoins(playerRef, badgeXp, badgeIcoins);

  return {
    xpReward: userMission.mission.xp_reward + badgeXp,
    icoinsReward: userMission.mission.icoins_reward + badgeIcoins,
    newBadges,
  };
}

module.exports = { claimMission, getDailyMissions, updateMissionProgress };
