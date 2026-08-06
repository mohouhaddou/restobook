'use strict';

const { PlayXp, PlayUserBadge, PlayBadge, User } = require('../../../../models');
const xpCurve = require('./xpCurve');

const AVATAR_ICONS = ['🎮','🦊','🐼','🐯','🐸','🦁','🐧','🐙','🚀','⚡','🔥','🏆','🎯','🥷','🧙','🐲'];

function resolvePlayerRef(req) {
  if (req.isGuest) return { user_id: null, guest_id: req.playerGuestId, isGuest: true };
  return { user_id: req.playerId, guest_id: null, isGuest: false };
}

function whereForPlayer(playerRef) {
  return playerRef.isGuest ? { guest_id: playerRef.guest_id } : { user_id: playerRef.user_id };
}

function generateGuestDisplayName(guestId) {
  const suffix = String(guestId || '').replace(/-/g, '').slice(-4).toUpperCase() || '0000';
  return `Invité-${suffix}`;
}

async function findOrCreatePlayerXp(playerRef) {
  const where = whereForPlayer(playerRef);
  let row = await PlayXp.findOne({ where });
  if (row) return row;
  let displayName = null;
  if (playerRef.isGuest) displayName = generateGuestDisplayName(playerRef.guest_id);
  else {
    const account = await User.findByPk(playerRef.user_id, { attributes: ['nom'] });
    displayName = account?.nom || null;
  }
  row = await PlayXp.create({ ...where, display_name: displayName });
  return row;
}

async function updateProfile(playerRef, { displayName, avatarIcon } = {}) {
  const xpRow = await findOrCreatePlayerXp(playerRef);
  const updates = {};
  if (displayName !== undefined) {
    const trimmed = String(displayName || '').trim().slice(0, 40);
    updates.display_name = trimmed || null;
  }
  if (avatarIcon !== undefined) {
    updates.avatar_icon = AVATAR_ICONS.includes(avatarIcon) ? avatarIcon : null;
  }
  if (Object.keys(updates).length) await xpRow.update(updates);
  return xpRow;
}

// Crédite XP/iCoins et recalcule le niveau — point d'entrée unique utilisé
// par scoreService (fin de manche) et missionService (réclamation de mission)
// pour éviter que l'un des deux flux oublie de persister le gain.
async function creditXpAndIcoins(playerRef, xpDelta = 0, icoinsDelta = 0) {
  const xpRow = await findOrCreatePlayerXp(playerRef);
  const newTotalXp = xpRow.total_xp + xpDelta;
  const level = await xpCurve.levelForXp(newTotalXp);
  await xpRow.update({
    total_xp: newTotalXp,
    current_level: level.level_number,
    icoins_balance: xpRow.icoins_balance + icoinsDelta,
    icoins_lifetime: xpRow.icoins_lifetime + Math.max(0, icoinsDelta),
  });
  return xpRow;
}

async function getProfile(playerRef) {
  const xpRow = await findOrCreatePlayerXp(playerRef);
  const level = await xpCurve.levelForXp(xpRow.total_xp);
  const nextLevel = await xpCurve.xpToNextLevel(xpRow.total_xp);
  const where = whereForPlayer(playerRef);
  const badges = await PlayUserBadge.findAll({ where, include: [{ model: PlayBadge, as: 'badge' }] });
  const account = playerRef.isGuest ? null : await User.findByPk(playerRef.user_id, { attributes: ['avatar_url'] });

  return {
    isGuest: playerRef.isGuest,
    displayName: xpRow.display_name,
    avatarIcon: xpRow.avatar_icon,
    avatarUrl: account?.avatar_url || null,
    availableAvatarIcons: AVATAR_ICONS,
    totalXp: xpRow.total_xp,
    currentLevel: level.level_number,
    levelName: level.name,
    levelIcon: level.icon,
    nextLevel: nextLevel ? {
      levelNumber: nextLevel.nextLevel.level_number,
      xpRemaining: nextLevel.xpRemaining,
      xpThreshold: nextLevel.nextLevel.xp_threshold,
    } : null,
    icoinsBalance: xpRow.icoins_balance,
    icoinsLifetime: xpRow.icoins_lifetime,
    currentStreakDays: xpRow.current_streak_days,
    longestStreakDays: xpRow.longest_streak_days,
    badges: badges.map(b => ({
      id: b.badge_id,
      code: b.badge?.code,
      name: b.badge?.name,
      icon: b.badge?.icon,
      earnedAt: b.earned_at,
    })),
  };
}

module.exports = { creditXpAndIcoins, findOrCreatePlayerXp, generateGuestDisplayName, getProfile, resolvePlayerRef, updateProfile, whereForPlayer };
